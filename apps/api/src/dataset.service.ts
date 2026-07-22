import fs from "node:fs";
import path from "node:path";
import {
  Inject,
  Injectable,
  NotFoundException,
  Optional,
} from "@nestjs/common";
import type {
  Lab,
  Model,
  ModelListQuery,
  NormalizedDataset,
  Provider,
} from "@models-dev/shared";
import { ManualOverrideService } from "./manual-override.service";

type ListQuery = Partial<Omit<ModelListQuery, "page" | "pageSize">> & {
  page?: number | string;
  pageSize?: number | string;
};

interface Page<T> {
  items: T[];
  meta: Record<string, unknown>;
}

function defaultDatasetPath() {
  const candidates = [
    path.resolve(process.cwd(), "data/merged/models.json"),
    path.resolve(process.cwd(), "../../data/merged/models.json"),
  ];
  const match = candidates.find((candidate) => fs.existsSync(candidate));
  return match ?? candidates[0]!;
}

function toPositiveInt(value: unknown, fallback: number) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 1) return fallback;
  return Math.floor(parsed);
}

function textIncludes(value: string | undefined, query: string) {
  return value?.toLowerCase().includes(query.toLowerCase()) ?? false;
}

function minPrice(model: Model) {
  const prices = model.offerings
    .map((offering) => offering.pricing?.input)
    .filter((price): price is number => typeof price === "number");
  return prices.length ? Math.min(...prices) : Number.POSITIVE_INFINITY;
}

function minFinitePrice(model: Model) {
  const value = minPrice(model);
  return Number.isFinite(value) ? value : undefined;
}

function maxBenchmark(model: Model) {
  const scores = model.benchmarks.map((benchmark) => benchmark.score);
  return scores.length ? Math.max(...scores) : Number.NEGATIVE_INFINITY;
}

function average(values: number[]) {
  return values.length
    ? values.reduce((sum, value) => sum + value, 0) / values.length
    : undefined;
}

function contextBand(total: number | undefined) {
  if (total === undefined) return "";
  if (total <= 32_768) return "<=32k";
  if (total <= 131_072) return "<=128k";
  return ">128k";
}

function priceBand(price: number | undefined) {
  if (price === undefined) return "";
  if (price === 0) return "free";
  if (price <= 1) return "<=1";
  return ">1";
}

/** Load and query the published normalized dataset.
 * 加载并查询已发布的归一化数据集。 */
@Injectable()
export class DatasetService {
  private dataset?: NormalizedDataset;
  private lastMtimeMs = 0;
  private readonly datasetPath: string;

  constructor(
    @Optional()
    @Inject(ManualOverrideService)
    private readonly overrides?: ManualOverrideService,
  ) {
    this.datasetPath = process.env.MODELS_DATASET_PATH ?? defaultDatasetPath();
  }

  /** Reload the dataset when the published file changed.
   * 当已发布文件变化时重新加载数据集。 */
  reloadIfChanged() {
    const stat = fs.statSync(this.datasetPath);
    if (this.dataset && stat.mtimeMs === this.lastMtimeMs) return;
    this.dataset = JSON.parse(
      fs.readFileSync(this.datasetPath, "utf8"),
    ) as NormalizedDataset;
    this.lastMtimeMs = stat.mtimeMs;
  }

  /** Return the current dataset, loading it on first access.
   * 返回当前数据集，首次访问时加载。 */
  getDataset() {
    this.reloadIfChanged();
    if (!this.dataset) throw new Error("Dataset was not loaded");
    return this.overrides ? this.overrides.apply(this.dataset) : this.dataset;
  }

  /** Return the current source dataset without manual overrides.
   * 返回未叠加人工覆盖的当前来源数据集。 */
  getSourceDataset() {
    this.reloadIfChanged();
    if (!this.dataset) throw new Error("Dataset was not loaded");
    return this.dataset;
  }

