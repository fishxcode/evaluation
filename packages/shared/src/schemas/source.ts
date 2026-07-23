/**
 * Source provenance and manual-override schemas. These record WHERE each
 * piece of data came from and support the Admin Console manual-override
 * feature (9.2.4). Designed in Phase 1 per 铁律 3 (not deferred).
 * 来源溯源与人工覆盖 Schema。记录每条数据来自哪里，并支撑 Admin Console
 * 的人工覆盖功能（9.2.4）。按铁律要求在 Phase 1 一并定稿，不留到后期补。
 */
import { z } from 'zod';
import { isoDateSchema } from './primitives.js';

/**
 * The three real data sources plus a slot for future adapters.
 * 三个真实数据源，外加未来 adapter 预留。
 */
export const sourceKindSchema = z.enum(['api', 'catalog', 'labs', 'manual']);
export type SourceKind = z.infer<typeof sourceKindSchema>;

/**
 * A provenance record: which source contributed data and when it was fetched.
 * 溯源记录：哪个来源贡献了数据、何时抓取。
 */
export const sourceRefSchema = z.object({
  kind: sourceKindSchema,
  /** When this source snapshot was fetched / 该来源快照抓取时间 */
  fetchedAt: isoDateSchema.optional(),
  /** ETag of the source snapshot / 来源快照 etag */
  etag: z.string().optional(),
});
export type SourceRef = z.infer<typeof sourceRefSchema>;

/**
 * A manual field override applied by an admin (9.2.4). Overrides win over
 * source values during merge and survive subsequent auto-refreshes.
 * 管理员施加的字段级人工覆盖。Merge 时覆盖值优先于来源值，
 * 且在后续自动刷新中不被覆盖回去。
 */
export const fieldOverrideSchema = z.object({
  /** Dotted field path, e.g. "lab.description" / 点号字段路径 */
  field: z.string(),
  /** The override value (JSON) / 覆盖值 */
  value: z.unknown(),
  /** Original source value before override / 覆盖前的来源原值 */
  originalValue: z.unknown().optional(),
  /** Who applied it / 操作人 */
  updatedBy: z.string(),
  /** When applied / 操作时间 */
  updatedAt: isoDateSchema,
});
export type FieldOverride = z.infer<typeof fieldOverrideSchema>;

/**
 * A recorded merge conflict (9.2.2): a field where sources disagreed and
 * how it was resolved. Stored in model metadata, queryable by Admin API.
 * 记录的 Merge 冲突：多来源对某字段取值不一致及最终裁决。
 * 存入模型元数据，可经 Admin API 查询。
 */
export const fieldConflictSchema = z.object({
  /** Field path in conflict / 冲突字段路径 */
  field: z.string(),
  /** Candidate values keyed by source / 各来源候选值 */
  candidates: z.array(
    z.object({
      source: sourceKindSchema,
      value: z.unknown(),
    }),
  ),
  /** Which source won / 采纳的来源 */
  resolvedFrom: sourceKindSchema,
});
export type FieldConflict = z.infer<typeof fieldConflictSchema>;
