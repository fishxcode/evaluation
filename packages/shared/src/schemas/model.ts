/**
 * Central normalized Model schema — the single source of truth for the whole
 * platform. Combines canonical metadata (catalog.json), pricing offerings
 * (api.json), and lab info (labs search-index) into one entity.
 * 核心归一化 Model Schema——全平台的单一事实来源。将规范元数据、
 * 定价 offering 与 Lab 信息合并为一个实体。
 *
 * Design decisions documented in docs/schema-and-merge.md.
 * 设计决策见 docs/schema-and-merge.md。
 */
import { z } from 'zod';
import { modalitiesSchema, limitSchema, reasoningOptionSchema, isoDateSchema } from './primitives.js';
import { pricingSchema } from './pricing.js';
import { benchmarkResultSchema } from './benchmark.js';
import { labRefSchema, labSchema } from './lab.js';
import { sourceRefSchema, fieldOverrideSchema, fieldConflictSchema } from './source.js';

/**
 * Capability flags derived from boolean fields in the source data.
 * 由来源数据的布尔字段派生的能力标记。
 */
export const capabilitySchema = z.enum([
  'reasoning',
  'tool_call',
  'attachment',
  'structured_output',
  'temperature',
]);
export type Capability = z.infer<typeof capabilitySchema>;

/**
 * One provider's offering of a model — carries provider-specific pricing.
 * A single canonical model may have many offerings (multi-provider).
 * 某 provider 对一个模型的 offering——携带该 provider 的定价。
 * 一个规范模型可有多个 offering（多 provider）。
 */
export const providerOfferingSchema = z.object({
  /** Provider slug / Provider 标识 */
  providerId: z.string(),
  /** Provider display name / Provider 显示名 */
  providerName: z.string(),
  /** Provider-scoped model id (may differ from canonical slug) / provider 内模型 id */
  modelId: z.string(),
  /** Pricing for this offering (null = not published) / 该 offering 定价（null=未公布） */
  pricing: pricingSchema.nullable(),
  /** Provider-specific context/output limits if they differ / provider 特有限制 */
  limit: limitSchema.optional(),
  /** Deprecated/experimental status / 弃用/实验状态 */
  status: z.string().optional(),
  experimental: z.boolean().optional(),
});
export type ProviderOffering = z.infer<typeof providerOfferingSchema>;

/**
 * The normalized Model entity.
 * 归一化 Model 实体。
 */
export const modelSchema = z.object({
  /** Global unique id = "{lab}/{slug}" (rule documented in schema-and-merge.md) / 全局唯一 id */
  id: z.string(),
  /** URL-safe slug (short model name) / URL 友好短标识 */
  slug: z.string(),
  /** Display name / 显示名称 */
  name: z.string(),
  /** Description / 描述 */
  description: z.string().optional(),
  /** Model family, e.g. "gpt", "claude" / 模型家族 */
  family: z.string().optional(),
  /** Lab reference / Lab 引用 */
  lab: labRefSchema,
  /** Known aliases (from cross-source name variants) / 已知别名 */
  aliases: z.array(z.string()).default([]),
  /** Release date / 发布日期 */
  releaseDate: isoDateSchema.optional(),
  /** Last updated date / 最后更新日期 */
  lastUpdated: isoDateSchema.optional(),
  /** Knowledge cutoff / 知识截止 */
  knowledge: isoDateSchema.optional(),
  /** Token limits / token 限制 */
  limit: limitSchema.optional(),
  /** Input/output modalities / 输入输出模态 */
  modalities: modalitiesSchema,
  /** Capability flags / 能力标记 */
  capabilities: z.array(capabilitySchema).default([]),
  /** Reasoning control options / 推理控制选项 */
  reasoningOptions: z.array(reasoningOptionSchema).optional(),
  /** Open weights available / 是否开放权重 */
  openWeights: z.boolean(),
  /** Model card / license identifier (sparse: 8/263) / 许可证标识（稀疏） */
  license: z.string().optional(),
  /** Weight download links (HF etc.) / 权重下载链接 */
  weights: z
    .array(z.object({ label: z.string(), url: z.string() }))
    .optional(),
  /** External links (model card, announcement) / 外部链接 */
  links: z
    .array(z.object({ label: z.string(), url: z.string(), type: z.string().optional() }))
    .optional(),
  /** Benchmark results / 基准测试结果 */
  benchmarks: z.array(benchmarkResultSchema).default([]),
  /** Provider offerings with pricing / 带定价的 provider offering */
  offerings: z.array(providerOfferingSchema).default([]),
  /** Provenance: which sources contributed / 溯源：哪些来源贡献了数据 */
  sources: z.array(sourceRefSchema).default([]),
  /** Manual overrides (9.2.4) / 人工覆盖 */
  overrides: z.array(fieldOverrideSchema).optional(),
  /** Recorded merge conflicts (9.2.2) / 记录的 merge 冲突 */
  conflicts: z.array(fieldConflictSchema).optional(),
});
export type Model = z.infer<typeof modelSchema>;

/**
 * The full merged dataset shape written to merged/models.json.
 * 写入 merged/models.json 的完整合并数据集形态。
 */
export const mergedDatasetSchema = z.object({
  models: z.array(modelSchema),
  labs: z.array(labSchema),
});
export type MergedDataset = z.infer<typeof mergedDatasetSchema>;
