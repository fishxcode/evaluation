/**
 * Vercel serverless entry (13.6) — wraps the NestJS app in an Express instance
 * and caches it across invocations (warm starts). The dataset is read from the
 * build-time snapshot bundled via vercel.json includeFiles.
 * Vercel serverless 入口——将 NestJS 包进 Express 实例并跨调用缓存（热启动）。
 * 数据集从 vercel.json includeFiles 打包的构建期快照读取。
 *
 * Tradeoffs (documented in docs/deployment.md §Vercel):
 * - Read-only FS: POST /refresh writes only to /tmp (ephemeral); persistent
 *   refresh uses Vercel Cron rebuilding the snapshot. Overrides/audit likewise
 *   ephemeral on serverless.
 * 权衡（见 docs/deployment.md）：只读 FS——POST /refresh 仅写 /tmp（临时）；
 * 持久刷新用 Vercel Cron 重建快照。
 */
import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { ExpressAdapter, type NestExpressApplication } from '@nestjs/platform-express';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import helmet from 'helmet';
import compression from 'compression';
import express, { type Express, type Request, type Response } from 'express';
import { AppModule } from './app.module.js';

let cachedApp: Express | null = null;

/** Bootstrap the Nest app once, reuse across warm invocations / 仅启动一次，热调用复用 */
async function bootstrap(): Promise<Express> {
  if (cachedApp) return cachedApp;

  const expressApp = express();
  // Cast works around duplicate @nestjs/core type copies under pnpm nesting.
  // 强转规避 pnpm 嵌套下 @nestjs/core 类型副本重复的问题。
  const adapter = new ExpressAdapter(expressApp) as never;
  const app = await NestFactory.create<NestExpressApplication>(
    AppModule,
    adapter,
    { logger: ['error', 'warn'] },
  );
  app.use(helmet({ contentSecurityPolicy: false }));
  app.enableCors({ origin: true, credentials: true });
  app.use(compression());

  const config = new DocumentBuilder()
    .setTitle('models.dev Explorer API')
    .setDescription('Enterprise AI model directory REST API.')
    .setVersion('0.1.0')
    .addBearerAuth()
    .build();
  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api/docs', app, document, { swaggerOptions: { persistAuthorization: true } });

  await app.init();
  cachedApp = expressApp;
  return expressApp;
}

/** Vercel serverless handler / Vercel serverless 处理器 */
export default async function handler(req: Request, res: Response): Promise<void> {
  try {
    const server = await bootstrap();
    server(req, res);
  } catch (err) {
    // Surface the real cold-start error instead of an opaque
    // FUNCTION_INVOCATION_FAILED, so it can be diagnosed from the response.
    // 暴露真实冷启动错误而非不透明的 FUNCTION_INVOCATION_FAILED，便于诊断。
    const e = err as Error;
    // eslint-disable-next-line no-console
    console.error('BOOTSTRAP_FAILED', e?.stack ?? e?.message ?? String(err));
    res.statusCode = 500;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({
      data: null,
      error: { code: 'BOOTSTRAP_FAILED', message: e?.message ?? String(err), stack: (e?.stack ?? '').split('\n').slice(0, 6) },
    }));
  }
}
