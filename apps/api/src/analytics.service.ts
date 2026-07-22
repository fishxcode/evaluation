import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { Injectable } from "@nestjs/common";

interface AnalyticsStore {
  total: number;
  byPath: Record<string, number>;
  seen: Record<string, string>;
  updatedAt: string;
}

interface PageViewInput {
  pagePath: string;
  sessionId?: string;
  ip?: string;
  userAgent?: string;
}

const DEDUPE_WINDOW_MS = 30 * 60 * 1000;
const SEEN_RETENTION_MS = 24 * 60 * 60 * 1000;

function defaultAnalyticsPath() {
  const workspaceRoot = fs.existsSync(
    path.resolve(process.cwd(), "pnpm-workspace.yaml"),
  )
    ? process.cwd()
    : path.resolve(process.cwd(), "../..");
  const candidates = [
    process.env.ANALYTICS_STATE_PATH,
    path.resolve(workspaceRoot, "data/analytics/pageviews.json"),
    path.resolve(process.cwd(), "data/analytics/pageviews.json"),
  ].filter((candidate): candidate is string => Boolean(candidate));
  return candidates[0]!;
}

function emptyStore(): AnalyticsStore {
  return {
    total: 0,
    byPath: {},
    seen: {},
    updatedAt: new Date(0).toISOString(),
  };
}

function normalizePagePath(pagePath: string) {
  if (!pagePath.startsWith("/")) return "/";
  return pagePath.slice(0, 300);
}

/** Persist and deduplicate public page view counters.
 * 持久化并基础去重公开页面访问计数。 */
@Injectable()
export class AnalyticsService {
  constructor(private readonly storePath = defaultAnalyticsPath()) {}

  /** Return the public analytics snapshot without internal dedupe keys.
   * 返回公开分析快照，不暴露内部去重键。 */
  getSnapshot() {
    const store = this.readStore();
    return {
      pageViews: store.total,
      byPath: store.byPath,
      updatedAt: store.updatedAt,
    };
  }

  /** Record one public page view with session/IP/UA based dedupe.
   * 按 session/IP/UA 做基础去重后记录一次公开页面访问。 */
  recordPageView(input: PageViewInput) {
    const pagePath = normalizePagePath(input.pagePath);
    const store = this.readStore();
    const now = Date.now();
    const nowIso = new Date(now).toISOString();
    const key = this.buildDedupeKey({ ...input, pagePath });
    const lastSeenAt = store.seen[key] ? Date.parse(store.seen[key]!) : 0;
    const counted =
      !pagePath.startsWith("/admin") &&
      (!lastSeenAt || now - lastSeenAt > DEDUPE_WINDOW_MS);

    store.seen[key] = nowIso;
    this.pruneSeen(store, now);
    if (counted) {
      store.total += 1;
      store.byPath[pagePath] = (store.byPath[pagePath] ?? 0) + 1;
      store.updatedAt = nowIso;
    }
    this.writeStore(store);

    return {
      counted,
      pageViews: store.total,
      byPath: store.byPath,
      updatedAt: store.updatedAt,
    };
  }

  private buildDedupeKey(input: PageViewInput) {
    return crypto
      .createHash("sha256")
      .update(
        [
          input.sessionId ?? "anonymous",
          input.ip ?? "unknown",
          input.userAgent ?? "unknown",
          input.pagePath,
        ].join("\n"),
      )
      .digest("hex");
  }

  private pruneSeen(store: AnalyticsStore, now: number) {
    for (const [key, value] of Object.entries(store.seen)) {
      const seenAt = Date.parse(value);
      if (!seenAt || now - seenAt > SEEN_RETENTION_MS) delete store.seen[key];
    }
  }

  private readStore(): AnalyticsStore {
    if (!fs.existsSync(this.storePath)) return emptyStore();
    try {
      const parsed = JSON.parse(
        fs.readFileSync(this.storePath, "utf8"),
      ) as Partial<AnalyticsStore>;
      return {
        total: typeof parsed.total === "number" ? parsed.total : 0,
        byPath: parsed.byPath ?? {},
        seen: parsed.seen ?? {},
        updatedAt: parsed.updatedAt ?? new Date(0).toISOString(),
      };
    } catch {
      return emptyStore();
    }
  }

  private writeStore(store: AnalyticsStore) {
    fs.mkdirSync(path.dirname(this.storePath), { recursive: true });
    const tmpPath = `${this.storePath}.${process.pid}.tmp`;
    fs.writeFileSync(tmpPath, `${JSON.stringify(store, null, 2)}\n`);
    fs.renameSync(tmpPath, this.storePath);
  }
}
