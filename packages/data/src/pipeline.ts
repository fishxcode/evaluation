/**
 * Pipeline orchestrator — wires the full flow:
 *   Downloader → Raw Cache → Parser → Normalizer → Merge → Validation
 *   → Versioning → (Hot Reload handled by API watcher)
 * 管线编排器——串起完整流程。
 *
 * Supports full + incremental (etag/hash) refresh, and rollback-on-failure.
 * 支持全量 + 增量（etag/hash）刷新，以及失败回滚。
 */
import { mkdirSync, writeFileSync, readFileSync, existsSync } from 'fs';
import { join } from 'path';
import { createHash } from 'crypto';
import type { DatasetMetadata, SourceKind, FieldOverride, SourceStatus } from '@models-dev/shared';
import { adapters, type RawSnapshot, type ParsedContribution, type LabContribution } from './adapters/index.js';
import { merge } from './merger.js';
import { validate } from './validator.js';
import { DataStore } from './store.js';
import { PipelineLogger } from './logger.js';

export interface RefreshOptions {
  /** Force full refresh, ignore etag/hash / 强制全量，忽略 etag/hash */
  full?: boolean;
  /** Data directory / 数据目录 */
  dataDir: string;
  /** Trigger source for audit / 触发来源（审计用） */
  trigger?: string;
}

export interface RefreshResult {
  ok: boolean;
  version: number;
  modelCount: number;
  labCount: number;
  quarantinedCount: number;
  conflictCount: number;
  skipped: SourceKind[];
  durationMs: number;
  logs: ReturnType<PipelineLogger['getEntries']>;
  error?: string;
}

/** Load previous per-source snapshot meta for incremental decisions / 加载上次快照元数据 */
function loadPrevSnapshotMeta(dataDir: string): Partial<Record<SourceKind, { etag?: string; hash?: string }>> {
  const p = join(dataDir, 'merged', 'metadata.json');
  if (!existsSync(p)) return {};
  const meta = JSON.parse(readFileSync(p, 'utf8')) as DatasetMetadata;
  const out: Partial<Record<SourceKind, { etag?: string; hash?: string }>> = {};
  for (const s of meta.sources ?? []) {
    out[s.kind] = { etag: s.etag, hash: s.hash };
  }
  return out;
}

/** Load manual overrides keyed by canonical model id / 加载按规范 id 索引的人工覆盖 */
function loadOverrides(dataDir: string): Record<string, FieldOverride[]> {
  const p = join(dataDir, 'overrides.json');
  if (!existsSync(p)) return {};
  return JSON.parse(readFileSync(p, 'utf8')) as Record<string, FieldOverride[]>;
}

/** Persist raw snapshot for audit/debug / 持久化原始快照供审计调试 */
function cacheRaw(dataDir: string, snap: RawSnapshot): void {
  if (snap.skipped || snap.error || snap.raw == null) return;
  const dir = join(dataDir, 'raw');
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, `${snap.kind}.snapshot.json`), JSON.stringify(snap.raw), 'utf8');
}

/**
 * Run the full refresh pipeline.
 * 运行完整刷新管线。
 */
