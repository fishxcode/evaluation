import { z } from "zod";

const stringArray = z.array(z.string());

/** Shared pagination query contract for every list endpoint.
 * 所有列表端点复用的分页查询契约。 */
export const PaginationQuerySchema = z
  .object({
    page: z.coerce
      .number()
      .int("page must be an integer")
      .min(1, "page must be at least 1")
      .default(1),
    pageSize: z.coerce
      .number()
      .int("pageSize must be an integer")
      .min(1, "pageSize must be between 1 and 100")
      .max(100, "pageSize must be between 1 and 100")
      .default(20),
  })
  .describe(
    "One-based pagination query with a hard pageSize upper bound of 100.\n从 1 开始分页，pageSize 强制上限为 100。",
  );

/** Public model list query, extending pagination with filter and sort fields.
 * 公开模型列表查询，在分页基础上扩展筛选与排序字段。 */
export const ModelListQuerySchema = PaginationQuerySchema.extend({
  q: z.string().optional(),
  lab: z.string().optional(),
  provider: z.string().optional(),
  capability: z.string().optional(),
  modality: z.string().optional(),
  openWeights: z.string().optional(),
  license: z.string().optional(),
  architecture: z.string().optional(),
  releaseYear: z.string().optional(),
  contextBand: z.string().optional(),
  priceBand: z.string().optional(),
  benchmark: z.string().optional(),
  sort: z
    .enum(["name", "releaseDate", "context", "price", "benchmark"])
    .optional(),
  order: z.enum(["asc", "desc"]).optional(),
}).describe(
  "Model list filters and a single-column sort contract.\n模型列表筛选与单列排序契约。",
);

export const SourceRefSchema = z
  .object({
    source: z.string().min(1),
    fetchedAt: z.string().min(1),
    url: z.string().url().optional(),
    etag: z.string().optional(),
    note: z.string().optional(),
  })
  .strict();

export const LabRefSchema = z
  .object({
    id: z.string().min(1),
    name: z.string().min(1),
  })
  .strict();

export const PricingSchema = z
  .object({
    input: z.number().nonnegative().optional(),
    cachedInput: z.number().nonnegative().optional(),
    output: z.number().nonnegative().optional(),
    reasoning: z.number().nonnegative().optional(),
    inputAudio: z.number().nonnegative().optional(),
    outputAudio: z.number().nonnegative().optional(),
  })
  .strict();

export const BenchmarkResultSchema = z
  .object({
    benchmark: z.string().min(1),
    score: z.number(),
    metric: z.string().optional(),
    source: z.string().url().optional(),
    date: z.string().optional(),
  })
  .strict();

export const ProviderSchema = z
  .object({
    id: z.string().min(1),
    name: z.string().min(1),
    api: z.string().optional(),
    doc: z.string().optional(),
  })
  .strict();

export const ProviderOfferingSchema = z
  .object({
    provider: ProviderSchema,
    providerModelId: z.string().min(1),
    pricing: PricingSchema.optional(),
    api: z.string().optional(),
    status: z.string().optional(),
    source: SourceRefSchema.optional(),
  })
  .strict();

export const ModelSchema = z
  .object({
    id: z.string().min(1),
    slug: z.string().min(1),
    name: z.string().min(1),
    description: z.string().min(1),
    family: z.string().optional(),
    lab: LabRefSchema,
    aliases: z.array(z.string()),
    releaseDate: z.string().optional(),
    lastUpdated: z.string().optional(),
    contextWindow: z
      .object({
        input: z.number().nonnegative().optional(),
        output: z.number().nonnegative().optional(),
        total: z.number().nonnegative().optional(),
      })
      .strict()
      .optional(),
    modalities: z
      .object({
        input: stringArray,
        output: stringArray,
      })
      .strict()
      .optional(),
    capabilities: z
      .object({
        reasoning: z.boolean(),
        toolCall: z.boolean(),
        structuredOutput: z.boolean().optional(),
        attachment: z.boolean().optional(),
        temperature: z.boolean().optional(),
        openWeights: z.boolean().optional(),
      })
      .strict(),
    architecture: z.string().optional(),
    license: z.string().optional(),
    openWeights: z.boolean(),
    benchmarks: z.array(BenchmarkResultSchema),
    offerings: z.array(ProviderOfferingSchema),
    sources: z.array(SourceRefSchema),
  })
  .strict();

export const LabSchema = z
  .object({
    id: z.string().min(1),
    name: z.string().min(1),
    slug: z.string().min(1),
    href: z.string().min(1).optional(),
    logo: z.string().min(1).optional(),
    description: z.string().optional(),
    modelCount: z.number().int().nonnegative().optional(),
    providerCount: z.number().int().nonnegative().optional(),
    releaseDate: z.string().optional(),
    updatedAt: z.string().optional(),
    tokens: z.array(z.string()),
    sources: z.array(SourceRefSchema),
  })
  .strict();

export const MetadataSchema = z
  .object({
    fetchedAt: z.string().min(1),
    contentHash: z.string().min(1).optional(),
    version: z.string().min(1).optional(),
    sourceStatus: z
      .record(
        z
          .object({
            url: z.string().url(),
            status: z
              .enum(["downloaded", "skipped", "cache-fallback", "failed"])
              .default("downloaded"),
            etag: z.string().optional(),
            hash: z.string().min(1).optional(),
            bytes: z.number().int().nonnegative(),
            durationMs: z.number().int().nonnegative().optional(),
          })
          .strict(),
      )
      .default({}),
    conflicts: z.array(
      z
        .object({
          modelId: z.string().min(1),
          field: z.string().min(1),
          source: z.string().min(1),
          note: z.string().min(1),
        })
        .strict(),
    ),
    quarantine: z.array(
      z
        .object({
          id: z.string().min(1),
          reason: z.string().min(1),
          issues: z.array(z.string()),
        })
        .strict(),
    ),
  })
  .strict();

export const NormalizedDatasetSchema = z
  .object({
    models: z.array(ModelSchema),
    labs: z.array(LabSchema),
    providers: z.array(ProviderSchema),
    metadata: MetadataSchema,
  })
  .strict();

export type SourceRef = z.infer<typeof SourceRefSchema>;
export type LabRef = z.infer<typeof LabRefSchema>;
export type Pricing = z.infer<typeof PricingSchema>;
export type BenchmarkResult = z.infer<typeof BenchmarkResultSchema>;
export type Provider = z.infer<typeof ProviderSchema>;
export type ProviderOffering = z.infer<typeof ProviderOfferingSchema>;
export type Model = z.infer<typeof ModelSchema>;
export type Lab = z.infer<typeof LabSchema>;
export type Metadata = z.infer<typeof MetadataSchema>;
export type NormalizedDataset = z.infer<typeof NormalizedDatasetSchema>;
export type PaginationQuery = z.infer<typeof PaginationQuerySchema>;
export type ModelListQuery = z.infer<typeof ModelListQuerySchema>;
