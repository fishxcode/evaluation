import fs from "node:fs/promises";
import crypto from "node:crypto";
import path from "node:path";
import { mergeCatalogApiAndLabs } from "./merge.js";
import { parseLabsFromHtml } from "./parse-labs.js";
import type { MergeInput, RawCatalog } from "./types.js";

export interface PipelineSourceDefinition {
  id: "api" | "catalog" | "labs";
  url: string;
  rawFileName: string;
}

export interface PipelineDownloadRequest {
  ifNoneMatch?: string | undefined;
}

export interface PipelineDownloadResult {
  body?: string | undefined;
  etag?: string | undefined;
  notModified?: boolean | undefined;
  durationMs: number;
}

export type PipelineDownloader = (
  source: PipelineSourceDefinition,
  request: PipelineDownloadRequest,
) => Promise<PipelineDownloadResult>;

export interface RefreshPipelineOptions {
  rootDir: string;
  now?: () => string;
  force?: boolean;
  downloader?: PipelineDownloader;
}

export interface RefreshPipelineResult {
  changed: boolean;
  contentHash: string;
  metadataPath: string;
  modelsPath: string;
}

interface SourceRuntimeStatus {
  url: string;
  status: "downloaded" | "skipped" | "cache-fallback";
  etag?: string | undefined;
  hash?: string | undefined;
  bytes: number;
  durationMs: number;
}

interface PreviousMetadata {
  fetchedAt: string;
  version?: string;
  contentHash?: string;
  sourceStatus?: Record<string, { etag?: string; hash?: string }>;
}

const SOURCES: PipelineSourceDefinition[] = [
  { id: "api", url: "https://models.dev/api.json", rawFileName: "api.json" },
  {
    id: "catalog",
    url: "https://models.dev/catalog.json",
    rawFileName: "catalog.json",
  },
  { id: "labs", url: "https://models.dev/labs/", rawFileName: "labs.html" },
];

function sha256(text: string) {
  return crypto.createHash("sha256").update(text).digest("hex");
}

function stableContentHash(value: unknown) {
  return sha256(
    JSON.stringify(value, (key, fieldValue) => {
      if (key === "fetchedAt") return undefined;
      return fieldValue;
    }),
  );
}

async function readJsonIfExists<T>(filePath: string): Promise<T | undefined> {
  try {
    return JSON.parse(await fs.readFile(filePath, "utf8")) as T;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return undefined;
    throw error;
  }
}

async function ensureDir(dir: string) {
  await fs.mkdir(dir, { recursive: true });
}

async function readTextIfExists(filePath: string): Promise<string | undefined> {
  try {
    return await fs.readFile(filePath, "utf8");
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return undefined;
    throw error;
  }
}

function createDefaultDownloader(): PipelineDownloader {
  return async (source, request) => {
    const headers: Record<string, string> = {};
    if (request.ifNoneMatch) headers["if-none-match"] = request.ifNoneMatch;
    const started = Date.now();
    const response = await fetch(source.url, { headers });
    const durationMs = Date.now() - started;
    if (response.status === 304) {
      return {
        notModified: true,
        etag: response.headers.get("etag") ?? undefined,
        durationMs,
      };
    }
    if (!response.ok) {
      throw new Error(
        `Failed to download ${source.id}: ${response.status} ${response.statusText}`,
      );
    }
    return {
      body: await response.text(),
      etag: response.headers.get("etag") ?? undefined,
      durationMs,
    };
  };
}

async function backupPreviousVersion(
  mergedDir: string,
  historyDir: string,
  version: string,
) {
  const modelsPath = path.join(mergedDir, "models.json");
  const metadataPath = path.join(mergedDir, "metadata.json");
  const models = await readTextIfExists(modelsPath);
  const metadata = await readTextIfExists(metadataPath);
  if (!models || !metadata) return;

  const snapshotDir = path.join(historyDir, version);
  await ensureDir(snapshotDir);
  await fs.writeFile(path.join(snapshotDir, "models.json"), models);
  await fs.writeFile(path.join(snapshotDir, "metadata.json"), metadata);
}

async function pruneHistory(historyDir: string, keep: number) {
  let entries: Array<{ name: string; fullPath: string; mtimeMs: number }> = [];
  try {
    const dirents = await fs.readdir(historyDir, { withFileTypes: true });
    entries = await Promise.all(
      dirents
        .filter((entry) => entry.isDirectory())
        .map(async (entry) => {
          const fullPath = path.join(historyDir, entry.name);
          const stat = await fs.stat(fullPath);
          return { name: entry.name, fullPath, mtimeMs: stat.mtimeMs };
        }),
    );
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return;
    throw error;
  }
  entries.sort((a, b) => b.mtimeMs - a.mtimeMs);
  for (const entry of entries.slice(keep)) {
    await fs.rm(entry.fullPath, { recursive: true, force: true });
  }
}

async function publishAtomically(
  mergedDir: string,
  modelsJson: string,
  metadataJson: string,
) {
  const tmpDir = path.join(mergedDir, `.tmp-${process.pid}-${Date.now()}`);
  await ensureDir(tmpDir);
  await fs.writeFile(path.join(tmpDir, "models.json"), modelsJson);
  await fs.writeFile(path.join(tmpDir, "metadata.json"), metadataJson);
  await fs.rename(
    path.join(tmpDir, "models.json"),
    path.join(mergedDir, "models.json"),
  );
  await fs.rename(
    path.join(tmpDir, "metadata.json"),
    path.join(mergedDir, "metadata.json"),
  );
  await fs.rm(tmpDir, { recursive: true, force: true });
}

