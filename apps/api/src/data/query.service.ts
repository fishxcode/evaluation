/**
 * QueryService — filtering, sorting, pagination, search over the in-memory
 * model dataset. Pure functions kept here so controllers stay thin.
 * QueryService——对内存模型数据集的过滤/排序/分页/搜索。纯逻辑集中于此，
 * 使 controller 保持轻薄。
 */
import { Injectable } from '@nestjs/common';
import type { Model, ModelQuery, PaginationMeta, FilterFacets, Pricing } from '@models-dev/shared';
import { DatasetService } from './dataset.service.js';

/** Minimum input price across a model's offerings (for sort/filter) / 模型各 offering 的最低输入价 */
function minInputPrice(m: Model): number | undefined {
  const prices = m.offerings
    .map(o => o.pricing?.input)
    .filter((p): p is number => typeof p === 'number');
  return prices.length ? Math.min(...prices) : undefined;
}

/** Max benchmark score for a model (for sort) / 模型最高基准分 */
function maxBenchmark(m: Model): number | undefined {
  return m.benchmarks.length ? Math.max(...m.benchmarks.map(b => b.score)) : undefined;
}

@Injectable()
export class QueryService {
  constructor(private readonly dataset: DatasetService) {}

  /**
   * Apply full query (filter → search → sort → paginate) to the model list.
   * 对模型列表应用完整查询（过滤→搜索→排序→分页）。
   */
  queryModels(q: ModelQuery): { data: Model[]; meta: PaginationMeta } {
    let list = this.dataset.getModels();

    // ---- Filters ----
    if (q.lab) list = list.filter(m => m.lab.id === q.lab);
    if (q.provider) list = list.filter(m => m.offerings.some(o => o.providerId === q.provider));
    if (q.capability) list = list.filter(m => m.capabilities.includes(q.capability as never));
    if (q.modality) list = list.filter(m => m.modalities.input.includes(q.modality as never));
    if (q.openWeights !== undefined) list = list.filter(m => m.openWeights === q.openWeights);
    if (q.minContext !== undefined) list = list.filter(m => (m.limit?.context ?? 0) >= q.minContext!);
    if (q.maxContext !== undefined) list = list.filter(m => (m.limit?.context ?? Infinity) <= q.maxContext!);
    if (q.minPrice !== undefined) {
      list = list.filter(m => { const p = minInputPrice(m); return p !== undefined && p >= q.minPrice!; });
    }
    if (q.maxPrice !== undefined) {
      list = list.filter(m => { const p = minInputPrice(m); return p !== undefined && p <= q.maxPrice!; });
    }

    // ---- Search (name/slug/description/aliases, case-insensitive substring) ----
    if (q.q) {
      const needle = q.q.toLowerCase();
      list = list.filter(m =>
        m.name.toLowerCase().includes(needle) ||
        m.slug.toLowerCase().includes(needle) ||
        m.id.toLowerCase().includes(needle) ||
        (m.description?.toLowerCase().includes(needle) ?? false) ||
        m.aliases.some(a => a.toLowerCase().includes(needle)),
      );
    }

    // ---- Sort ----
    if (q.sort) {
      const dir = q.order === 'desc' ? -1 : 1;
      list = [...list].sort((a, b) => dir * this.compare(a, b, q.sort!));
    }

    // ---- Paginate ----
    const total = list.length;
    const totalPages = Math.max(1, Math.ceil(total / q.pageSize));
    const start = (q.page - 1) * q.pageSize;
    const data = list.slice(start, start + q.pageSize);

    return { data, meta: { page: q.page, pageSize: q.pageSize, total, totalPages } };
  }

