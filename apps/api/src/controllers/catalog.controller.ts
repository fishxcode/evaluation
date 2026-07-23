/**
 * CatalogController — assorted read endpoints: providers, benchmarks, pricing,
 * stats, metadata, filters, search, status (8.1).
 * CatalogController——若干只读端点：providers/benchmarks/pricing/stats/
 * metadata/filters/search/status。
 */
import { Controller, Get, Query } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiQuery } from '@nestjs/swagger';
import { modelQuerySchema, paginationQuerySchema, type PaginationQuery, type Status } from '@models-dev/shared';
import { DatasetService } from '../data/dataset.service.js';
import { QueryService } from '../data/query.service.js';
import { ZodValidationPipe } from '../common/zod-validation.pipe.js';

@ApiTags('catalog')
@Controller()
export class CatalogController {
  constructor(
    private readonly dataset: DatasetService,
    private readonly query: QueryService,
  ) {}

  @Get('providers')
  @ApiOperation({ summary: 'List providers with model counts / 列出 Provider 及模型数' })
  providers() {
    const counts = new Map<string, { id: string; name: string; count: number }>();
    for (const m of this.dataset.getModels()) {
      for (const o of m.offerings) {
        const c = counts.get(o.providerId) ?? { id: o.providerId, name: o.providerName, count: 0 };
        c.count++; counts.set(o.providerId, c);
      }
    }
    return [...counts.values()].sort((a, b) => b.count - a.count);
  }

  @Get('benchmarks')
  @ApiOperation({ summary: 'List distinct benchmark names with coverage / 列出基准名称及覆盖数' })
  benchmarks() {
    const counts = new Map<string, number>();
    for (const m of this.dataset.getModels()) {
      for (const b of m.benchmarks) counts.set(b.name, (counts.get(b.name) ?? 0) + 1);
    }
    return [...counts.entries()].map(([name, modelCount]) => ({ name, modelCount })).sort((a, b) => b.modelCount - a.modelCount);
  }

  @Get('pricing')
  @ApiOperation({ summary: 'Flattened pricing rows across all offerings / 展平的定价行' })
  @ApiQuery({ name: 'page', required: false, example: 1 })
  @ApiQuery({ name: 'pageSize', required: false, example: 20 })
  pricing(@Query(new ZodValidationPipe(paginationQuerySchema)) q: PaginationQuery) {
    const rows = this.query.pricingRows();
    const total = rows.length;
    const totalPages = Math.max(1, Math.ceil(total / q.pageSize));
    const data = rows.slice((q.page - 1) * q.pageSize, (q.page - 1) * q.pageSize + q.pageSize);
    return { data, meta: { page: q.page, pageSize: q.pageSize, total, totalPages } };
  }

  @Get('stats')
  @ApiOperation({ summary: 'Dashboard stats + page view counter / 仪表盘统计 + 访问计数' })
  stats() {
    const models = this.dataset.getModels();
    const meta = this.dataset.getMetadata();
    const allPrices = models.flatMap(m => m.offerings.map(o => o.pricing?.input).filter((p): p is number => typeof p === 'number'));
    const avgInput = allPrices.length ? allPrices.reduce((a, b) => a + b, 0) / allPrices.length : 0;
    const latest = [...models].sort((a, b) => (b.releaseDate ?? '').localeCompare(a.releaseDate ?? '')).slice(0, 5)
      .map(m => ({ id: m.id, name: m.name, releaseDate: m.releaseDate }));
    return {
      modelCount: models.length,
      labCount: this.dataset.getLabs().length,
      providerCount: new Set(models.flatMap(m => m.offerings.map(o => o.providerId))).size,
      avgInputPrice: Number(avgInput.toFixed(4)),
      latestModels: latest,
      dataVersion: meta?.version,
      lastUpdated: meta?.builtAt,
    };
  }

  @Get('metadata')
  @ApiOperation({ summary: 'Dataset metadata (version, sources, counts) / 数据集元数据' })
  metadata() {
    return this.dataset.getMetadata();
  }

  @Get('filters')
  @ApiOperation({ summary: 'Filter facets (values + counts) to drive UI / 筛选维度' })
  filters() {
    return this.query.buildFacets();
  }

  @Get('search')
  @ApiOperation({ summary: 'Full-text + alias search across models / 全文+别名搜索' })
  @ApiQuery({ name: 'q', required: true, example: 'claude' })
  search(@Query(new ZodValidationPipe(modelQuerySchema)) q: ReturnType<typeof modelQuerySchema.parse>) {
    return this.query.queryModels(q);
  }

  @Get('status')
  @ApiOperation({ summary: 'Health check (for container HEALTHCHECK) / 健康检查' })
  status(): Status {
    const meta = this.dataset.getMetadata();
    const hasData = this.dataset.getModels().length > 0;
    return {
      status: hasData ? 'ok' : 'degraded',
      uptime: this.dataset.getUptimeSeconds(),
      dataVersion: meta?.version,
      lastUpdated: meta?.builtAt,
      sources: meta?.sources,
    };
  }
}
