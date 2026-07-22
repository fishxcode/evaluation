import "reflect-metadata";
import { Module } from "@nestjs/common";
import { APP_FILTER, APP_GUARD, APP_INTERCEPTOR } from "@nestjs/core";
import { ThrottlerGuard } from "@nestjs/throttler";
import { ThrottlerModule } from "@nestjs/throttler";
import { AdminAuthController, AdminController } from "./admin.controller.js";
import { AdminAuthGuard } from "./admin-auth.guard.js";
import { AdminAuthService } from "./admin-auth.service.js";
import { AnalyticsController } from "./analytics.controller.js";
import { AnalyticsService } from "./analytics.service.js";
import { ApiUsageInterceptor } from "./api-usage.interceptor.js";
import { ApiUsageService } from "./api-usage.service.js";
import { CacheHeaderInterceptor } from "./cache-header.interceptor.js";
import { CatalogController } from "./catalog.controller.js";
import { DatasetService } from "./dataset.service.js";
import { HttpEnvelopeExceptionFilter } from "./http-exception.filter.js";
import { ManualOverrideService } from "./manual-override.service.js";
import { SeoController } from "./seo.controller.js";
import { WebController } from "./web.controller.js";

@Module({
  imports: [
    ThrottlerModule.forRoot([
      {
        ttl: 60_000,
        limit: 120,
      },
    ]),
  ],
  controllers: [
    AdminAuthController,
    AdminController,
    AnalyticsController,
    CatalogController,
    SeoController,
    WebController,
  ],
  providers: [
    AdminAuthGuard,
    AdminAuthService,
    AnalyticsService,
    ApiUsageService,
    DatasetService,
    ManualOverrideService,
    { provide: APP_FILTER, useClass: HttpEnvelopeExceptionFilter },
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_INTERCEPTOR, useClass: ApiUsageInterceptor },
    { provide: APP_INTERCEPTOR, useClass: CacheHeaderInterceptor },
  ],
})
export class AppModule {}
