/**
 * LabsController — GET /labs (paginated) + GET /labs/:id (with its models).
 * LabsController——Lab 列表（分页）+ 单 Lab（含旗下模型）。
 */
import { Controller, Get, Param, Query, NotFoundException } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiParam, ApiQuery } from '@nestjs/swagger';
import { paginationQuerySchema, type PaginationQuery } from '@models-dev/shared';
import { DatasetService } from '../data/dataset.service.js';
import { ZodValidationPipe } from '../common/zod-validation.pipe.js';

@ApiTags('labs')
@Controller('labs')
export class LabsController {
  constructor(private readonly dataset: DatasetService) {}

  @Get()
  @ApiOperation({ summary: 'List labs (paginated) / 列出 Lab' })
  @ApiQuery({ name: 'page', required: false, example: 1 })
  @ApiQuery({ name: 'pageSize', required: false, example: 20 })
  list(@Query(new ZodValidationPipe(paginationQuerySchema)) q: PaginationQuery) {
    const all = this.dataset.getLabs();
    const total = all.length;
    const totalPages = Math.max(1, Math.ceil(total / q.pageSize));
    const data = all.slice((q.page - 1) * q.pageSize, (q.page - 1) * q.pageSize + q.pageSize);
    return { data, meta: { page: q.page, pageSize: q.pageSize, total, totalPages } };
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get lab by id with its models / 按 id 获取 Lab 及旗下模型' })
  @ApiParam({ name: 'id', example: 'openai' })
  getById(@Param('id') id: string) {
    const lab = this.dataset.findLab(id);
    if (!lab) throw new NotFoundException({ code: 'NOT_FOUND', message: `Lab '${id}' not found` });
    const models = this.dataset.getModels().filter(m => m.lab.id === id);
    return { ...lab, models };
  }
}
