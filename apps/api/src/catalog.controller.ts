import {
  Body,
  Controller,
  ForbiddenException,
  Get,
  Headers,
  Inject,
  Param,
  Post,
  Query,
} from "@nestjs/common";
import {
  ApiBearerAuth,
  ApiOperation,
  ApiQuery,
  ApiTags,
} from "@nestjs/swagger";
import { refreshDataPipeline } from "@models-dev/data";
import path from "node:path";
import { AnalyticsService } from "./analytics.service.js";
import { DatasetService } from "./dataset.service.js";
import {
  ApiEnvelopeResponse,
  ModelListQueryDto,
  parseModelListQuery,
} from "./dto.js";
import { ok } from "./response.js";

function rootDir() {
  return path.resolve(process.cwd(), "../..");
}

@ApiTags("catalog")
@Controller()
export class CatalogController {
  constructor(
    @Inject(DatasetService) private readonly dataset: DatasetService,
    @Inject(AnalyticsService) private readonly analytics: AnalyticsService,
  ) {}

  @Get("models")
  @ApiOperation({
    summary: "List models.\n列出模型。",
    description:
      "Supports pagination, filtering, and sorting.\n支持分页、筛选与排序。",
  })
  @ApiEnvelopeResponse({
    dataSchema: {
      type: "array",
      items: { type: "object", additionalProperties: true },
    },
  })
  listModels(@Query() query: ModelListQueryDto) {
    const page = this.dataset.listModels(parseModelListQuery(query));
    return ok(page.items, page.meta);
  }

  @Get("models/:id")
  @ApiOperation({ summary: "Get model detail.\n获取模型详情。" })
  @ApiEnvelopeResponse()
  getModel(@Param("id") id: string) {
    return ok(this.dataset.getModel(id));
  }

  @Get("labs")
  @ApiOperation({ summary: "List labs.\n列出 Labs。" })
  @ApiEnvelopeResponse({
    dataSchema: {
      type: "array",
      items: { type: "object", additionalProperties: true },
    },
  })
  labs() {
    return ok(this.dataset.labs());
  }

  @Get("labs/:id")
  @ApiOperation({ summary: "Get lab detail.\n获取 Lab 详情。" })
  @ApiEnvelopeResponse()
  lab(@Param("id") id: string) {
    const lab = this.dataset.getLab(id);
    if (!lab) return ok(null, { found: false });
    return ok(lab);
  }

  @Get("providers")
  @ApiOperation({ summary: "List providers.\n列出 Providers。" })
  @ApiEnvelopeResponse({
    dataSchema: {
      type: "array",
      items: { type: "object", additionalProperties: true },
    },
  })
  providers() {
    return ok(this.dataset.providers());
  }

  @Get("benchmarks")
  @ApiOperation({
    summary: "List benchmark dimensions.\n列出 benchmark 维度。",
  })
  @ApiEnvelopeResponse({
    dataSchema: {
      type: "array",
      items: { type: "object", additionalProperties: true },
    },
  })
  benchmarks() {
    return ok(this.dataset.benchmarks());
  }

  @Get("pricing")
  @ApiOperation({
    summary: "List provider pricing rows.\n列出 Provider 价格行。",
  })
  @ApiQuery({ name: "provider", required: false })
  @ApiEnvelopeResponse({
    dataSchema: {
      type: "array",
      items: { type: "object", additionalProperties: true },
    },
  })
  pricing(@Query("provider") provider?: string) {
    return ok(this.dataset.listPricing(provider));
  }

  @Get("stats")
  @ApiOperation({ summary: "Get catalog stats.\n获取目录统计。" })
  @ApiEnvelopeResponse()
  stats() {
    return ok({
      ...this.dataset.stats(),
      pageViews: this.analytics.getSnapshot().pageViews,
    });
  }

  @Get("metadata")
  @ApiOperation({ summary: "Get data metadata.\n获取数据元信息。" })
  @ApiEnvelopeResponse()
  metadata() {
    return ok(this.dataset.getDataset().metadata);
  }

  @Get("filters")
  @ApiOperation({ summary: "Get available filter values.\n获取可用筛选值域。" })
  @ApiEnvelopeResponse()
  filters() {
    return ok(this.dataset.getFilters());
  }

  @Get("search")
  @ApiOperation({ summary: "Search models.\n搜索模型。" })
  @ApiQuery({ name: "q", required: false })
  @ApiEnvelopeResponse({
    dataSchema: {
      type: "array",
      items: { type: "object", additionalProperties: true },
    },
  })
  search(@Query("q") q?: string) {
    return ok(this.dataset.search(q));
  }

  @Get("status")
  @ApiOperation({
    summary: "Get service and dataset health.\n获取服务与数据集健康状态。",
  })
  @ApiEnvelopeResponse({
    dataSchema: {
      type: "object",
      required: ["status", "updatedAt", "sourceStatus"],
      properties: {
        status: { type: "string", enum: ["ok"] },
        version: { type: "string" },
        contentHash: { type: "string" },
        updatedAt: { type: "string" },
        sourceStatus: { type: "object", additionalProperties: true },
      },
    },
  })
  status() {
    const metadata = this.dataset.getDataset().metadata;
    return ok({
      status: "ok",
      version: metadata.version,
      contentHash: metadata.contentHash,
      updatedAt: metadata.fetchedAt,
      sourceStatus: metadata.sourceStatus,
    });
  }

  @Post("refresh")
  @ApiBearerAuth()
  @ApiOperation({ summary: "Refresh source data.\n刷新源数据。" })
  @ApiEnvelopeResponse({
    status: 201,
    dataSchema: {
      type: "object",
      required: ["changed", "contentHash"],
      properties: {
        changed: { type: "boolean" },
        contentHash: { type: "string" },
      },
    },
  })
  async refresh(
    @Headers("authorization") authorization?: string,
    @Headers("x-refresh-token") headerToken?: string,
    @Body("force") force?: boolean,
  ) {
    const expected = process.env.REFRESH_TOKEN;
    const bearerToken = authorization?.replace(/^Bearer\s+/i, "");
    if (!expected || (bearerToken !== expected && headerToken !== expected)) {
      throw new ForbiddenException("Invalid refresh token");
    }
    const result = await refreshDataPipeline({
      rootDir: rootDir(),
      ...(force === undefined ? {} : { force }),
    });
    this.dataset.reloadIfChanged();
    return ok({ changed: result.changed, contentHash: result.contentHash });
  }
}
