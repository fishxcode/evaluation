import {
  BenchmarkResultSchema,
  LabSchema,
  MetadataSchema,
  ModelSchema,
  NormalizedDatasetSchema,
  ProviderOfferingSchema,
  ProviderSchema,
  type Metadata,
  type Model,
  type Provider,
} from "@models-dev/shared";
import type {
  MergeInput,
  MergeResult,
  RawApiModel,
  RawCatalogModel,
  RawCatalogProvider,
  RawApiProvider,
} from "./types.js";

function slugify(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/@.*$/, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function sourceRef(
  source: string,
  fetchedAt: string,
  url: string,
  etag?: string,
  note?: string,
) {
  return { source, fetchedAt, url, etag, note };
}

function pickContext(limit: Record<string, number>) {
  return {
    input: typeof limit.input === "number" ? limit.input : undefined,
    output: typeof limit.output === "number" ? limit.output : undefined,
    total: typeof limit.context === "number" ? limit.context : undefined,
  };
}

function buildLabRef(
  id: string,
  labs: MergeInput["labs"],
): { id: string; name: string } {
  const existing = labs.find((lab) => lab.id === id);
  if (existing) {
    return { id: existing.id, name: existing.name };
  }
  return {
    id,
    name: id,
  };
}

function normalizeProvider(
  provider: RawApiProvider | RawCatalogProvider,
): Provider {
  return ProviderSchema.parse({
    id: provider.id,
    name: provider.name,
    api: provider.api,
    doc: provider.doc,
  });
}

function normalizeBenchmarks(
  benchmarks: RawCatalogModel["benchmarks"] | undefined,
) {
  return (benchmarks ?? []).map((benchmark) =>
    BenchmarkResultSchema.parse({
      benchmark: benchmark.name,
      score: benchmark.score,
      metric: benchmark.metric,
      source: benchmark.source,
      date: benchmark.date,
    }),
  );
}

function normalizeModelFromCatalog(
  modelId: string,
  model: RawCatalogModel,
  labs: MergeInput["labs"],
  fetchedAt: string,
): Model {
  const labId = modelId.split("/")[0] ?? "unknown";
  const lab = buildLabRef(labId, labs);
  return ModelSchema.parse({
    id: model.id,
    slug: modelId.split("/").at(-1) ?? model.id,
    name: model.name,
    description: model.description,
    family: model.family,
    lab: { id: lab.id, name: lab.name },
    aliases: [model.id, model.name].filter(
      (value, index, array) => array.indexOf(value) === index,
    ),
    releaseDate: model.release_date,
    lastUpdated: model.last_updated,
    contextWindow: pickContext(model.limit),
    modalities: model.modalities,
    capabilities: {
      reasoning: model.reasoning,
      toolCall: model.tool_call,
      structuredOutput: model.structured_output,
      attachment: model.attachment,
      temperature: model.temperature,
      openWeights: model.open_weights,
    },
    architecture: undefined,
    license: model.license,
    openWeights: model.open_weights,
    benchmarks: normalizeBenchmarks(model.benchmarks),
    offerings: [],
    sources: [
      sourceRef(
        "models.dev/catalog",
        fetchedAt,
        "https://models.dev/catalog.json",
      ),
    ],
  });
}

function normalizePricing(cost: RawApiModel["cost"]) {
  if (!cost) return undefined;
  const pricing = {
    input: cost.input,
    cachedInput: cost.cache_read,
    output: cost.output,
    reasoning: cost.reasoning,
    inputAudio: cost.input_audio,
    outputAudio: cost.output_audio,
  };
  return Object.values(pricing).some((value) => value !== undefined)
    ? pricing
    : undefined;
}

function resolveCanonicalId(
  providerId: string,
  model: RawApiModel,
  catalogModels: Record<string, RawCatalogModel>,
  normalizedNameIndex: Map<string, string>,
) {
  const exactCandidates = [
    model.id,
    `${providerId}/${model.id}`,
    model.id.replace(/@.*$/, ""),
    `${providerId}/${model.id.replace(/@.*$/, "")}`,
    `${providerId}/${slugify(model.name)}`,
  ];
  for (const candidate of exactCandidates) {
    if (candidate && candidate in catalogModels) return candidate;
  }
  const nameMatch = normalizedNameIndex.get(slugify(model.name));
  return nameMatch;
}

function normalizeOffering(
  provider: Provider,
  providerModelId: string,
  model: RawApiModel,
  fetchedAt: string,
) {
  return ProviderOfferingSchema.parse({
    provider,
    providerModelId,
    pricing: normalizePricing(model.cost),
    api: model.provider?.api,
    status: model.status,
    source: {
      source: "models.dev/api",
      fetchedAt,
      url: "https://models.dev/api.json",
    },
  });
}

function normalizeModelFromApi(
  provider: Provider,
  providerModelId: string,
  model: RawApiModel,
  fetchedAt: string,
): Model {
  return ModelSchema.parse({
    id: `${provider.id}/${providerModelId.replace(/@.*$/, "")}`,
    slug: slugify(model.name || providerModelId),
    name: model.name,
    description: model.description,
    family: model.family,
    lab: { id: provider.id, name: provider.name },
    aliases: [providerModelId, model.id, model.name].filter(
      (value, index, array) => array.indexOf(value) === index,
    ),
    releaseDate: model.release_date,
    lastUpdated: model.last_updated,
    contextWindow: pickContext(model.limit),
    modalities: model.modalities,
    capabilities: {
      reasoning: model.reasoning,
      toolCall: model.tool_call,
      structuredOutput: model.structured_output,
      attachment: model.attachment,
      temperature: model.temperature,
      openWeights: model.open_weights,
    },
    architecture: undefined,
    license: undefined,
    openWeights: model.open_weights,
    benchmarks: [],
    offerings: [normalizeOffering(provider, providerModelId, model, fetchedAt)],
    sources: [
      sourceRef("models.dev/api", fetchedAt, "https://models.dev/api.json"),
    ],
  });
}

export function mergeCatalogApiAndLabs(input: MergeInput): MergeResult {
  const { fetchedAt, api, catalog, labs } = input;
  const normalizedNameIndex = new Map<string, string>();
  for (const [id, model] of Object.entries(catalog.models)) {
    normalizedNameIndex.set(slugify(model.name), id);
  }

  const providers = new Map<string, Provider>();
  for (const [providerId, provider] of Object.entries(api)) {
    providers.set(providerId, normalizeProvider(provider));
  }
  for (const [providerId, provider] of Object.entries(catalog.providers)) {
    if (!providers.has(providerId))
      providers.set(providerId, normalizeProvider(provider));
  }

  const models = new Map<string, Model>();
  const quarantine: Metadata["quarantine"] = [];
  const conflicts: Metadata["conflicts"] = [];

  for (const [modelId, model] of Object.entries(catalog.models)) {
    try {
      models.set(
        modelId,
        normalizeModelFromCatalog(modelId, model, labs, fetchedAt),
      );
    } catch (error) {
      quarantine.push({
        id: modelId,
        reason: "catalog-normalization-failed",
        issues: [error instanceof Error ? error.message : String(error)],
      });
    }
  }

  for (const [providerId, provider] of Object.entries(api)) {
    const providerRef =
      providers.get(providerId) ?? normalizeProvider(provider);
    for (const [providerModelId, model] of Object.entries(provider.models)) {
      const canonicalId = resolveCanonicalId(
        providerId,
        model,
        catalog.models,
        normalizedNameIndex,
      );
      const key =
        canonicalId ??
        `external/${providerId}/${slugify(providerModelId || model.name)}`;
      const offering = normalizeOffering(
        providerRef,
        providerModelId,
        model,
        fetchedAt,
      );
      const existing = models.get(key);
      if (existing) {
        const next = {
          ...existing,
          offerings: [...existing.offerings, offering],
          sources: [
            ...existing.sources,
            sourceRef(
              "models.dev/api",
              fetchedAt,
              "https://models.dev/api.json",
            ),
          ],
        };
        const validated = ModelSchema.safeParse(next);
        if (validated.success) {
          models.set(key, validated.data);
        } else {
          quarantine.push({
            id: key,
            reason: "model-validation-failed",
            issues: validated.error.issues.map(
              (issue) => `${issue.path.join(".")}: ${issue.message}`,
            ),
          });
        }
        continue;
      }

      const external = normalizeModelFromApi(
        providerRef,
        providerModelId,
        model,
        fetchedAt,
      );
      const validated = ModelSchema.safeParse({
        ...external,
        id: key,
        sources: [
          sourceRef("models.dev/api", fetchedAt, "https://models.dev/api.json"),
        ],
      });
      if (validated.success) {
        models.set(key, validated.data);
      } else {
        quarantine.push({
          id: key,
          reason: "model-validation-failed",
          issues: validated.error.issues.map(
            (issue) => `${issue.path.join(".")}: ${issue.message}`,
          ),
        });
      }
    }
  }

  const mergedLabs = labs.map((lab) =>
    LabSchema.parse({
      ...lab,
      slug: lab.slug ?? lab.id,
      tokens: lab.tokens ?? [lab.id, lab.name],
      sources: lab.sources ?? [
        sourceRef("models.dev/labs", fetchedAt, "https://models.dev/labs/"),
      ],
    }),
  );

  const dataset = NormalizedDatasetSchema.parse({
    models: [...models.values()],
    labs: mergedLabs,
    providers: [...providers.values()],
    metadata: MetadataSchema.parse({
      fetchedAt,
      sourceStatus: {
        api: { url: "https://models.dev/api.json", bytes: 0 },
        catalog: { url: "https://models.dev/catalog.json", bytes: 0 },
        labs: { url: "https://models.dev/labs/", bytes: 0 },
      },
      conflicts,
      quarantine,
    }),
  }) as MergeResult;

  return dataset;
}