export async function refresh(opts: RefreshOptions): Promise<RefreshResult> {
  const start = Date.now();
  const log = new PipelineLogger();
  const store = new DataStore(opts.dataDir);
  const prevMeta = store.readMetadata();
  const prevSnapMeta = opts.full ? {} : loadPrevSnapshotMeta(opts.dataDir);

  log.info('start', 'pipeline refresh started', { full: !!opts.full, trigger: opts.trigger });

  // ---- Downloader + Raw Cache (parallel fetch) ----
  const snapshots: RawSnapshot[] = [];
  const sourceStatuses: SourceStatus[] = [];
  const skipped: SourceKind[] = [];

  await Promise.all(
    adapters.map(async (adapter) => {
      log.info('fetch', `fetching ${adapter.name}`, { kind: adapter.kind });
      const snap = await adapter.fetch(prevSnapMeta[adapter.kind]);
      snapshots.push(snap);
      cacheRaw(opts.dataDir, snap);

      const prevStatus = prevMeta?.sources.find(s => s.kind === adapter.kind);
      const consecutiveFailures = snap.error
        ? (prevStatus?.consecutiveFailures ?? 0) + 1
        : 0;

      sourceStatuses.push({
        kind: adapter.kind,
        lastFetchedAt: snap.error ? prevStatus?.lastFetchedAt : snap.fetchedAt,
        etag: snap.etag ?? prevStatus?.etag,
        hash: snap.skipped ? prevStatus?.hash : snap.hash,
        durationMs: snap.durationMs,
        status: snap.error ? 'failed' : snap.skipped ? 'skipped' : 'ok',
        consecutiveFailures,
        error: snap.error,
      });

      if (snap.skipped) {
        skipped.push(adapter.kind);
        log.info('fetch', `${adapter.kind} unchanged — skipped (incremental)`, { kind: adapter.kind });
      } else if (snap.error) {
        log.error('fetch', `${adapter.kind} fetch failed`, { kind: adapter.kind, error: snap.error });
      } else {
        log.info('fetch', `${adapter.kind} fetched`, { kind: adapter.kind, bytes: snap.hash ? 'ok' : 0, durationMs: snap.durationMs });
      }
    }),
  );

  // If ALL sources skipped (nothing changed), short-circuit — no new version.
  // 若所有来源都跳过（无变化），短路——不产生新版本。
  const allSkipped = snapshots.every(s => s.skipped);
  if (allSkipped && prevMeta && !opts.full) {
    log.info('done', 'all sources unchanged — no new version', {});
    return {
      ok: true,
      version: prevMeta.version,
      modelCount: prevMeta.modelCount,
      labCount: prevMeta.labCount,
      quarantinedCount: prevMeta.quarantinedCount,
      conflictCount: 0,
      skipped,
      durationMs: Date.now() - start,
      logs: log.getEntries(),
    };
  }

  // If a source failed and we have no cached snapshot to fall back on, and it's
  // a hard failure, we roll back (keep previous version).
  // 若某来源失败且无缓存回退，则回滚（保留上一版本）。
  const hardFailure = snapshots.find(s => s.error);
  if (hardFailure && prevMeta) {
    log.error('rollback', `source ${hardFailure.kind} failed — keeping previous version`, { version: prevMeta.version });
    return {
      ok: false,
      version: prevMeta.version,
      modelCount: prevMeta.modelCount,
      labCount: prevMeta.labCount,
      quarantinedCount: prevMeta.quarantinedCount,
      conflictCount: 0,
      skipped,
      durationMs: Date.now() - start,
      logs: log.getEntries(),
      error: `source ${hardFailure.kind} failed: ${hardFailure.error}`,
    };
  }

  // ---- Parse + Normalize ----
  // For skipped sources, reparse from cached raw snapshot so merge stays complete.
  // 对跳过的来源，从缓存原始快照重新解析，使 merge 保持完整。
  const contributions: ParsedContribution[] = [];
  const labs: LabContribution[] = [];
  for (const adapter of adapters) {
    let snap = snapshots.find(s => s.kind === adapter.kind)!;
    if (snap.skipped) {
      const cachePath = join(opts.dataDir, 'raw', `${adapter.kind}.snapshot.json`);
      if (existsSync(cachePath)) {
        snap = { ...snap, raw: JSON.parse(readFileSync(cachePath, 'utf8')), skipped: false };
      }
    }
    const parsed = adapter.parse(snap);
    log.info('parse', `${adapter.kind} parsed`, { models: parsed.models.length, labs: parsed.labs.length, providers: parsed.providers.length });
    contributions.push(parsed);
    labs.push(...parsed.labs);
  }

  // ---- Merge ----
  const overrides = loadOverrides(opts.dataDir);
  const sourceMetaForMerge: Partial<Record<SourceKind, { fetchedAt?: string; etag?: string }>> = {};
  for (const s of sourceStatuses) {
    sourceMetaForMerge[s.kind] = { fetchedAt: s.lastFetchedAt, etag: s.etag };
  }
  const merged = merge({ contributions, labs, overrides, sourceMeta: sourceMetaForMerge });
  log.info('merge', 'merge complete', { models: merged.models.length, labs: merged.labs.length, conflicts: merged.conflictCount });

  // ---- Validation + Quarantine ----
  const { valid, quarantined } = validate(merged.models);
  if (quarantined.length) {
    log.warn('validate', `${quarantined.length} records quarantined`, { count: quarantined.length });
  }
  log.info('validate', 'validation complete', { valid: valid.length, quarantined: quarantined.length });

  // ---- Versioning + Commit ----
  const contentHash = createHash('sha256').update(JSON.stringify(valid)).digest('hex');
  const version = (prevMeta?.version ?? 0) + 1;
  const providerCount = new Set(contributions.flatMap(c => c.providers.map(p => p.id))).size;

  const metadata: DatasetMetadata = {
    version,
    builtAt: new Date().toISOString(),
    contentHash,
    modelCount: valid.length,
    labCount: merged.labs.length,
    providerCount,
    sources: sourceStatuses,
    quarantinedCount: quarantined.length,
  };

  store.commit({ models: valid, labs: merged.labs, metadata, quarantine: quarantined });
  log.info('done', 'committed new version', { version, models: valid.length });

  return {
    ok: true,
    version,
    modelCount: valid.length,
    labCount: merged.labs.length,
    quarantinedCount: quarantined.length,
    conflictCount: merged.conflictCount,
    skipped,
    durationMs: Date.now() - start,
    logs: log.getEntries(),
  };
}
