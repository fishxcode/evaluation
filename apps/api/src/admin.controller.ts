import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Headers,
  Inject,
  NotFoundException,
  Param,
  Post,
  Put,
  Delete,
  Req,
  UseGuards,
} from "@nestjs/common";
import { ApiBearerAuth, ApiBody, ApiOperation, ApiTags } from "@nestjs/swagger";
import { refreshDataPipeline } from "@models-dev/data";
import { AnalyticsService } from "./analytics.service";
import { ApiUsageService } from "./api-usage.service";
import { AdminAuthService } from "./admin-auth.service";
import { AdminAuthGuard, type AdminRequest } from "./admin-auth.guard";
import { AdminStore, type PipelineRun } from "./admin-store";
import { DatasetService } from "./dataset.service";
import { ApiEnvelopeResponse } from "./dto";
import { ManualOverrideService } from "./manual-override.service";
import { ok } from "./response";

function rootDir() {
  return fs.existsSync(path.resolve(process.cwd(), "pnpm-workspace.yaml"))
    ? process.cwd()
    : path.resolve(process.cwd(), "../..");
}

function bearerToken(header: string | string[] | undefined) {
  const value = Array.isArray(header) ? header[0] : header;
  return value?.replace(/^Bearer\s+/i, "");
}

function historyDir() {
  return path.join(rootDir(), "data", "merged", "history");
}

function mergedDir() {
  return path.join(rootDir(), "data", "merged");
}

function listHistoryVersions() {
  try {
    return fs
      .readdirSync(historyDir(), { withFileTypes: true })
      .filter((entry) => entry.isDirectory())
      .map((entry) => {
        const metadataPath = path.join(
          historyDir(),
          entry.name,
          "metadata.json",
        );
        const metadata = JSON.parse(fs.readFileSync(metadataPath, "utf8")) as {
          version?: string;
          contentHash?: string;
          fetchedAt?: string;
        };
        return {
          versionId: entry.name,
          version: metadata.version,
          contentHash: metadata.contentHash,
          fetchedAt: metadata.fetchedAt,
        };
      });
  } catch {
    return [];
  }
}

function adminActor(request: AdminRequest) {
  return request.adminUser ?? "unknown";
}

function normalizeOverrideValue(field: string, value: unknown) {
  const booleanFields = new Set([
    "openWeights",
    "capabilities.reasoning",
    "capabilities.toolCall",
    "capabilities.structuredOutput",
    "capabilities.attachment",
    "capabilities.temperature",
    "capabilities.openWeights",
  ]);
  if (!booleanFields.has(field)) return value;
  if (value === true || value === "true") return true;
  if (value === false || value === "false") return false;
  throw new BadRequestException(
    `Override field ${field} expects a boolean value`,
  );
}

/** Public admin authentication endpoints.
 * 公开管理员认证端点。 */
@ApiTags("admin")
@Controller("admin")
export class AdminAuthController {
  constructor(
    @Inject(AdminAuthService) private readonly auth: AdminAuthService,
  ) {}

  @Post("login")
  @ApiOperation({
    summary: "Login to the admin console.\n登录后台管理控制台。",
  })
  @ApiBody({
    schema: {
      type: "object",
      required: ["username", "password"],
      properties: {
        username: { type: "string" },
        password: { type: "string" },
      },
    },
  })
  @ApiEnvelopeResponse({ status: 201 })
  login(
    @Body("username") username?: string,
    @Body("password") password?: string,
  ) {
    return ok(this.auth.login(username, password));
  }

  @Post("refresh-token")
  @ApiBearerAuth()
  @ApiOperation({
    summary: "Refresh an admin session token.\n刷新管理员会话 token。",
  })
  @ApiEnvelopeResponse({ status: 201 })
  refreshToken(@Headers("authorization") authorization?: string) {
    return ok(this.auth.refresh(bearerToken(authorization)));
  }
}

/** Authenticated admin data management endpoints.
 * 需登录的后台数据管理端点。 */
@ApiTags("admin")
@ApiBearerAuth()
@UseGuards(AdminAuthGuard)
@Controller("admin")
export class AdminController {
  private readonly store = new AdminStore();