  /** List models with additive filters and stable pagination.
   * 使用叠加筛选与稳定分页返回模型列表。 */
  listModels(query: ListQuery): Page<Model> {
    const dataset = this.getDataset();
    const page = toPositiveInt(query.page, 1);
    const pageSize = toPositiveInt(query.pageSize, 20);
    let models = [...dataset.models];

    if (query.q) {
      const q = query.q;
      models = models.filter((model) => {
        return (
          textIncludes(model.id, q) ||
          textIncludes(model.name, q) ||
          textIncludes(model.description, q) ||
          model.aliases.some((alias) => textIncludes(alias, q))
        );
      });
    }
    if (query.lab)
      models = models.filter((model) => model.lab.id === query.lab);
    if (query.provider) {
      models = models.filter((model) =>
        model.offerings.some(
          (offering) => offering.provider.id === query.provider,
        ),
      );
    }
    if (query.capability) {
      models = models.filter((model) =>
        Boolean(
          model.capabilities[query.capability as keyof Model["capabilities"]],
        ),
      );
    }
    if (query.modality) {
      models = models.filter((model) => {
        return (
          model.modalities?.input.includes(query.modality!) ||
          model.modalities?.output.includes(query.modality!)
        );
      });
    }
    if (query.openWeights !== undefined) {
      const expected = query.openWeights === "true";
      models = models.filter((model) => model.openWeights === expected);
    }
    if (query.license)
      models = models.filter((model) => model.license === query.license);
    if (query.architecture)
      models = models.filter(
        (model) => model.architecture === query.architecture,
      );
    if (query.releaseYear)
      models = models.filter((model) =>
        (model.releaseDate ?? "").startsWith(query.releaseYear!),
      );
    if (query.contextBand)
      models = models.filter(
        (model) =>
          contextBand(model.contextWindow?.total) === query.contextBand,
      );
    if (query.priceBand)
      models = models.filter(
        (model) => priceBand(minFinitePrice(model)) === query.priceBand,
      );
    if (query.benchmark)
      models = models.filter((model) =>
        model.benchmarks.some(
          (benchmark) => benchmark.benchmark === query.benchmark,
        ),
      );

    const order = query.order === "desc" ? -1 : 1;
    models.sort(
      (a, b) => this.compareModels(a, b, query.sort ?? "name") * order,
    );

    const total = models.length;
    const start = (page - 1) * pageSize;
    const totalPages = Math.ceil(total / pageSize);
    return {
      items: models.slice(start, start + pageSize),
      meta: { page, pageSize, total, totalPages, pageCount: totalPages },
    };
  }

  /** Resolve a model by canonical id.
   * 按规范 ID 获取模型详情。 */
  getModel(id: string) {
    const model = this.getDataset().models.find((item) => item.id === id);
    if (!model) throw new NotFoundException(`Model not found: ${id}`);
    return model;
  }

  listPricing(provider?: string) {
    return this.getDataset().models.flatMap((model) =>
      model.offerings
        .filter((offering) => !provider || offering.provider.id === provider)
        .map((offering) => ({
          modelId: model.id,
          modelName: model.name,
          lab: model.lab,
          provider: offering.provider,
          providerModelId: offering.providerModelId,
          pricing: offering.pricing,
        })),
    );
  }

  labs() {
    const dataset = this.getDataset();
    return dataset.labs.map((lab) => this.enrichLab(lab, dataset));
  }

  getLab(id: string) {
    const dataset = this.getDataset();
    const lab = dataset.labs.find((item) => item.id === id);
    if (!lab) return undefined;
    return this.enrichLab(lab, dataset);
  }

