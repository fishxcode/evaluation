import "reflect-metadata";
import compression from "compression";
import helmet from "helmet";
import { NestFactory } from "@nestjs/core";
import { type NestExpressApplication } from "@nestjs/platform-express";
import { DocumentBuilder, SwaggerModule } from "@nestjs/swagger";
import { AppModule } from "./app.module.js";
import { findClientDist } from "./client-dist.js";

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  app.enableCors();
  app.use(helmet());
  app.use(compression());

  const clientDist = findClientDist();
  if (clientDist) {
    app.useStaticAssets(clientDist, {
      index: false,
      maxAge: "1y",
    });
  }

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

  await app.listen(Number(process.env.PORT ?? 3000));
}

bootstrap();