async function loadSourceBodies(
  rootDir: string,
  previous: PreviousMetadata | undefined,
  force: boolean,
  downloader: PipelineDownloader,
): Promise<{
  bodies: Record<string, string>;
  statuses: Record<string, SourceRuntimeStatus>;
}> {
  const rawDir = path.join(rootDir, "data", "raw");
  await ensureDir(rawDir);

  const bodies: Record<string, string> = {};
  const statuses: Record<string, SourceRuntimeStatus> = {};

  for (const source of SOURCES) {
    const rawPath = path.join(rawDir, source.rawFileName);
    const previousSource = previous?.sourceStatus?.[source.id];
    const canSkip =
      !force && previousSource?.etag && (await readTextIfExists(rawPath));
    const request = canSkip ? { ifNoneMatch: previousSource?.etag } : {};
    const started = Date.now();

    try {
      const result = await downloader(source, request);
      if (result.notModified) {
        const cached = await readTextIfExists(rawPath);
        if (!cached)
          throw new Error(`Missing cached raw snapshot for ${source.id}`);
        bodies[source.id] = cached;
        statuses[source.id] = {
          url: source.url,
          status: "skipped",
          etag: previousSource?.etag ?? result.etag,
          hash: previousSource?.hash ?? sha256(cached),
          bytes: Buffer.byteLength(cached),
          durationMs: result.durationMs,
        };
        continue;
      }
      if (typeof result.body !== "string")
        throw new Error(`Downloader returned no body for ${source.id}`);
      await fs.writeFile(rawPath, result.body);
      const hash = sha256(result.body);
      const status = previousSource?.hash === hash ? "skipped" : "downloaded";
      bodies[source.id] = result.body;
      statuses[source.id] = {
        url: source.url,
        status,
        etag: result.etag,
        hash,
        bytes: Buffer.byteLength(result.body),
        durationMs: result.durationMs,
      };
      continue;
    } catch (error) {
      const cached = await readTextIfExists(rawPath);
      if (cached) {
        bodies[source.id] = cached;
        statuses[source.id] = {
          url: source.url,
          status: "cache-fallback",
          etag: previousSource?.etag,
          hash: previousSource?.hash ?? sha256(cached),
          bytes: Buffer.byteLength(cached),
          durationMs: Date.now() - started,
        };
        continue;
      }
      throw error;
    }
  }

  return { bodies, statuses };
}

/**
 * Run the data refresh pipeline.
 * 运行数据刷新管线。
 */
export async function refreshDataPipeline(
  options: RefreshPipelineOptions,
): Promise<RefreshPipelineResult> {
  const now = options.now ?? (() => new Date().toISOString());
  const downloader = options.downloader ?? createDefaultDownloader();
  const mergedDir = path.join(options.rootDir, "data", "merged");
  const historyDir = path.join(mergedDir, "history");
  await ensureDir(mergedDir);
  await ensureDir(historyDir);

  const previous = await readJsonIfExists<PreviousMetadata>(
    path.join(mergedDir, "metadata.json"),
  );
  const { bodies, statuses } = await loadSourceBodies(
    options.rootDir,
    previous,
    options.force ?? false,
    downloader,
  );

  const api = JSON.parse(bodies.api ?? "{}") as MergeInput["api"];
  const catalog = JSON.parse(
    bodies.catalog ?? '{"models":{},"providers":{}}',
  ) as RawCatalog;
  const labs = parseLabsFromHtml(bodies.labs ?? "", now());
  const dataset = mergeCatalogApiAndLabs({
    fetchedAt: now(),
    api,
    catalog,
    labs,
  });

  const contentHash = stableContentHash({
    models: dataset.models,
    labs: dataset.labs,
    providers: dataset.providers,
    conflicts: dataset.metadata.conflicts,
    quarantine: dataset.metadata.quarantine,
    sourceHashes: Object.fromEntries(
      Object.entries(statuses).map(([key, value]) => [key, value.hash]),
    ),
  });
  const metadata = {
    ...dataset.metadata,
    fetchedAt: now(),
    version: contentHash.slice(0, 12),
    contentHash,
    sourceStatus: Object.fromEntries(
      Object.entries(statuses).map(([key, value]) => [
        key,
        {
          url: value.url,
          status: value.status,
          etag: value.etag,
          hash: value.hash,
          bytes: value.bytes,
          durationMs: value.durationMs,
        },
      ]),
    ),
  };

  const payload = {
    ...dataset,
    metadata,
  };

  const modelsJson = JSON.stringify(payload, null, 2);
  const metadataJson = JSON.stringify(
    {
      ...metadata,
      modelCount: dataset.models.length,
      labCount: dataset.labs.length,
      providerCount: dataset.providers.length,
      quarantineCount: dataset.metadata.quarantine.length,
    },
    null,
    2,
  );

  const changed = Object.values(statuses).some(
    (status) => status.status === "downloaded",
  );
  if (previous) {
    await backupPreviousVersion(
      mergedDir,
      historyDir,
      previous.version ?? previous.contentHash ?? now(),
    );
  }
  await publishAtomically(mergedDir, modelsJson, metadataJson);
  await pruneHistory(historyDir, 5);

  return {
    changed,
    contentHash,
    metadataPath: path.join(mergedDir, "metadata.json"),
    modelsPath: path.join(mergedDir, "models.json"),
  };
}
