/**
 * Pricing value objects. Derived from api.json `cost` field (real data).
 * 定价值对象。来自 api.json 的 `cost` 字段（真实数据）。
 *
 * All monetary values are USD per 1,000,000 tokens unless noted.
 * 所有金额单位为「美元 / 每百万 token」，除非特别说明。
 */
import { z } from 'zod';

/**
 * A single tiered pricing entry (volume-based). Observed in 252/5352 offerings.
 * 单条阶梯定价（按用量）。在 252/5352 条 offering 中出现。
 */
export const priceTierSchema = z.object({
  /** Upper token threshold for this tier / 本档位 token 上限 */
  context: z.number().optional(),
  input: z.number().optional(),
  output: z.number().optional(),
});
export type PriceTier = z.infer<typeof priceTierSchema>;

/**
 * Full pricing object for one provider offering. Every field except
 * input/output is optional because sources populate them sparsely
 * (see docs/data-source-analysis.md §2 cost subfields).
 * 单个 provider offering 的完整定价。除 input/output 外全部可选，
 * 因为来源填充稀疏（见分析文档 §2）。
 */
export const pricingSchema = z.object({
  /** USD / 1M input tokens / 每百万输入 token 美元 */
  input: z.number().nonnegative().optional(),
  /** USD / 1M output tokens / 每百万输出 token 美元 */
  output: z.number().nonnegative().optional(),
  /** USD / 1M cached-read tokens / 每百万缓存读取 token 美元 */
  cacheRead: z.number().nonnegative().optional(),
  /** USD / 1M cache-write tokens / 每百万缓存写入 token 美元 */
  cacheWrite: z.number().nonnegative().optional(),
  /** USD / 1M reasoning tokens / 每百万推理 token 美元 */
  reasoning: z.number().nonnegative().optional(),
  /** USD / 1M audio input tokens / 每百万音频输入 token 美元 */
  inputAudio: z.number().nonnegative().optional(),
  /** USD / 1M audio output tokens / 每百万音频输出 token 美元 */
  outputAudio: z.number().nonnegative().optional(),
  /**
   * Surcharge for context beyond 200k tokens. In real data this is EITHER a
   * flat number OR a nested {input,output,cache_read} pricing object — schema
   * accepts both (铁律 2).
   * 超 200k 上下文加价。真实数据中既可能是单个数字，也可能是嵌套的
   * {input,output,cache_read} 定价对象——Schema 两者都接受。
   */
  contextOver200k: z
    .union([
      z.number().nonnegative(),
      z.object({
        input: z.number().optional(),
        output: z.number().optional(),
        cacheRead: z.number().optional(),
        cacheWrite: z.number().optional(),
      }),
    ])
    .optional(),
  /** Volume-tiered pricing / 阶梯定价 */
  tiers: z.array(priceTierSchema).optional(),
});
export type Pricing = z.infer<typeof pricingSchema>;
