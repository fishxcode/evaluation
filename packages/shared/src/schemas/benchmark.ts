/**
 * Benchmark result value object. Derived from catalog.json `benchmarks[]`.
 * 基准测试结果值对象。来自 catalog.json 的 `benchmarks[]`。
 *
 * NOTE: the source key for the benchmark name is `name` (NOT `benchmark` as
 * the prompt template hinted) — schema adjusted to real data (铁律 2).
 * 注意：来源中基准名称字段是 `name`（并非 prompt 模板暗示的 `benchmark`），
 * Schema 以真实数据为准做了调整。
 */
import { z } from 'zod';
import { isoDateSchema } from './primitives.js';

/**
 * A single benchmark score for a model.
 * 单个模型的一条基准得分。
 */
export const benchmarkResultSchema = z.object({
  /** Benchmark name, e.g. "MMLU", "GPQA" / 基准名称 */
  name: z.string(),
  /** Numeric score / 数值得分 */
  score: z.number(),
  /** Source URL or citation / 来源 URL 或引用 */
  source: z.string(),
  /** Metric type, e.g. accuracy, pass@1 / 指标类型 */
  metric: z.string().optional(),
  /** Evaluation date / 评测日期 */
  date: isoDateSchema.optional(),
  /** Eval harness name / 评测框架名称 */
  harness: z.string().optional(),
  /** Variant label / 变体标签 */
  variant: z.string().optional(),
  /** Benchmark version / 基准版本 */
  version: z.string().optional(),
  /** Dataset name / 数据集名称 */
  dataset: z.string().optional(),
});
export type BenchmarkResult = z.infer<typeof benchmarkResultSchema>;
