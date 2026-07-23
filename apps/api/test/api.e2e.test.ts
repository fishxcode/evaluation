/**
 * API e2e tests (14.1/14.3) — boot the real Nest app against the merged dataset
 * and assert endpoint behavior: envelope, pagination boundaries (pageSize>100 →
 * 400, NOT silent truncation), 404s, and admin auth interception.
 * API 端到端测试——用真实数据启动 Nest，断言端点行为：包络、分页边界
 * （pageSize>100 → 400 而非静默截断）、404、admin 鉴权拦截。
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { Test } from '@nestjs/testing';
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { hashSync } from 'bcryptjs';
import { AppModule } from '../src/app.module.js';

describe('API e2e', () => {
  let app: INestApplication;

  beforeAll(async () => {
    // Admin creds for the auth-interception tests / 鉴权测试用管理员凭据
    process.env.ADMIN_USERNAME = 'admin';
    process.env.ADMIN_PASSWORD_HASH = hashSync('admin123', 10);
    process.env.JWT_SECRET = 'e2e-secret';
    process.env.REFRESH_TOKEN = 'e2e-refresh';

    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  // ---- Public endpoints ----
  it('GET /status returns ok with a data version', async () => {
    const res = await request(app.getHttpServer()).get('/status').expect(200);
    expect(res.body.data.status).toBe('ok');
    expect(typeof res.body.data.dataVersion).toBe('number');
  });

  it('GET /models returns { data, meta } envelope', async () => {
    const res = await request(app.getHttpServer()).get('/models?pageSize=5').expect(200);
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.data.length).toBeLessThanOrEqual(5);
    expect(res.body.meta).toMatchObject({ page: 1, pageSize: 5 });
    expect(res.body.meta.total).toBeGreaterThan(0);
  });

  it('GET /models?pageSize=101 → 400 (NO silent truncation)', async () => {
    const res = await request(app.getHttpServer()).get('/models?pageSize=101').expect(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
    expect(res.body.error.message).toMatch(/between 1 and 100/);
  });

  it('GET /models?pageSize=0 → 400', async () => {
    await request(app.getHttpServer()).get('/models?pageSize=0').expect(400);
  });

  it('GET /models/:lab/:slug returns a real model with offerings', async () => {
    const res = await request(app.getHttpServer()).get('/models/openai/gpt-5').expect(200);
    expect(res.body.data.id).toBe('openai/gpt-5');
    expect(Array.isArray(res.body.data.offerings)).toBe(true);
  });

  it('GET unknown model → 404', async () => {
    const res = await request(app.getHttpServer()).get('/models/nope/nope').expect(404);
    expect(res.body.error.code).toBe('NOT_FOUND');
  });

  it('GET /filters returns facets', async () => {
    const res = await request(app.getHttpServer()).get('/filters').expect(200);
    expect(Array.isArray(res.body.data.labs)).toBe(true);
    expect(Array.isArray(res.body.data.capabilities)).toBe(true);
  });

  it('GET /search filters by query', async () => {
    const res = await request(app.getHttpServer()).get('/search?q=gpt&pageSize=5').expect(200);
    expect(res.body.meta.total).toBeGreaterThan(0);
  });

  // ---- Admin auth interception (14.3) ----
  it('GET /admin/audit-logs without token → 401', async () => {
    await request(app.getHttpServer()).get('/admin/audit-logs').expect(401);
  });

  it('GET /admin/audit-logs with bogus token → 401', async () => {
    await request(app.getHttpServer())
      .get('/admin/audit-logs')
      .set('Authorization', 'Bearer bogus')
      .expect(401);
  });

  it('POST /admin/login with wrong password → 401', async () => {
    await request(app.getHttpServer())
      .post('/admin/login')
      .send({ username: 'admin', password: 'wrong' })
      .expect(401);
  });

  it('admin login → token → protected endpoint 200', async () => {
    const login = await request(app.getHttpServer())
      .post('/admin/login')
      .send({ username: 'admin', password: 'admin123' })
      .expect(201);
    const token = login.body.data.token;
    expect(typeof token).toBe('string');
    await request(app.getHttpServer())
      .get('/admin/audit-logs')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
  });

  // ---- Refresh token (8.1) ----
  it('POST /refresh with wrong token → 401', async () => {
    await request(app.getHttpServer())
      .post('/refresh')
      .set('Authorization', 'Bearer wrong')
      .expect(401);
  });
});
