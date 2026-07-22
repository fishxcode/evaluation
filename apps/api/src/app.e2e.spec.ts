import "reflect-metadata";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import { DocumentBuilder, SwaggerModule } from "@nestjs/swagger";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { AdminAuthService } from "./admin-auth.service";
import { AppModule } from "./app.module";

describe("Models API", () => {
  let app: INestApplication;
  let analyticsDir: string;
  let adminDir: string;

  beforeAll(async () => {
    analyticsDir = fs.mkdtempSync(path.join(os.tmpdir(), "models-dev-api-"));
    adminDir = fs.mkdtempSync(path.join(os.tmpdir(), "models-dev-admin-"));
    process.env.ANALYTICS_STATE_PATH = path.join(
      analyticsDir,
      "pageviews.json",
    );
    process.env.API_USAGE_STATE_PATH = path.join(adminDir, "api-usage.json");
    process.env.ADMIN_STATE_DIR = adminDir;
    process.env.ADMIN_USERNAME = "admin";
    process.env.ADMIN_PASSWORD_HASH = AdminAuthService.hashPassword(
      "correct-password",
      "e2e-salt",
    );
    process.env.ADMIN_SESSION_SECRET = "e2e-session-secret";

    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleRef.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    await app.close();
    delete process.env.ANALYTICS_STATE_PATH;
    delete process.env.API_USAGE_STATE_PATH;
    delete process.env.ADMIN_STATE_DIR;
    delete process.env.ADMIN_USERNAME;
    delete process.env.ADMIN_PASSWORD_HASH;
    delete process.env.ADMIN_SESSION_SECRET;
    fs.rmSync(analyticsDir, { recursive: true, force: true });
    fs.rmSync(adminDir, { recursive: true, force: true });
  });

  it("returns paginated, filtered, and sorted models in the shared response envelope", async () => {
    const response = await request(app.getHttpServer())
      .get("/models")
      .query({
        page: 1,
        pageSize: 5,
        lab: "openai",
        provider: "openai",
        sort: "price",
        order: "asc",
      })
      .expect(200);

    expect(response.body.error).toBeNull();
    expect(response.headers.etag).toMatch(/^"[a-f0-9]{64}"$/);
    expect(response.headers["cache-control"]).toContain("max-age=60");
    expect(response.body.meta).toMatchObject({ page: 1, pageSize: 5 });
    expect(response.body.data.length).toBeGreaterThan(0);
    expect(
      response.body.data.every(
        (model: {
          lab: { id: string };
          offerings: Array<{ provider: { id: string } }>;
        }) => {
          return (
            model.lab.id === "openai" &&
            model.offerings.some(
              (offering) => offering.provider.id === "openai",
            )
          );
        },
      ),
    ).toBe(true);
  });

  it("rejects page sizes outside the shared 1..100 pagination contract", async () => {
    const overLimit = await request(app.getHttpServer())
      .get("/models")
      .query({ pageSize: 101 })
      .expect(400);
    expect(overLimit.body.error).toMatchObject({ code: "bad_request" });
    expect(overLimit.body.error.message).toContain("pageSize");

    const underLimit = await request(app.getHttpServer())
      .get("/models")
      .query({ pageSize: 0 })
      .expect(400);
    expect(underLimit.body.error).toMatchObject({ code: "bad_request" });
    expect(underLimit.body.error.message).toContain("pageSize");
  });

  it("serves model detail, dimensions, search, and pricing endpoints from real merged data", async () => {
    const detail = await request(app.getHttpServer())
      .get("/models/openai%2Fgpt-4o")
      .expect(200);
    expect(detail.body.data.id).toBe("openai/gpt-4o");
    expect(detail.body.data.offerings.length).toBeGreaterThan(0);

    const labs = await request(app.getHttpServer()).get("/labs").expect(200);
    expect(
      labs.body.data.some((lab: { id: string }) => lab.id === "openai"),
    ).toBe(true);
    const openaiLab = labs.body.data.find(
      (lab: {
        id: string;
        models?: Array<{ id: string }>;
        averageInputPrice?: number;
        averageBenchmarkScore?: number;
      }) => lab.id === "openai",
    );
    expect(openaiLab?.models?.length).toBeGreaterThan(0);
    expect(openaiLab?.averageInputPrice).toEqual(expect.any(Number));
    expect(openaiLab?.averageBenchmarkScore).toEqual(expect.any(Number));

    const labDetail = await request(app.getHttpServer())
      .get("/labs/openai")
      .expect(200);
    expect(labDetail.body.data.models.length).toBeGreaterThan(0);

    const providers = await request(app.getHttpServer())
      .get("/providers")
      .expect(200);
    expect(
      providers.body.data.some(
        (provider: { id: string }) => provider.id === "openai",
      ),
    ).toBe(true);

    const filters = await request(app.getHttpServer())
      .get("/filters")
      .expect(200);
    expect(filters.body.data.labs).toContain("openai");
    expect(filters.body.data.providers).toContain("openai");

    const search = await request(app.getHttpServer())
      .get("/search")
      .query({ q: "gpt-4o" })
      .expect(200);
    expect(
      search.body.data.some(
        (item: { id: string }) => item.id === "openai/gpt-4o",
      ),
    ).toBe(true);

    const pricing = await request(app.getHttpServer())
      .get("/pricing")
      .query({ provider: "openai" })
      .expect(200);
    expect(
      pricing.body.data.some(
        (row: { modelId: string }) => row.modelId === "openai/gpt-4o",
      ),
    ).toBe(true);

    const stats = await request(app.getHttpServer()).get("/stats").expect(200);
    expect(stats.body.data.modelCount).toBeGreaterThan(0);

    const metadata = await request(app.getHttpServer())
      .get("/metadata")
      .expect(200);
    expect(metadata.body.data.contentHash).toMatch(/^[a-f0-9]{64}$/);

    const status = await request(app.getHttpServer())
      .get("/status")
      .expect(200);
    expect(status.body.data).toMatchObject({
      status: "ok",
      version: metadata.body.data.version,
    });
    expect(Object.keys(status.body.data.sourceStatus)).toEqual(
      expect.arrayContaining(["api", "catalog", "labs"]),
    );
  });

  it("returns errors in the shared response envelope", async () => {
    const response = await request(app.getHttpServer())
      .get("/models/missing-model")
      .expect(404);

    expect(response.body.data).toBeNull();
    expect(response.body.error).toMatchObject({
      code: "not_found",
      message: "Model not found: missing-model",
    });
  });

  it("persists page view counts and exposes them through stats", async () => {
    const before = await request(app.getHttpServer()).get("/stats").expect(200);

    const pageView = await request(app.getHttpServer())
      .post("/analytics/page-view")
      .set("x-page-session", "e2e-session")
      .set("user-agent", "vitest")
      .send({ path: "/en/models" })
      .expect(201);

    expect(pageView.body.data).toMatchObject({
      counted: true,
      pageViews: Number(before.body.data.pageViews ?? 0) + 1,
    });
    expect(fs.existsSync(path.join(analyticsDir, "pageviews.json"))).toBe(true);

    const after = await request(app.getHttpServer()).get("/stats").expect(200);
    expect(after.body.data.pageViews).toBe(
      Number(before.body.data.pageViews ?? 0) + 1,
    );
  });

  it("serves crawler discovery documents from the live dataset", async () => {
    const robots = await request(app.getHttpServer())
      .get("/robots.txt")
      .expect(200);
    expect(robots.text).toContain("Disallow: /admin");
    expect(robots.text).toContain("Sitemap: http://localhost:3000/sitemap.xml");

    const sitemap = await request(app.getHttpServer())
      .get("/sitemap.xml")
      .expect(200);
    expect(sitemap.text).toContain(
      "<loc>http://localhost:3000/en/models</loc>",
    );
    expect(sitemap.text).toContain(encodeURIComponent("openai/gpt-4o"));

    const rss = await request(app.getHttpServer()).get("/rss.xml").expect(200);
    expect(rss.text).toContain('<rss version="2.0">');
    expect(rss.text).toContain("<item>");
  });

  it("protects admin APIs and applies manual overrides with audit logs", async () => {
    await request(app.getHttpServer()).get("/admin/quarantine").expect(401);

    const login = await request(app.getHttpServer())
      .post("/admin/login")
      .send({ username: "admin", password: "correct-password" })
      .expect(201);
    const token = login.body.data.token as string;
    expect(token).toContain(".");

    const health = await request(app.getHttpServer())
      .get("/admin/sources/health")
      .set("authorization", `Bearer ${token}`)
      .expect(200);
    expect(Object.keys(health.body.data)).toEqual(
      expect.arrayContaining(["api", "catalog", "labs"]),
    );

    const quarantine = await request(app.getHttpServer())
      .get("/admin/quarantine")
      .set("authorization", `Bearer ${token}`)
      .expect(200);
    expect(quarantine.body.data).toHaveProperty("quarantine");
    expect(quarantine.body.data).toHaveProperty("conflicts");

    const description = "E2E manual override description";
    await request(app.getHttpServer())
      .put("/admin/models/openai%2Fgpt-4o/overrides")
      .set("authorization", `Bearer ${token}`)
      .send({ field: "description", value: description })
      .expect(200);

    const detail = await request(app.getHttpServer())
      .get("/models/openai%2Fgpt-4o")
      .expect(200);
    expect(detail.body.data.description).toBe(description);

    const audit = await request(app.getHttpServer())
      .get("/admin/audit-logs")
      .set("authorization", `Bearer ${token}`)
      .expect(200);
    expect(
      audit.body.data.some(
        (entry: { action: string; actor: string }) =>
          entry.action === "model.override.set" && entry.actor === "admin",
      ),
    ).toBe(true);

    const usage = await request(app.getHttpServer())
      .get("/admin/usage/stats")
      .set("authorization", `Bearer ${token}`)
      .expect(200);
    expect(usage.body.data.api.total).toBeGreaterThan(0);

    await request(app.getHttpServer())
      .delete("/admin/models/openai%2Fgpt-4o/overrides/description")
      .set("authorization", `Bearer ${token}`)
      .expect(200);
    const restored = await request(app.getHttpServer())
      .get("/models/openai%2Fgpt-4o")
      .expect(200);
    expect(restored.body.data.description).not.toBe(description);
  });

  it("generates an OpenAPI document for interactive Swagger docs", () => {
    const config = new DocumentBuilder()
      .setTitle("Models.dev Explorer API")
      .setDescription("Typed model catalog API.\n类型化模型目录 API。")
      .setVersion("0.1.0")
      .addBearerAuth()
      .build();
    const document = SwaggerModule.createDocument(app, config);

    expect(document.paths["/models"]?.get?.responses["200"]).toBeDefined();
    expect(document.paths["/status"]?.get?.responses["200"]).toBeDefined();
    expect(document.paths["/refresh"]?.post?.responses["201"]).toBeDefined();
    expect(
      document.paths["/analytics/page-view"]?.post?.responses["201"],
    ).toBeDefined();
    expect(
      document.paths["/admin/login"]?.post?.responses["201"],
    ).toBeDefined();
    expect(
      document.paths["/admin/quarantine"]?.get?.responses["200"],
    ).toBeDefined();
  });
});
