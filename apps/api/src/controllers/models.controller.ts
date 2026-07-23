/**
 * ModelsController — GET /models (list, filter, sort, paginate) + GET /models/:id.
 * ModelsController——模型列表（过滤/排序/分页）+ 单模型详情。
 */
import { Controller, Get, Param, Query, NotFoundException } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiQuery, ApiParam, ApiResponse as SwaggerResponse } from '@nestjs/swagger';
import { modelQuerySchema, type ModelQuery } from '@models-dev/shared';
import { QueryService } from '../data/query.service.js';
import { DatasetService } from '../data/dataset.service.js';
import { ZodValidationPipe } from '../common/zod-validation.pipe.js';

@ApiTags('models')
@Controller('models')
export class ModelsController {
  constructor(
    private readonly query: QueryService,
    private readonly dataset: DatasetService,
  ) {}

  /**
   * List models with filtering, sorting, pagination, and search.
   * 列出模型，支持过滤、排序、分页、搜索。
   */
  @Get()
  @ApiOperation({ summary: 'List models (filter/sort/paginate/search) / 列出模型' })
  @ApiQuery({ name: 'page', required: false, example: 1, description: 'Page number from 1 / 页码' })
  @ApiQuery({ name: 'pageSize', required: false, example: 20, description: 'Items per page 1-100 / 每页条数' })
  @ApiQuery({ name: 'q', required: false, example: 'gpt', description: 'Search query / 搜索词' })
  @ApiQuery({ name: 'lab', required: false, example: 'openai', description: 'Filter by lab / 按 Lab 过滤' })
  @ApiQuery({ name: 'provider', required: false, description: 'Filter by provider / 按 Provider 过滤' })
  @ApiQuery({ name: 'capability', required: false, example: 'reasoning', description: 'Filter by capability' })
  @ApiQuery({ name: 'modality', required: false, example: 'image', description: 'Filter by input modality' })
  @ApiQuery({ name: 'openWeights', required: false, example: true, description: 'Filter open-weight models' })
  @ApiQuery({ name: 'minContext', required: false, description: 'Min context window / 最小上下文' })
  @ApiQuery({ name: 'maxContext', required: false, description: 'Max context window / 最大上下文' })
  @ApiQuery({ name: 'minPrice', required: false, description: 'Min input price USD/1M' })
  @ApiQuery({ name: 'maxPrice', required: false, description: 'Max input price USD/1M' })
  @ApiQuery({ name: 'sort', required: false, enum: ['name', 'releaseDate', 'price', 'context', 'benchmark', 'lastUpdated'] })
  @ApiQuery({ name: 'order', required: false, enum: ['asc', 'desc'] })
  @SwaggerResponse({ status: 200, description: 'Paginated model list with { data, meta }' })
  @SwaggerResponse({ status: 400, description: 'Invalid params (e.g. pageSize>100)' })
  list(@Query(new ZodValidationPipe(modelQuerySchema)) q: ModelQuery) {
    return this.query.queryModels(q);
  }

  /**
   * Get one model by canonical id (lab/slug).
   * 按规范 id（lab/slug）获取单个模型。
   */
  @Get(':lab/:slug')
  @ApiOperation({ summary: 'Get model by id (lab/slug) / 按 id 获取模型' })
  @ApiParam({ name: 'lab', example: 'openai' })
  @ApiParam({ name: 'slug', example: 'gpt-5' })
  @SwaggerResponse({ status: 200, description: 'Model detail' })
  @SwaggerResponse({ status: 404, description: 'Model not found' })
  getById(@Param('lab') lab: string, @Param('slug') slug: string) {
    const id = `${lab}/${slug}`;
    const model = this.dataset.findModel(id);
    if (!model) throw new NotFoundException({ code: 'NOT_FOUND', message: `Model '${id}' not found` });
    return model;
  }
}
