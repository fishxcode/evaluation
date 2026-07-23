/**
 * Dataset metadata schema — written by the pipeline into merged/metadata.json
 * and surfaced by GET /metadata and GET /status (8.1).
 * 数据集元数据 Schema——由管线写入 merged/metadata.json，
 * 并由 GET /metadata 与 GET /status 暴露。
 */
import { z } from 'zod';
import { isoDateSchema, } from './primitives.js';
import { sourceKindSchema } from './source.js';

/**
 * Per-source fetch status for health monitoring (9.2.3).
 * 单来源抓取状态，用于健康监控。
 */
export const sourceStatusSchema = z.object({
  kind: sourceKindSchema,
  /** Last successful fetch time / 最近成功抓取时间 */
  lastFetchedAt: isoDateSchema.optional(),
  /** ETag/content hash of last snapshot / 最近快照的 etag/hash */
  etag: z.string().optional(),
  /** Content hash / 内容哈希 */
  hash: z.string().optional(),
  /** Fetch duration ms / 抓取耗时(ms) */
  durationMs: z.number().optional(),
  /** ok | failed | skipped / 状态 */
  status: z.enum(['ok', 'failed', 'skipped']),
  /** Consecutive failure count / 连续失败次数 */
  consecutiveFailures: z.number().int().default(0),
  /** Error message if failed / 失败信息 */
  error: z.string().optional(),
});
export type SourceStatus = z.infer<typeof sourceStatusSchema>;

/**
 * Full dataset metadata.
 * 完整数据集元数据。
 */
export const datasetMetadataSchema = z.object({
  /** Monotonic data version (increments each successful merge) / 数据版本号 */
  version: z.number().int(),
  /** When this version was built / 本版本构建时间 */
  builtAt: isoDateSchema,
  /** Content hash of merged models.json / merged 内容哈希 */
  contentHash: z.string(),
  /** Total model count / 模型总数 */
  modelCount: z.number().int(),
  /** Total lab count / Lab 总数 */
  labCount: z.number().int(),
  /** Total provider count / Provider 总数 */
  providerCount: z.number().int(),
  /** Per-source status / 各来源状态 */
  sources: z.array(sourceStatusSchema),
  /** Number of records quarantined (failed validation) / 隔离记录数 */
  quarantinedCount: z.number().int().default(0),
});
export type DatasetMetadata = z.infer<typeof datasetMetadataSchema>;

/**
 * Health/status payload for GET /status (8.1) — used by container HEALTHCHECK.
 * GET /status 的健康负载——供容器 HEALTHCHECK 使用。
 */
export const statusSchema = z.object({
  status: z.enum(['ok', 'degraded', 'error']),
  uptime: z.number(),
  dataVersion: z.number().int().optional(),
  lastUpdated: isoDateSchema.optional(),
  sources: z.array(sourceStatusSchema).optional(),
});
export type Status = z.infer<typeof statusSchema>;
