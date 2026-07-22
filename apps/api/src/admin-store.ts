import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

export interface AuditEntry {
  id: string;
  actor: string;
  action: string;
  target?: string;
  at: string;
  details?: Record<string, unknown>;
}

export interface PipelineRun {
  id: string;
  actor: string;
  triggeredBy: "admin";
  startedAt: string;
  endedAt?: string;
  durationMs?: number;
  status: "running" | "success" | "failed";
  force: boolean;
  contentHash?: string;
  changed?: boolean;
  error?: string;
}

export interface FieldOverride {
  field: string;
  value: unknown;
  originalValue: unknown;
  updatedBy: string;
  updatedAt: string;
}

export interface OverrideStore {
  models: Record<string, Record<string, FieldOverride>>;
}

function workspaceRoot() {
  return fs.existsSync(path.resolve(process.cwd(), "pnpm-workspace.yaml"))
    ? process.cwd()
    : path.resolve(process.cwd(), "../..");
}

export function adminDataDir() {
  return (
    process.env.ADMIN_STATE_DIR ?? path.resolve(workspaceRoot(), "data/admin")
  );
}

function readJson<T>(filePath: string, fallback: T): T {
  try {
    return JSON.parse(fs.readFileSync(filePath, "utf8")) as T;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return fallback;
    throw error;
  }
}

function writeJson(filePath: string, value: unknown) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  const tmpPath = `${filePath}.${process.pid}.tmp`;
  fs.writeFileSync(tmpPath, `${JSON.stringify(value, null, 2)}\n`);
  fs.renameSync(tmpPath, filePath);
}

/** Persist admin audit logs and pipeline run records.
 * 持久化管理员审计日志与管线运行记录。 */
export class AdminStore {
  private readonly dir = adminDataDir();

  appendAudit(entry: Omit<AuditEntry, "id" | "at">) {
    fs.mkdirSync(this.dir, { recursive: true });
    const audit: AuditEntry = {
      ...entry,
      id: crypto.randomUUID(),
      at: new Date().toISOString(),
    };
    fs.appendFileSync(
      path.join(this.dir, "audit.jsonl"),
      `${JSON.stringify(audit)}\n`,
    );
    return audit;
  }

  auditLogs(limit = 100) {
    const filePath = path.join(this.dir, "audit.jsonl");
    try {
      return fs
        .readFileSync(filePath, "utf8")
        .trim()
        .split("\n")
        .filter(Boolean)
        .map((line) => JSON.parse(line) as AuditEntry)
        .slice(-limit)
        .reverse();
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") return [];
      throw error;
    }
  }

  runs() {
    return readJson<PipelineRun[]>(
      path.join(this.dir, "pipeline-runs.json"),
      [],
    );
  }

  saveRuns(runs: PipelineRun[]) {
    writeJson(path.join(this.dir, "pipeline-runs.json"), runs);
  }

  overrides() {
    return readJson<OverrideStore>(path.join(this.dir, "overrides.json"), {
      models: {},
    });
  }

  saveOverrides(store: OverrideStore) {
    writeJson(path.join(this.dir, "overrides.json"), store);
  }
}
