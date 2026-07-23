/**
 * API contract schemas: pagination, query parameters, response envelope.
 * API 契约 Schema：分页、查询参数、响应包络。
 *
 * Shared by both the NestJS backend (DTO validation) and frontend (type safety).
 * 前后端共用——后端用于 DTO 校验，前端用于类型安全。
 */
import { z } from 'zod';

/** -----------------------------------------------------------------------
 * Pagination (8.1 分页契约)
 * ----------------------------------------------------------------------- */

/**
 * pageSize is capped at 100 (per 8.1). Exceeding returns 400, NEVER silent
 * truncation. Default = 20.
 * pageSize 上限强制 100（见 8.1）。超限返回 400，绝不静默截断。默认 20。
 * @example { page: 1, pageSize: 20 }
 */
export const paginationQuerySchema = z.object({
  page: z.coerce
    .number()
    .int()
    .min(1, 'page must be >= 1')
    .default(1)
    .describe('Page number starting at 1 / 页码，从 1 开始'),
  pageSize: z.coerce
    .number()
    .int()
    .min(1, 'pageSize must be between 1 and 100')
    .max(100, 'pageSize must be between 1 and 100')
    .default(20)
    .describe('Items per page, 1-100 / 每页条数，1-100'),
});
export type PaginationQuery = z.infer<typeof paginationQuerySchema>;

/**
 * Pagination metadata returned in every list response.
 * 每个列表响应中返回的分页元数据。
 */
export const paginationMetaSchema = z.object({
  page: z.number().int(),
  pageSize: z.number().int(),
  total: z.number().int(),
  totalPages: z.number().int(),
});
export type PaginationMeta = z.infer<typeof paginationMetaSchema>;

/** -----------------------------------------------------------------------
 * Unified response envelope (8.1)
 * 统一响应包络
 * ----------------------------------------------------------------------- */

export const apiErrorSchema = z.object({
  code: z.string().describe('Machine-readable error code / 机器可读错误码'),
  message: z.string().describe('Human-readable message / 人类可读消息'),
  details: z.unknown().optional(),
});
export type ApiError = z.infer<typeof apiErrorSchema>;

/**
 * Generic API response envelope { data, meta, error }.
 * 通用 API 响应包络 { data, meta, error }。
 */
export type ApiResponse<T> = {
  data: T | null;
  meta?: PaginationMeta;
  error?: ApiError;
};

/** -----------------------------------------------------------------------
 * Model list query params (GET /models)
 * 模型列表查询参数
 * ----------------------------------------------------------------------- */

export const sortOrderSchema = z.enum(['asc', 'desc']);
export type SortOrder = z.infer<typeof sortOrderSchema>;

/**
 * Sortable fields for model listings (10.5).
 * 模型列表可排序字段。
 */
export const modelSortFieldSchema = z.enum([
  'name',
  'releaseDate',
  'price', // sort by min(offerings[*].pricing.input)
  'context', // sort by limit.context
  'benchmark', // sort by max benchmark score
  'lastUpdated',
]);
export type ModelSortField = z.infer<typeof modelSortFieldSchema>;

/**
 * Full query params for GET /models.
 * GET /models 的完整查询参数。
 */
export const modelQuerySchema = paginationQuerySchema.extend({
  q: z.string().optional().describe('Full-text / fuzzy search / 全文/模糊搜索'),
  lab: z.string().optional().describe('Filter by lab slug / 按 Lab 过滤'),
  provider: z.string().optional().describe('Filter by provider id / 按 Provider 过滤'),
  capability: z.string().optional().describe('Filter by capability / 按能力过滤'),
  modality: z.string().optional().describe('Filter by input modality / 按输入模态过滤'),
  openWeights: z.coerce.boolean().optional().describe('Filter by open weights / 按开放权重过滤'),
  minContext: z.coerce.number().optional().describe('Min context window / 最小上下文'),
  maxContext: z.coerce.number().optional().describe('Max context window / 最大上下文'),
  minPrice: z.coerce.number().optional().describe('Min input price USD/1M / 最低输入单价'),
  maxPrice: z.coerce.number().optional().describe('Max input price USD/1M / 最高输入单价'),
  sort: modelSortFieldSchema.optional(),
  order: sortOrderSchema.optional().default('asc'),
});
export type ModelQuery = z.infer<typeof modelQuerySchema>;

/** -----------------------------------------------------------------------
 * Filter facets (GET /filters — drives frontend filter dropdowns)
 * 筛选维度 (GET /filters——驱动前端筛选 UI)
 * ----------------------------------------------------------------------- */

export type FilterFacets = {
  labs: Array<{ id: string; name: string; count: number }>;
  providers: Array<{ id: string; name: string; count: number }>;
  capabilities: Array<{ value: string; count: number }>;
  modalities: Array<{ value: string; count: number }>;
  licenses: Array<{ value: string; count: number }>;
  contextRange: { min: number; max: number };
  priceRange: { min: number; max: number };
};
