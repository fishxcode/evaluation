/**
 * Lab (model developer / research org) schema. Derived from the labs
 * search-index (data/raw/labs.json), 24 entries.
 * 实验室（模型开发方/研究机构）Schema。来自 labs 搜索索引，24 条。
 *
 * IMPORTANT: `founded` and `website` are ABSENT in all sources — declared
 * optional and must never be fabricated (铁律 2).
 * 重要：`founded` 与 `website` 在所有来源中缺失——声明为可选，禁止编造。
 */
import { z } from 'zod';
import { isoDateSchema } from './primitives.js';

/**
 * Normalized Lab entity.
 * 归一化的 Lab 实体。
 */
export const labSchema = z.object({
  /** Lab slug, e.g. "openai" / Lab 标识 */
  id: z.string(),
  /** Display name, e.g. "OpenAI" / 显示名称 */
  name: z.string(),
  /** Logo path, e.g. "/logos/labs/openai.svg" / Logo 路径 */
  logo: z.string().optional(),
  /** 1–2 sentence description / 简介 */
  description: z.string().optional(),
  /** Number of models attributed to this lab / 旗下模型数 */
  modelCount: z.number().int().nonnegative(),
  /** Number of providers serving this lab's models / 服务其模型的 provider 数 */
  providerCount: z.number().int().nonnegative(),
  /** Latest model release date under this lab / 旗下最新模型发布日期 */
  releaseDate: isoDateSchema.optional(),
  /** Last updated date / 最后更新日期 */
  updated: isoDateSchema.optional(),
  /** Founded year — ABSENT in source data, always optional / 成立年份——来源缺失 */
  founded: z.string().optional(),
  /** Official website — ABSENT in source data, always optional / 官网——来源缺失 */
  website: z.string().url().optional(),
});
export type Lab = z.infer<typeof labSchema>;

/**
 * Lightweight lab reference embedded in Model entities.
 * 内嵌于 Model 实体的轻量 Lab 引用。
 */
export const labRefSchema = z.object({
  id: z.string(),
  name: z.string(),
  logo: z.string().optional(),
});
export type LabRef = z.infer<typeof labRefSchema>;