  getFilters() {
    const dataset = this.getDataset();
    const benchmarkNames = [
      ...new Set(
        dataset.models.flatMap((model) =>
          model.benchmarks.map((benchmark) => benchmark.benchmark),
        ),
      ),
    ].sort();
    const releaseYears = [
      ...new Set(
        dataset.models
          .map((model) => model.releaseDate?.slice(0, 4))
          .filter((value): value is string => Boolean(value)),
      ),
    ].sort();
    return {
      labs: [...new Set(dataset.models.map((model) => model.lab.id))].sort(),
      providers: [
        ...new Set(
          dataset.models.flatMap((model) =>
            model.offerings.map((offering) => offering.provider.id),
          ),
        ),
      ].sort(),
      capabilities: [
        "reasoning",
        "toolCall",
        "structuredOutput",
        "attachment",
        "temperature",
        "openWeights",
      ],
      modalities: [
        ...new Set(
          dataset.models.flatMap((model) => [
            ...(model.modalities?.input ?? []),
            ...(model.modalities?.output ?? []),
          ]),
        ),
      ].sort(),
      licenses: [
        ...new Set(
          dataset.models.map((model) => model.license).filter(Boolean),
        ),
      ].sort(),
      architectures: [
        ...new Set(
          dataset.models.map((model) => model.architecture).filter(Boolean),
        ),
      ].sort(),
      releaseYears,
      contextBands: ["<=32k", "<=128k", ">128k"],
      priceBands: ["free", "<=1", ">1"],
      benchmarks: benchmarkNames,
    };
  }

  search(q = "") {
    return this.listModels({ q, page: 1, pageSize: 20 }).items.map((model) => ({
      type: "model",
      id: model.id,
      title: model.name,
      lab: model.lab,
      href: `/models/${model.id}`,
    }));
  }

  stats() {
    const dataset = this.getDataset();
    const priced = this.listPricing().filter(
      (row) => row.pricing?.input !== undefined,
    );
    const averageInputPrice = priced.length
      ? priced.reduce((sum, row) => sum + (row.pricing?.input ?? 0), 0) /
        priced.length
      : undefined;
    return {
      modelCount: dataset.models.length,
      labCount: dataset.labs.length,
      providerCount: dataset.providers.length,
      latestReleaseDate: dataset.models
        .map((model) => model.releaseDate)
        .filter(Boolean)
        .sort()
        .at(-1),
      averageInputPrice,
      updatedAt: dataset.metadata.fetchedAt,
      contentHash: dataset.metadata.contentHash,
    };
  }

  benchmarks() {
    const counts = new Map<string, number>();
    for (const model of this.getDataset().models) {
      for (const benchmark of model.benchmarks)
        counts.set(
          benchmark.benchmark,
          (counts.get(benchmark.benchmark) ?? 0) + 1,
        );
    }
    return [...counts.entries()]
      .map(([benchmark, count]) => ({ benchmark, count }))
      .sort((a, b) => a.benchmark.localeCompare(b.benchmark));
  }

  providers(): Provider[] {
    return this.getDataset().providers;
  }

  private enrichLab(lab: Lab, dataset: NormalizedDataset) {
    const models = dataset.models
      .filter((model) => model.lab.id === lab.id)
      .sort(
        (a, b) =>
          (b.releaseDate ?? "").localeCompare(a.releaseDate ?? "") ||
          a.name.localeCompare(b.name),
      );
    const averageInputPrice = average(
      models
        .map(minFinitePrice)
        .filter((value): value is number => value !== undefined),
    );
    const averageBenchmarkScore = average(
      models.flatMap((model) =>
        model.benchmarks.map((benchmark) => benchmark.score),
      ),
    );
    return {
      ...lab,
      averageInputPrice,
      averageBenchmarkScore,
      models: models.slice(0, 8).map((model) => ({
        id: model.id,
        name: model.name,
        releaseDate: model.releaseDate,
        benchmarkCount: model.benchmarks.length,
        providerCount: model.offerings.length,
      })),
    };
  }

  private compareModels(a: Model, b: Model, sort: string) {
    if (sort === "releaseDate")
      return (a.releaseDate ?? "9999").localeCompare(b.releaseDate ?? "9999");
    if (sort === "context")
      return (
        (a.contextWindow?.total ?? Number.POSITIVE_INFINITY) -
        (b.contextWindow?.total ?? Number.POSITIVE_INFINITY)
      );
    if (sort === "price") return minPrice(a) - minPrice(b);
    if (sort === "benchmark") return maxBenchmark(b) - maxBenchmark(a);
    return a.name.localeCompare(b.name);
  }
}
