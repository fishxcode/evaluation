import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { Injectable } from "@nestjs/common";

interface UsageStore {
  total: number;
  byEndpoint: Record<string, number>;
  topSearchTerms: Record<string, number>;
  updatedAt: string;
}

function workspaceRoot() {
  return fs.existsSync(path.resolve(process.cwd(), "pnpm-workspace.yaml"))
    ? process.cwd()
    : path.resolve(process.cwd(), "../..");
}

function usagePath() {
  return (
    process.env.API_USAGE_STATE_PATH ??
    path.resolve(workspaceRoot(), "data/admin/api-usage.json")
  );
}

function readStore(): UsageStore {
  try {
    return JSON.parse(fs.readFileSync(usagePath(), "utf8")) as UsageStore;
  } catch {
    return {
      total: 0,
      byEndpoint: {},
      topSearchTerms: {},
      updatedAt: new Date(0).toISOString(),
    };
  }
}

function writeStore(store: UsageStore) {
  fs.mkdirSync(path.dirname(usagePath()), { recursive: true });
  const tmp = `${usagePath()}.${process.pid}.${crypto.randomUUID()}.tmp`;
  fs.writeFileSync(tmp, `${JSON.stringify(store, null, 2)}\n`);
  fs.renameSync(tmp, usagePath());
}

/** Persist lightweight API endpoint and search usage aggregates.
 * 持久化轻量 API 端点和搜索用量聚合。 */
@Injectable()
export class ApiUsageService {
  record(endpoint: string, searchTerm?: string) {
    const store = readStore();
    store.total += 1;
    store.byEndpoint[endpoint] = (store.byEndpoint[endpoint] ?? 0) + 1;
    if (searchTerm)
      store.topSearchTerms[searchTerm] =
        (store.topSearchTerms[searchTerm] ?? 0) + 1;
    store.updatedAt = new Date().toISOString();
    writeStore(store);
    return store;
  }

  snapshot() {
    return readStore();
  }
}
