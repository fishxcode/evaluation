/**
 * AdminController — the protected management endpoints (8.2, 9.2). All routes
 * are guarded by JwtAuthGuard at the controller level (9.1). Login is separate
 * (AuthController) and public.
 * AdminController——受保护的管理端点。全部路由在 controller 层由 JwtAuthGuard
 * 守卫。登录在独立的 AuthController，公开。
 */
import { Controller, Get, Post, Put, Delete, Param, Body, Req, UseGuards, NotFoundException } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiParam } from '@nestjs/swagger';
import type { Request } from 'express';
import { refresh } from '@models-dev/data';
import { DatasetService } from '../data/dataset.service.js';
import { JwtAuthGuard } from './jwt-auth.guard.js';
import { AdminStore } from './admin-store.service.js';
import { DataStore } from '@models-dev/data';

function actor(req: Request): string {
  return (req as Request & { user?: { sub?: string } }).user?.sub ?? 'unknown';
}

@ApiTags('admin')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('admin')
export class AdminController {
  constructor(
    private readonly dataset: DatasetService,
    private readonly store: AdminStore,
  ) {}

  // ---- Pipeline control (9.2.1) ----
  @Post('pipeline/refresh')
  @ApiOperation({ summary: 'Trigger pipeline refresh (admin) / 触发管线刷新' })
  async refreshPipeline(@Req() req: Request) {
    const runId = `run-${Date.now()}`;
    const result = await refresh({ dataDir: this.dataset.getDataDir(), trigger: `admin:${actor(req)}` });
    this.dataset.reload();
    this.store.recordRun({
      runId, startedAt: new Date().toISOString(), trigger: `admin:${actor(req)}`,
      ok: result.ok, version: result.version, modelCount: result.modelCount,
      quarantinedCount: result.quarantinedCount, durationMs: result.durationMs,
      skipped: result.skipped, error: result.error,
    });
    this.store.audit({ actor: actor(req), action: 'refresh', detail: { runId, version: result.version } });
    return { runId, ...result, logs: undefined };
  }

  @Get('pipeline/runs')
  @ApiOperation({ summary: 'List pipeline run history / 管线运行历史' })
  runs() {
    return this.store.getRuns();
  }

  @Get('pipeline/runs/:runId')
  @ApiOperation({ summary: 'Get one pipeline run / 单次运行详情' })
  @ApiParam({ name: 'runId' })
  run(@Param('runId') runId: string) {
    const run = this.store.getRun(runId);
    if (!run) throw new NotFoundException({ code: 'NOT_FOUND', message: `Run '${runId}' not found` });
    return run;
  }

  @Post('pipeline/rollback/:versionId')
  @ApiOperation({ summary: 'Roll back dataset to a version / 回滚数据到指定版本' })
  @ApiParam({ name: 'versionId', example: '1' })
  rollback(@Param('versionId') versionId: string, @Req() req: Request) {
    const store = new DataStore(this.dataset.getDataDir());
    const meta = store.rollback(Number(versionId));
    this.dataset.reload();
    this.store.audit({ actor: actor(req), action: 'rollback', detail: { toVersion: meta.version } });
    return { ok: true, version: meta.version };
  }

  // ---- Data quality / quarantine (9.2.2) ----
  @Get('quarantine')
  @ApiOperation({ summary: 'List quarantined records / 隔离区记录' })
  quarantine() {
    const store = new DataStore(this.dataset.getDataDir());
    return store.readQuarantine();
  }

  // ---- Source health (9.2.3) ----
  @Get('sources/health')
  @ApiOperation({ summary: 'Per-source fetch health / 各数据源健康' })
  sourceHealth() {
    return this.dataset.getMetadata()?.sources ?? [];
  }

  // ---- Manual overrides (9.2.4) ----
  @Get('models/:lab/:slug/overrides')
  @ApiOperation({ summary: 'List overrides for a model / 模型的覆盖列表' })
  getOverrides(@Param('lab') lab: string, @Param('slug') slug: string) {
    return this.store.getOverrides()[`${lab}/${slug}`] ?? [];
  }

  @Put('models/:lab/:slug/overrides')
  @ApiOperation({ summary: 'Set a field override / 设置字段覆盖' })
  setOverride(
    @Param('lab') lab: string,
    @Param('slug') slug: string,
    @Body() body: { field: string; value: unknown },
    @Req() req: Request,
  ) {
    const id = `${lab}/${slug}`;
    const model = this.dataset.findModel(id);
    const originalValue = model ? (model as unknown as Record<string, unknown>)[body.field] : undefined;
    this.store.setOverride(id, {
      field: body.field, value: body.value, originalValue,
      updatedBy: actor(req), updatedAt: new Date().toISOString(),
    });
    this.store.audit({ actor: actor(req), action: 'override.set', detail: { id, field: body.field } });
    return { ok: true, id, field: body.field };
  }

  @Delete('models/:lab/:slug/overrides/:field')
  @ApiOperation({ summary: 'Delete a field override (restore source) / 删除覆盖（恢复来源值）' })
  deleteOverride(
    @Param('lab') lab: string,
    @Param('slug') slug: string,
    @Param('field') field: string,
    @Req() req: Request,
  ) {
    const id = `${lab}/${slug}`;
    this.store.deleteOverride(id, field);
    this.store.audit({ actor: actor(req), action: 'override.delete', detail: { id, field } });
    return { ok: true, id, field };
  }

  // ---- Audit log (9.2.5) ----
  @Get('audit-logs')
  @ApiOperation({ summary: 'Immutable audit log / 不可篡改审计日志' })
  auditLogs() {
    return this.store.getAuditLogs();
  }

  // ---- Usage stats (9.2.6) ----
  @Get('usage/stats')
  @ApiOperation({ summary: 'API usage + page-view stats / API 调用与访问统计' })
  usage() {
    const runs = this.store.getRuns();
    return {
      totalRefreshes: runs.length,
      lastRefresh: runs[0]?.startedAt,
      currentVersion: this.dataset.getMetadata()?.version,
      modelCount: this.dataset.getModels().length,
    };
  }
}