  constructor(
    @Inject(DatasetService) private readonly dataset: DatasetService,
    @Inject(ManualOverrideService)
    private readonly overrides: ManualOverrideService,
    @Inject(AnalyticsService) private readonly analytics: AnalyticsService,
    @Inject(ApiUsageService) private readonly usage: ApiUsageService,
  ) {}

  @Get("pipeline/runs")
  @ApiOperation({ summary: "List data pipeline runs.\n列出数据管线运行记录。" })
  @ApiEnvelopeResponse()
  runs() {
    return ok({
      runs: this.store.runs().slice().reverse(),
      versions: listHistoryVersions(),
    });
  }

  @Get("pipeline/runs/:runId")
  @ApiOperation({
    summary: "Get one data pipeline run.\n获取单次数据管线运行记录。",
  })
  @ApiEnvelopeResponse()
  run(@Param("runId") runId: string) {
    const run = this.store.runs().find((item) => item.id === runId);
    if (!run) throw new NotFoundException(`Pipeline run not found: ${runId}`);
    return ok(run);
  }

  @Post("pipeline/refresh")
  @ApiOperation({
    summary:
      "Run the data refresh pipeline from admin.\n从后台运行数据刷新管线。",
  })
  @ApiBody({
    schema: { type: "object", properties: { force: { type: "boolean" } } },
  })
  @ApiEnvelopeResponse({ status: 201 })
  async refresh(
    @Body("force") force: boolean | undefined,
    @Req() request: AdminRequest,
  ) {
    const actor = adminActor(request);
    const startedAt = new Date().toISOString();
    const run: PipelineRun = {
      id: crypto.randomUUID(),
      actor,
      triggeredBy: "admin",
      startedAt,
      status: "running",
      force: Boolean(force),
    };
    const runs = [...this.store.runs(), run];
    this.store.saveRuns(runs);
    this.store.appendAudit({
      actor,
      action: "pipeline.refresh.started",
      details: { force: Boolean(force), runId: run.id },
    });

    try {
      const started = Date.now();
      const result = await refreshDataPipeline({
        rootDir: rootDir(),
        ...(force === undefined ? {} : { force }),
      });
      const completed: PipelineRun = {
        ...run,
        endedAt: new Date().toISOString(),
        durationMs: Date.now() - started,
        status: "success",
        changed: result.changed,
        contentHash: result.contentHash,
      };
      this.store.saveRuns(
        runs.map((item) => (item.id === run.id ? completed : item)),
      );
      this.dataset.reloadIfChanged();
      this.store.appendAudit({
        actor,
        action: "pipeline.refresh.completed",
        target: run.id,
        details: { changed: result.changed, contentHash: result.contentHash },
      });
      return ok(completed);
    } catch (error) {
      const failed: PipelineRun = {
        ...run,
        endedAt: new Date().toISOString(),
        status: "failed",
        error: error instanceof Error ? error.message : String(error),
      };
      this.store.saveRuns(
        runs.map((item) => (item.id === run.id ? failed : item)),
      );
      this.store.appendAudit({
        actor,
        action: "pipeline.refresh.failed",
        target: run.id,
        details: { error: failed.error },
      });
      throw error;
    }
  }

  @Post("pipeline/rollback/:versionId")
  @ApiOperation({
    summary:
      "Rollback published data to a history version.\n将发布数据回滚到某个历史版本。",
  })
  @ApiEnvelopeResponse({ status: 201 })
  rollback(
    @Param("versionId") versionId: string,
    @Req() request: AdminRequest,
  ) {
    const actor = adminActor(request);
    const snapshotDir = path.join(historyDir(), versionId);
    const targetModels = path.join(snapshotDir, "models.json");
    const targetMetadata = path.join(snapshotDir, "metadata.json");
    if (!fs.existsSync(targetModels) || !fs.existsSync(targetMetadata))
      throw new NotFoundException(`History version not found: ${versionId}`);
    const before = this.dataset.getSourceDataset().metadata;
    fs.copyFileSync(targetModels, path.join(mergedDir(), "models.json"));
    fs.copyFileSync(targetMetadata, path.join(mergedDir(), "metadata.json"));
    this.dataset.reloadIfChanged();
    const after = this.dataset.getSourceDataset().metadata;
    const diffSummary = {
      fromVersion: before.version,
      toVersion: after.version,
      fromHash: before.contentHash,
      toHash: after.contentHash,
    };
    this.store.appendAudit({
      actor,
      action: "pipeline.rollback",
      target: versionId,
      details: diffSummary,
    });
    return ok({ versionId, diffSummary });
  }

