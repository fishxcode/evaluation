import "reflect-metadata";
import { Module } from "@nestjs/common";
import { APP_FILTER, APP_GUARD, APP_INTERCEPTOR } from "@nestjs/core";
import { ThrottlerGuard } from "@nestjs/throttler";
import { ThrottlerModule } from "@nestjs/throttler";
import { AdminAuthController, AdminController } from "./admin.controller";
import { AdminAuthGuard } from "./admin-auth.guard";
import { AdminAuthService } from "./admin-auth.service";
import { AnalyticsController } from "./analytics.controller";
import { AnalyticsService } from "./analytics.service";
import { ApiUsageInterceptor } from "./api-usage.interceptor";
import { ApiUsageService } from "./api-usage.service";
import { CacheHeaderInterceptor } from "./cache-header.interceptor";
import { CatalogController } from "./catalog.controller";
import { DatasetService } from "./dataset.service";
import { HttpEnvelopeExceptionFilter } from "./http-exception.filter";
import { ManualOverrideService } from "./manual-override.service";
import { SeoController } from "./seo.controller";
import { WebController } from "./web.controller";

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
