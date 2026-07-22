import {
  BadRequestException,
  applyDecorators,
  type Type,
} from "@nestjs/common";
import {
  ApiExtraModels,
  ApiProperty,
  ApiPropertyOptional,
  ApiResponse,
} from "@nestjs/swagger";
import type { ModelListQuery } from "@models-dev/shared";
import { ModelListQuerySchema } from "@models-dev/shared";

/** Shared API response envelope.
 * 统一 API 响应包络。 */
export class ApiEnvelopeDto {
  @ApiProperty({
    nullable: true,
    oneOf: [
      { type: "object", additionalProperties: true },
      { type: "array", items: { type: "object", additionalProperties: true } },
      { type: "string" },
      { type: "number" },
      { type: "boolean" },
    ],
    description: "Response payload.\n响应数据。",
  })
  data!: unknown;

  @ApiProperty({
    type: "object",
    additionalProperties: true,
    description: "Pagination and request metadata.\n分页与请求元数据。",
  })
  meta!: Record<string, unknown>;

  @ApiProperty({
    nullable: true,
    oneOf: [
      {
        type: "object",
        required: ["code", "message"],
        properties: {
          code: { type: "string" },
          message: { type: "string" },
        },
      },
    ],
    description:
      "Structured error, null on success.\n结构化错误，成功时为 null。",
  })
  error!: null | { code: string; message: string };
}

interface ApiEnvelopeResponseOptions {
  status?: number;
  description?: string;
  dataSchema?: Record<string, unknown>;
  models?: Array<Type<unknown>>;
}

const defaultDataSchema = {
  nullable: true,
  oneOf: [
    { type: "object", additionalProperties: true },
    { type: "array", items: { type: "object", additionalProperties: true } },
    { type: "string" },
    { type: "number" },
    { type: "boolean" },
  ],
};

/** Document the shared response envelope without reflecting TypeScript generics.
 * 不反射 TypeScript 泛型，直接声明统一响应包络的 OpenAPI schema。 */
export function ApiEnvelopeResponse(options: ApiEnvelopeResponseOptions = {}) {
  const models = options.models ?? [];
  const responseOptions = {
    ...(options.description ? { description: options.description } : {}),
    status: options.status ?? 200,
    schema: {
      type: "object",
      required: ["data", "meta", "error"],
      properties: {
        data: options.dataSchema ?? defaultDataSchema,
        meta: {
          type: "object",
          additionalProperties: true,
          description: "Pagination and request metadata.\n分页与请求元数据。",
        },
        error: {
          nullable: true,
          oneOf: [
            {
              type: "object",
              required: ["code", "message"],
              properties: {
                code: { type: "string" },
                message: { type: "string" },
              },
            },
          ],
          description:
            "Structured error, null on success.\n结构化错误，成功时为 null。",
        },
      },
    },
  };
  const responseDecorator = ApiResponse({
    ...responseOptions,
  });
  if (!models.length) return applyDecorators(responseDecorator);
  return applyDecorators(ApiExtraModels(...models), responseDecorator);
}

/** Query DTO for model listing.
 * 模型列表查询 DTO。 */
export class ModelListQueryDto {
  @ApiPropertyOptional({
    minimum: 1,
    description: "One-based page number.\n从 1 开始的页码。",
  })
  page?: number;

  @ApiPropertyOptional({
    minimum: 1,
    maximum: 100,
    description:
      "Page size, must stay between 1 and 100.\n分页大小必须介于 1 和 100 之间。",
  })
  pageSize?: number;

  @ApiPropertyOptional({
    description:
      "Text query matched against name, id, aliases, and description.\n文本搜索，匹配名称、ID、别名与描述。",
  })
  q?: string;

  @ApiPropertyOptional({ description: "Canonical lab id.\n规范 Lab ID。" })
  lab?: string;

  @ApiPropertyOptional({
    description:
      "Provider id served by any offering.\n任一 offering 对应的 Provider ID。",
  })
  provider?: string;

  @ApiPropertyOptional({
    description:
      "Capability key such as reasoning or toolCall.\n能力字段，例如 reasoning 或 toolCall。",
  })
  capability?: string;

  @ApiPropertyOptional({
    description: "Input or output modality.\n输入或输出模态。",
  })
  modality?: string;

  @ApiPropertyOptional({ description: "Open weights filter.\n开源权重筛选。" })
  openWeights?: string;

  @ApiPropertyOptional({ description: "License string.\n许可证字符串。" })
  license?: string;

  @ApiPropertyOptional({ description: "Architecture string.\n架构字符串。" })
  architecture?: string;

  @ApiPropertyOptional({ description: "Release year.\n发布日期年份。" })
  releaseYear?: string;

  @ApiPropertyOptional({
    description: "Context window band.\n上下文窗口区间。",
  })
  contextBand?: string;

  @ApiPropertyOptional({ description: "Price band.\n价格区间。" })
  priceBand?: string;

  @ApiPropertyOptional({ description: "Benchmark name.\nBenchmark 名称。" })
  benchmark?: string;

  @ApiPropertyOptional({
    description:
      "Sort key: name, releaseDate, context, price, benchmark.\n排序字段：name、releaseDate、context、price、benchmark。",
  })
  sort?: string;

  @ApiPropertyOptional({ description: "Sort order.\n排序方向。" })
  order?: "asc" | "desc";
}

/** Parse and validate the model list query using the shared Zod schema.
 * 使用共享 Zod schema 解析并校验模型列表查询参数。 */
export function parseModelListQuery(query: ModelListQueryDto): ModelListQuery {
  const result = ModelListQuerySchema.safeParse(query);
  if (!result.success) {
    throw new BadRequestException(
      result.error.issues
        .map((issue) => `${issue.path.join(".") || "query"}: ${issue.message}`)
        .join("; "),
    );
  }
  return result.data;
}

/** Refresh result DTO.
 * 刷新结果 DTO。 */
export class RefreshResultDto {
  @ApiProperty({
    description: "Whether source content changed.\n源内容是否变化。",
  })
  changed!: boolean;

  @ApiProperty({
    description: "Stable normalized content hash.\n稳定的归一化内容哈希。",
  })
  contentHash!: string;
}

/** Health status DTO.
 * 健康检查 DTO。 */
export class StatusDto {
  @ApiProperty({
    example: "ok",
    description: "Service liveness state.\n服务存活状态。",
  })
  status!: "ok";

  @ApiPropertyOptional({ description: "Current data version.\n当前数据版本。" })
  version?: string;

  @ApiPropertyOptional({
    description: "Current dataset content hash.\n当前数据集内容哈希。",
  })
  contentHash?: string;

  @ApiProperty({
    description:
      "Last successful dataset update time.\n最近一次成功数据更新时间。",
  })
  updatedAt!: string;

  @ApiProperty({
    description:
      "Recent status for each upstream source.\n各上游数据源最近状态。",
  })
  sourceStatus!: Record<string, unknown>;
}