  /** Comparator for a sort field; undefined values sort last / 排序比较器，缺失值排末尾 */
  private compare(a: Model, b: Model, field: NonNullable<ModelQuery['sort']>): number {
    const nullsLast = (av: number | undefined, bv: number | undefined): number => {
      if (av === undefined && bv === undefined) return 0;
      if (av === undefined) return 1;
      if (bv === undefined) return -1;
      return av - bv;
    };
    switch (field) {
      case 'name':
        return a.name.localeCompare(b.name);
      case 'releaseDate':
        return (a.releaseDate ?? '').localeCompare(b.releaseDate ?? '');
      case 'lastUpdated':
        return (a.lastUpdated ?? '').localeCompare(b.lastUpdated ?? '');
      case 'context':
        return nullsLast(a.limit?.context, b.limit?.context);
      case 'price':
        return nullsLast(minInputPrice(a), minInputPrice(b));
      case 'benchmark':
        return nullsLast(maxBenchmark(a), maxBenchmark(b));
      default:
        return 0;
    }
  }

  /**
   * Build filter facets (GET /filters) — available values + counts to drive
   * the frontend filter UI.
   * 构建筛选维度（GET /filters）——可用值+计数，驱动前端筛选 UI。
   */
  buildFacets(): FilterFacets {
    const models = this.dataset.getModels();
    const labCount = new Map<string, { name: string; count: number }>();
    const provCount = new Map<string, { name: string; count: number }>();
    const capCount = new Map<string, number>();
    const modCount = new Map<string, number>();
    const licCount = new Map<string, number>();
    let ctxMin = Infinity, ctxMax = 0, priceMin = Infinity, priceMax = 0;

    for (const m of models) {
      const lc = labCount.get(m.lab.id) ?? { name: m.lab.name, count: 0 };
      lc.count++; labCount.set(m.lab.id, lc);
      for (const o of m.offerings) {
        const pc = provCount.get(o.providerId) ?? { name: o.providerName, count: 0 };
        pc.count++; provCount.set(o.providerId, pc);
      }
      for (const c of m.capabilities) capCount.set(c, (capCount.get(c) ?? 0) + 1);
      for (const mod of m.modalities.input) modCount.set(mod, (modCount.get(mod) ?? 0) + 1);
      if (m.license) licCount.set(m.license, (licCount.get(m.license) ?? 0) + 1);
      if (m.limit?.context) { ctxMin = Math.min(ctxMin, m.limit.context); ctxMax = Math.max(ctxMax, m.limit.context); }
      const p = minInputPrice(m);
      if (p !== undefined) { priceMin = Math.min(priceMin, p); priceMax = Math.max(priceMax, p); }
    }

    return {
      labs: [...labCount.entries()].map(([id, v]) => ({ id, name: v.name, count: v.count })).sort((a, b) => b.count - a.count),
      providers: [...provCount.entries()].map(([id, v]) => ({ id, name: v.name, count: v.count })).sort((a, b) => b.count - a.count),
      capabilities: [...capCount.entries()].map(([value, count]) => ({ value, count })).sort((a, b) => b.count - a.count),
      modalities: [...modCount.entries()].map(([value, count]) => ({ value, count })).sort((a, b) => b.count - a.count),
      licenses: [...licCount.entries()].map(([value, count]) => ({ value, count })).sort((a, b) => b.count - a.count),
      contextRange: { min: ctxMin === Infinity ? 0 : ctxMin, max: ctxMax },
      priceRange: { min: priceMin === Infinity ? 0 : priceMin, max: priceMax },
    };
  }

  /**
   * Flatten offerings into pricing rows (GET /pricing).
   * 将 offering 展平为定价行（GET /pricing）。
   */
  pricingRows(): Array<{
    modelId: string; modelName: string; lab: string; providerId: string; providerName: string;
    input?: number; output?: number; cacheRead?: number; reasoning?: number;
  }> {
    const rows = [];
    for (const m of this.dataset.getModels()) {
      for (const o of m.offerings) {
        const p: Pricing | null = o.pricing;
        rows.push({
          modelId: m.id, modelName: m.name, lab: m.lab.name,
          providerId: o.providerId, providerName: o.providerName,
          input: p?.input, output: p?.output, cacheRead: p?.cacheRead,
          reasoning: p?.reasoning,
        });
      }
    }
    return rows;
  }
}
