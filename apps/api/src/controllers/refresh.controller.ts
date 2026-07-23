/**
 * RefreshController — POST /refresh triggers the data pipeline (8.1). Requires
 * the REFRESH_TOKEN bearer token (simple token auth, distinct from admin JWT).
 * RefreshController——POST /refresh 触发数据管线。需 REFRESH_TOKEN bearer（
 * 简单 token 鉴权，与 admin JWT 区分）。
 */
import { Controller, Post, Headers, UnauthorizedException } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiResponse } from '@nestjs/swagger';
import { refresh } from '@models-dev/data';
import { DatasetService } from '../data/dataset.service.js';

@ApiTags('admin-pipeline')
@ApiBearerAuth()
@Controller('refresh')
export class RefreshController {
  constructor(private readonly dataset: DatasetService) {}

  /**
   * Trigger a data refresh, then hot-reload the in-memory dataset.
   * 触发数据刷新，随后热重载内存数据集。
   */
  @Post()
  @ApiOperation({ summary: 'Trigger data pipeline refresh (token required) / 触发数据刷新（需 token）' })
  @ApiResponse({ status: 200, description: 'Refresh result with new version' })
  @ApiResponse({ status: 401, description: 'Missing/invalid REFRESH_TOKEN' })
  async trigger(@Headers('authorization') auth?: string) {
    const expected = process.env.REFRESH_TOKEN;
    const token = auth?.replace(/^Bearer\s+/i, '');
    if (!expected || token !== expected) {
      throw new UnauthorizedException({ code: 'UNAUTHORIZED', message: 'Invalid or missing refresh token' });
    }
    const result = await refresh({ dataDir: this.dataset.getDataDir(), trigger: 'api' });
    // Reload in-memory data without restart (hot reload) / 不重启热重载内存数据
    this.dataset.reload();
    return {
      ok: result.ok,
      version: result.version,
      modelCount: result.modelCount,
      quarantinedCount: result.quarantinedCount,
      conflictCount: result.conflictCount,
      skipped: result.skipped,
      durationMs: result.durationMs,
      error: result.error,
    };
  }
}
