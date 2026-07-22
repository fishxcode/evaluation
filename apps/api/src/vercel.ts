import "reflect-metadata";
import os from "node:os";
import path from "node:path";
import type { IncomingMessage, ServerResponse } from "node:http";
import compression from "compression";
import helmet from "helmet";
import { NestFactory } from "@nestjs/core";
import { type NestExpressApplication } from "@nestjs/platform-express";
import { DocumentBuilder, SwaggerModule } from "@nestjs/swagger";
import { AppModule } from "./app.module.js";

type ServerHandler = (
  request: IncomingMessage,
  response: ServerResponse,
) => void;

let cachedServer: ServerHandler | undefined;

function setDefaultEnv(name: string, value: string) {
  if (!process.env[name]) process.env[name] = value;
}

function configureServerlessEnvironment() {
  const tmpRoot = path.join(os.tmpdir(), "models-dev-explorer");
  setDefaultEnv(
    "ANALYTICS_STATE_PATH",
    path.join(tmpRoot, "analytics", "pageviews.json"),
  );
  setDefaultEnv(
    "API_USAGE_STATE_PATH",
    path.join(tmpRoot, "admin", "api-usage.json"),
  );
  setDefaultEnv("ADMIN_STATE_DIR", path.join(tmpRoot, "admin"));
}

async function bootstrapServer() {
  if (!cachedServer) {
    configureServerlessEnvironment();

    const app = await NestFactory.create<NestExpressApplication>(AppModule);
    app.enableCors();
    app.use(helmet());
    app.use(compression());

    const config = new DocumentBuilder()
      .setTitle("Models.dev Explorer API")
      .setDescription("Typed model catalog API.\n类型化模型目录 API。")
      .setVersion("0.1.0")
      .addBearerAuth()
      .build();
    SwaggerModule.setup(
      "api/docs",
      app,
      SwaggerModule.createDocument(app, config),
    );

    await app.init();
    cachedServer = app.getHttpAdapter().getInstance() as ServerHandler;
  }

  return cachedServer;
}

export default async function handler(
  request: IncomingMessage,
  response: ServerResponse,
) {
  const server = await bootstrapServer();
  server(request, response);
}
