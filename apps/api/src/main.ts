/**
 * API bootstrap — security middleware (Helmet, CORS), compression, and Swagger
 * with online "Try it out" mounted at /api/docs (8.4).
 * API 启动——安全中间件（Helmet/CORS）、压缩，以及挂载在 /api/docs 的
 * 带在线调试的 Swagger。
 */
import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { Logger } from '@nestjs/common';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import helmet from 'helmet';
import compression from 'compression';
import express from 'express';
import { existsSync } from 'fs';
import { join, resolve } from 'path';
import { AppModule } from './app.module.js';

async function bootstrap(): Promise<void> {
  const logger = new Logger('Bootstrap');
  const app = await NestFactory.create<NestExpressApplication>(AppModule);

  // Security (8.3): Helmet headers, permissive CORS for the SPA, gzip/brotli.
  // 安全：Helmet 头、面向 SPA 的 CORS、gzip 压缩。
  app.use(helmet({ contentSecurityPolicy: false })); // CSP off so Swagger UI assets load
  app.enableCors({ origin: true, credentials: true });
  app.use(compression());

  // Swagger with online debugging (8.4) mounted at /api/docs.
  // 挂载带在线调试的 Swagger 于 /api/docs。
  const config = new DocumentBuilder()
    .setTitle('models.dev Explorer API')
    .setDescription('Enterprise AI model directory REST API. All list endpoints share the { data, meta, error } envelope and the pageSize<=100 pagination contract.')
    .setVersion('0.1.0')
    .addBearerAuth() // enables the Authorize button for /refresh and /admin/* (8.4)
    .addTag('models')
    .addTag('labs')
    .addTag('catalog')
    .addTag('admin-pipeline')
    .addTag('admin')
    .build();
  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api/docs', app, document, {
    swaggerOptions: { persistAuthorization: true },
  });

  // Serve the built SPA + SPA fallback so one container serves API + frontend
  // (13.3 single container). Static assets first; unknown non-API paths → index.html.
  // 单容器同时服务 API 与前端：先静态资源，未知非 API 路径回退 index.html。
  const webDist = resolve(process.cwd(), 'apps/web/dist');
  if (existsSync(webDist)) {
    app.useStaticAssets(webDist);
    const httpAdapter = app.getHttpAdapter().getInstance() as ReturnType<typeof express>;
    httpAdapter.get(/^\/(?!api|models|labs|providers|benchmarks|pricing|stats|metadata|filters|search|status|refresh|admin).*/, (_req, res) => {
      res.sendFile(join(webDist, 'index.html'));
    });
    logger.log(`Serving SPA from ${webDist}`);
  }

  const port = Number(process.env.PORT ?? 3000);
  await app.listen(port);
  logger.log(`API listening on http://localhost:${port}`);
  logger.log(`Swagger UI (Try it out): http://localhost:${port}/api/docs`);
  logger.log(`Health: http://localhost:${port}/status`);
}

void bootstrap();
