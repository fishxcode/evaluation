/**
 * AdminStore — persists audit logs, override records, and pipeline run history
 * to JSON files under DATA_DIR (9.2). Simple file store keeps the eval single-
 * container without an external DB dependency.
 * AdminStore——将审计日志、覆盖记录、管线运行历史持久化为 DATA_DIR 下的 JSON。
 * 简单文件存储使评测保持单容器、无外部 DB 依赖。
 */
import { Injectable } from '@nestjs/common';
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { join } from 'path';
import type { FieldOverride } from '@models-dev/shared';

/** An immutable audit log entry (9.2.5) / 不可篡改的审计日志条目 */
export interface AuditEntry {
  ts: string;
  actor: string;
  action: 'login' | 'refresh' | 'rollback' | 'override.set' | 'override.delete';
  detail: Record<string, unknown>;
}

/** A recorded pipeline run (9.2.1) / 记录的管线运行 */
export interface PipelineRun {
  runId: string;
  startedAt: string;
  trigger: string;
  ok: boolean;
  version: number;
  modelCount: number;
  quarantinedCount: number;
  durationMs: number;
  skipped: string[];
  error?: string;
}

@Injectable()
export class AdminStore {
  private readonly dir: string;
  constructor() {
    this.dir = process.env.DATA_DIR ? process.env.DATA_DIR : join(process.cwd(), 'data');
    mkdirSync(this.dir, { recursive: true });
  }

  private path(name: string): string {
    return join(this.dir, name);
  }
  private read<T>(name: string, fallback: T): T {
    const p = this.path(name);
    return existsSync(p) ? (JSON.parse(readFileSync(p, 'utf8')) as T) : fallback;
  }
  private write(name: string, data: unknown): void {
    writeFileSync(this.path(name), JSON.stringify(data, null, 2), 'utf8');
  }

  // ---- Audit log (append-only) ----
  audit(entry: Omit<AuditEntry, 'ts'>): void {
    const logs = this.read<AuditEntry[]>('audit-log.json', []);
    logs.push({ ts: new Date().toISOString(), ...entry });
    this.write('audit-log.json', logs);
  }
  getAuditLogs(): AuditEntry[] {
    return this.read<AuditEntry[]>('audit-log.json', []).slice().reverse();
  }

  // ---- Pipeline runs ----
  recordRun(run: PipelineRun): void {
    const runs = this.read<PipelineRun[]>('pipeline-runs.json', []);
    runs.push(run);
    this.write('pipeline-runs.json', runs.slice(-100));
  }
  getRuns(): PipelineRun[] {
    return this.read<PipelineRun[]>('pipeline-runs.json', []).slice().reverse();
  }
  getRun(runId: string): PipelineRun | undefined {
    return this.read<PipelineRun[]>('pipeline-runs.json', []).find(r => r.runId === runId);
  }

  // ---- Manual overrides (keyed by canonical model id) ----
  getOverrides(): Record<string, FieldOverride[]> {
    return this.read<Record<string, FieldOverride[]>>('overrides.json', {});
  }
  setOverride(modelId: string, override: FieldOverride): void {
    const all = this.getOverrides();
    const list = (all[modelId] ?? []).filter(o => o.field !== override.field);
    list.push(override);
    all[modelId] = list;
    this.write('overrides.json', all);
  }
  deleteOverride(modelId: string, field: string): void {
    const all = this.getOverrides();
    if (all[modelId]) {
      all[modelId] = all[modelId]!.filter(o => o.field !== field);
      if (all[modelId]!.length === 0) delete all[modelId];
      this.write('overrides.json', all);
    }
  }
}
