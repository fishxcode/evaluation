/**
 * AppModule — wires data services, public controllers, global response
 * interceptor, exception filter, and rate limiting (8.3).
 * AppModule——装配数据服务、公开 controller、全局响应拦截器、异常过滤器、限流。
 */
import { Module } from '@nestjs/common';
import { APP_INTERCEPTOR, APP_FILTER, APP_GUARD } from '@nestjs/core';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { DatasetService } from './data/dataset.service.js';
import { QueryService } from './data/query.service.js';
import { PageViewsService } from './data/pageviews.service.js';
import { ModelsController } from './controllers/models.controller.js';
import { LabsController } from './controllers/labs.controller.js';
import { CatalogController } from './controllers/catalog.controller.js';
import { RefreshController } from './controllers/refresh.controller.js';
import { SeoController } from './controllers/seo.controller.js';
import { ResponseInterceptor } from './common/response.interceptor.js';
import { AllExceptionsFilter } from './common/http-exception.filter.js';
import { AdminModule } from './admin/admin.module.js';

@Module({
  imports: [
    // Rate limit: 120 requests / 60s per IP (8.3) / 限流：每 IP 每 60s 120 次
    ThrottlerModule.forRoot([{ ttl: 60_000, limit: 120 }]),
    AdminModule,
  ],
  controllers: [ModelsController, LabsController, CatalogController, RefreshController, SeoController],
  providers: [
    DatasetService,
    QueryService,
    PageViewsService,
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_INTERCEPTOR, useClass: ResponseInterceptor },
    { provide: APP_FILTER, useClass: AllExceptionsFilter },
  ],
  exports: [DatasetService, QueryService],
})
export class AppModule {}
