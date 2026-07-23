/**
 * Versioned data store — atomic writes, N-version history, rollback.
 * 版本化数据存储——原子写入、保留 N 个历史版本、回滚。
 *
 * Serves both Phase 2 pipeline versioning and Admin Console rollback (9.2.1).
 * 同时服务 Phase 2 管线版本控制与 Admin Console 回滚。
 *
 * Layout:
 *   data/merged/models.json      (current active dataset)
 *   data/merged/metadata.json    (current metadata)
 *   data/merged/quarantine.json  (current quarantine)
 *   data/versions/v{n}/          (historical snapshots)
 */
import { mkdirSync, writeFileSync, readFileSync, existsSync, readdirSync, renameSync, rmSync } from 'fs';
import { join } from 'path';
import type { Model, Lab, DatasetMetadata } from '@models-dev/shared';
import type { QuarantineRecord } from './validator.js';

/** How many historical versions to keep / 保留多少历史版本 */
const MAX_VERSIONS = 5;

export interface DatasetPayload {
  models: Model[];
  labs: Lab[];
  metadata: DatasetMetadata;
  quarantine: QuarantineRecord[];
}

export class DataStore {
  private readonly dataDir: string;
  private readonly mergedDir: string;
  private readonly versionsDir: string;

  constructor(dataDir: string) {
    this.dataDir = dataDir;
    this.mergedDir = join(dataDir, 'merged');
    this.versionsDir = join(dataDir, 'versions');
    mkdirSync(this.mergedDir, { recursive: true });
    mkdirSync(this.versionsDir, { recursive: true });
  }

  /** Read current metadata, or null if none exists / 读当前元数据，无则 null */
  readMetadata(): DatasetMetadata | null {
    const p = join(this.mergedDir, 'metadata.json');
    if (!existsSync(p)) return null;
    return JSON.parse(readFileSync(p, 'utf8')) as DatasetMetadata;
  }

  /** Read current models / 读当前模型 */
  readModels(): Model[] {
    const p = join(this.mergedDir, 'models.json');
    if (!existsSync(p)) return [];
    return JSON.parse(readFileSync(p, 'utf8')) as Model[];
  }

  /** Read current labs / 读当前 Lab */
  readLabs(): Lab[] {
    const p = join(this.mergedDir, 'labs.json');
    if (!existsSync(p)) return [];
    return JSON.parse(readFileSync(p, 'utf8')) as Lab[];
  }

  /** Read current quarantine / 读当前隔离区 */
  readQuarantine(): QuarantineRecord[] {
    const p = join(this.mergedDir, 'quarantine.json');
    if (!existsSync(p)) return [];
    return JSON.parse(readFileSync(p, 'utf8')) as QuarantineRecord[];
  }

  /**
   * Atomically write a new dataset version. Writes to temp files then renames,
   * so readers never see a half-written state. Archives the previous version
   * and prunes to MAX_VERSIONS.
   * 原子写入新版本。先写临时文件再 rename，读者永不见半写状态。
   * 归档上一版本并裁剪到 MAX_VERSIONS。
   */
  commit(payload: DatasetPayload): void {
    // Archive current version before overwriting (for rollback).
    // 覆盖前归档当前版本（用于回滚）。
    const prevMeta = this.readMetadata();
    if (prevMeta) {
      this.archiveCurrent(prevMeta.version);
    }

    this.atomicWrite('models.json', payload.models);
    this.atomicWrite('labs.json', payload.labs);
    this.atomicWrite('quarantine.json', payload.quarantine);
    this.atomicWrite('metadata.json', payload.metadata);

    this.pruneVersions();
  }

  /** Atomic write: temp file + rename / 原子写：临时文件 + rename */
  private atomicWrite(name: string, data: unknown): void {
    const target = join(this.mergedDir, name);
    const tmp = `${target}.tmp`;
    writeFileSync(tmp, JSON.stringify(data, null, 2), 'utf8');
    renameSync(tmp, target);
  }

  /** Copy current merged/ into versions/v{n}/ / 将当前 merged 复制到 versions/v{n} */
  private archiveCurrent(version: number): void {
    const vdir = join(this.versionsDir, `v${version}`);
    mkdirSync(vdir, { recursive: true });
    for (const name of ['models.json', 'labs.json', 'quarantine.json', 'metadata.json']) {
      const src = join(this.mergedDir, name);
      if (existsSync(src)) {
        writeFileSync(join(vdir, name), readFileSync(src, 'utf8'), 'utf8');
      }
    }
  }

  /** List available historical versions (descending) / 列出可用历史版本（降序） */
  listVersions(): number[] {
    if (!existsSync(this.versionsDir)) return [];
    return readdirSync(this.versionsDir)
      .filter(d => /^v\d+$/.test(d))
      .map(d => parseInt(d.slice(1), 10))
      .sort((a, b) => b - a);
  }

  /**
   * Roll back the active dataset to a historical version (9.2.1). Archives the
   * current (bad) version first, then promotes the target version to active.
   * 将活动数据集回滚到历史版本。先归档当前（问题）版本，再把目标版本提升为活动。
   * @throws if the target version does not exist / 目标版本不存在时抛出
   */
  rollback(targetVersion: number): DatasetMetadata {
    const vdir = join(this.versionsDir, `v${targetVersion}`);
    if (!existsSync(vdir)) {
      throw new Error(`version v${targetVersion} not found`);
    }
    // Archive current before rollback.
    const cur = this.readMetadata();
    if (cur) this.archiveCurrent(cur.version);

    for (const name of ['models.json', 'labs.json', 'quarantine.json', 'metadata.json']) {
      const src = join(vdir, name);
      if (existsSync(src)) {
        this.atomicWrite(name, JSON.parse(readFileSync(src, 'utf8')));
      }
    }
    return this.readMetadata()!;
  }

  /** Keep only the newest MAX_VERSIONS archived versions / 仅保留最新 N 个归档版本 */
  private pruneVersions(): void {
    const versions = this.listVersions();
    for (const v of versions.slice(MAX_VERSIONS)) {
      rmSync(join(this.versionsDir, `v${v}`), { recursive: true, force: true });
    }
  }
}