  @Get("quarantine")
  @ApiOperation({
    summary:
      "List quarantine records and merge conflicts.\n列出隔离区记录与 merge 冲突。",
  })
  @ApiEnvelopeResponse()
  quarantine() {
    const metadata = this.dataset.getSourceDataset().metadata;
    return ok({
      quarantine: metadata.quarantine,
      conflicts: metadata.conflicts,
    });
  }

  @Get("quarantine/:recordId")
  @ApiOperation({ summary: "Get one quarantine record.\n获取单条隔离区记录。" })
  @ApiEnvelopeResponse()
  quarantineRecord(@Param("recordId") recordId: string) {
    const record = this.dataset
      .getSourceDataset()
      .metadata.quarantine.find((item) => item.id === recordId);
    if (!record)
      throw new NotFoundException(`Quarantine record not found: ${recordId}`);
    return ok(record);
  }

  @Get("sources/health")
  @ApiOperation({
    summary: "Get source adapter health.\n获取数据源 Adapter 健康状态。",
  })
  @ApiEnvelopeResponse()
  sourcesHealth() {
    return ok(this.dataset.getSourceDataset().metadata.sourceStatus);
  }

  @Get("models/:id/overrides")
  @ApiOperation({
    summary: "List manual overrides for a model.\n列出模型人工覆盖。",
  })
  @ApiEnvelopeResponse()
  modelOverrides(@Param("id") modelId: string) {
    return ok(this.overrides.listModelOverrides(modelId));
  }

  @Put("models/:id/overrides")
  @ApiOperation({
    summary: "Set a manual override for a model field.\n设置模型字段人工覆盖。",
  })
  @ApiBody({
    schema: {
      type: "object",
      required: ["field", "value"],
      properties: { field: { type: "string" }, value: {} },
    },
  })
  @ApiEnvelopeResponse()
  setOverride(
    @Param("id") modelId: string,
    @Body("field") field: string | undefined,
    @Body("value") value: unknown,
    @Req() request: AdminRequest,
  ) {
    if (!field) throw new BadRequestException("Missing override field");
    const actor = adminActor(request);
    const model = this.dataset
      .getSourceDataset()
      .models.find((item) => item.id === modelId);
    if (!model) throw new NotFoundException(`Model not found: ${modelId}`);
    try {
      const override = this.overrides.setModelOverride(
        model,
        field,
        normalizeOverrideValue(field, value),
        actor,
      );
      this.store.appendAudit({
        actor,
        action: "model.override.set",
        target: `${modelId}:${field}`,
        details: { value },
      });
      return ok(override);
    } catch (error) {
      throw new BadRequestException(
        error instanceof Error ? error.message : String(error),
      );
    }
  }

  @Delete("models/:id/overrides/:field")
  @ApiOperation({
    summary:
      "Delete a manual override for a model field.\n删除模型字段人工覆盖。",
  })
  @ApiEnvelopeResponse()
  deleteOverride(
    @Param("id") modelId: string,
    @Param("field") field: string,
    @Req() request: AdminRequest,
  ) {
    const actor = adminActor(request);
    const removed = this.overrides.deleteModelOverride(modelId, field);
    this.store.appendAudit({
      actor,
      action: "model.override.delete",
      target: `${modelId}:${field}`,
    });
    return ok({ removed: Boolean(removed), override: removed });
  }

  @Get("audit-logs")
  @ApiOperation({
    summary: "List append-only admin audit logs.\n列出追加式管理员审计日志。",
  })
  @ApiEnvelopeResponse()
  auditLogs() {
    return ok(this.store.auditLogs());
  }

  @Get("usage/stats")
  @ApiOperation({
    summary: "Get API and page-view usage stats.\n获取 API 与页面访问统计。",
  })
  @ApiEnvelopeResponse()
  usageStats() {
    return ok({
      api: this.usage.snapshot(),
      pages: this.analytics.getSnapshot(),
    });
  }
}
