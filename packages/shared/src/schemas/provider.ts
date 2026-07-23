/**
 * Provider schema. A provider is an API endpoint that serves models
 * (may serve models from multiple labs). Derived from api.json/catalog.json
 * top-level provider objects — 169 providers.
 * Provider Schema。Provider 是提供模型服务的 API 端点（可服务多个 Lab 的模型）。
 * 来自 api.json/catalog.json 顶层 provider 对象——共 169 个。
 */
import { z } from 'zod';

/**
 * Normalized Provider entity.
 * 归一化的 Provider 实体。
 */
export const providerSchema = z.object({
  /** Provider slug, e.g. "openai", "openrouter" / Provider 标识 */
  id: z.string(),
  /** Display name / 显示名称 */
  name: z.string(),
  /** Required environment variable names / 所需环境变量名 */
  env: z.array(z.string()),
  /** AI SDK npm package / AI SDK npm 包名 */
  npm: z.string(),
  /** API base URL (absent in 24/169 providers) / API 基础 URL（24/169 缺失） */
  api: z.string().optional(),
  /** Documentation URL / 文档 URL */
  doc: z.string().optional(),
  /** Number of models this provider serves / 该 provider 服务的模型数 */
  modelCount: z.number().int().nonnegative().optional(),
});
export type Provider = z.infer<typeof providerSchema>;
