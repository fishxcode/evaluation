/**
 * Primitive enums and value objects shared across the normalized model schema.
 * 归一化模型 Schema 复用的基础枚举与值对象。
 *
 * All enum value domains are derived from the real Phase 0 data snapshot
 * (data/raw/*), never invented. See docs/data-source-analysis.md.
 * 所有枚举取值域均来自 Phase 0 真实数据快照，绝不虚构。
 */
import { z } from 'zod';

/**
 * Input/output modality. Observed values in api.json/catalog.json.
 * 输入/输出模态。取值来自 api.json/catalog.json 实际观测。
 */
export const modalitySchema = z.enum(['text', 'image', 'pdf', 'video', 'audio']);
export type Modality = z.infer<typeof modalitySchema>;

/**
 * Reasoning control style exposed by a model.
 * 模型暴露的推理控制方式。
 * - effort: low/medium/high 档位
 * - toggle: 开/关
 * - budget_tokens: 预算 token 数
 */
export const reasoningOptionTypeSchema = z.enum(['effort', 'toggle', 'budget_tokens']);
export type ReasoningOptionType = z.infer<typeof reasoningOptionTypeSchema>;

/**
 * A single reasoning option descriptor.
 * 单条推理选项描述。
 */
export const reasoningOptionSchema = z.object({
  /** Control type / 控制类型 */
  type: reasoningOptionTypeSchema,
  /** Allowed values when type=effort / effort 档位可选值 */
  values: z.array(z.string()).optional(),
});
export type ReasoningOption = z.infer<typeof reasoningOptionSchema>;

/**
 * Modalities value object: input and output modality lists.
 * 模态值对象：输入与输出模态列表。
 */
export const modalitiesSchema = z.object({
  input: z.array(modalitySchema),
  output: z.array(modalitySchema),
});
export type Modalities = z.infer<typeof modalitiesSchema>;

/**
 * Token limits. `input` is optional (present in only ~1107/5751 offerings).
 * Token 限制。`input` 可选（仅约 1107/5751 条 offering 具备）。
 */
export const limitSchema = z.object({
  /** Total context window in tokens / 上下文窗口（token） */
  context: z.number().nonnegative(),
  /** Max output tokens / 最大输出 token */
  output: z.number().nonnegative(),
  /** Max input tokens (optional) / 最大输入 token（可选） */
  input: z.number().nonnegative().optional(),
});
export type Limit = z.infer<typeof limitSchema>;

/**
 * ISO 8601 date string (date-only or datetime). Kept as string to preserve
 * source fidelity; not coerced to Date to avoid timezone drift.
 * ISO 8601 日期字符串。保留字符串以忠实来源，不强转 Date 避免时区漂移。
 */
export const isoDateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}([T ].*)?$/, 'must be ISO 8601 date');
export type IsoDate = z.infer<typeof isoDateSchema>;
