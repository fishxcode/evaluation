# 部署 Runbook

[English](./deployment.md) | [简体中文](./deployment.zh-CN.md)

本项目面向评测和自部署使用单环境部署。后续如需 staging/production，只需要复制 compose 配置并替换环境变量，不需要改业务代码。

Vercel 部署支持 React 前端。API 仍作为独立 NestJS 服务部署，因为生产 API 负责数据刷新、Admin Console 写操作、analytics 持久化、Swagger、sitemap、RSS，以及基于本地 `data/` 状态的 SEO HTML 注入。

## 准备

```bash
cp .env.example .env
vim .env
```

必填变量：

- `PORT`：API 监听端口。
- `NODE_ENV`：`production` 或 `development`。
- `REFRESH_TOKEN`：`POST /refresh` 鉴权 token。
- `ADMIN_USERNAME`：Admin Console 初始用户名。
- `ADMIN_PASSWORD_HASH`：PBKDF2 管理员密码哈希。
- `ADMIN_SESSION_SECRET` / `JWT_SECRET`：后台登录态签名密钥。

## 构建与启动

```bash
docker compose build
docker compose up -d
```

首次启动时，如果 `/app/data/merged/models.json` 不存在，容器会先执行 `pnpm data:refresh`。随后同源服务 API 与构建后的 React 前端。

## 验证

```bash
curl http://localhost:${PORT:-3000}/status
curl http://localhost:${PORT:-3000}/api/docs
curl -I -H 'Accept-Language: zh-CN,zh;q=0.9,en;q=0.8' http://localhost:${PORT:-3000}/
```

部署通过条件：`/status` 返回 `200`，Swagger UI 可通过 `/api/docs` 访问，`/` 能跳转到带语言前缀的应用路由。

## Vercel 前端

根目录 `vercel.json` 会使用 pnpm 构建 `apps/web`，并把 `apps/web/dist` 作为 Vite SPA 发布。

部署前在 Vercel 配置这个环境变量：

- `VITE_API_BASE_URL`：已部署 NestJS API 的公网地址，例如 `https://api.example.com`。

从仓库根目录部署：

```bash
pnpm install --frozen-lockfile
pnpm --filter @models-dev/web build
vercel --prod
```

验证：

```bash
curl -I https://<your-vercel-domain>/
curl https://<your-api-domain>/status
```

Vercel 部署不会替代 Docker/API 部署。需要 canonical、sitemap、RSS 和 Open Graph 元数据指向 Vercel 域名时，请在 API 侧把 `PUBLIC_SITE_URL` 设置为最终公开站点地址。

## 日志

```bash
docker compose logs -f models-dev-explorer
```

## 数据回滚

数据回滚由 Admin Console 执行，不依赖 Docker 镜像 tag。打开 `/admin` 登录，查看管线版本，并选择目标数据版本回滚。API 会重新读取 `data/merged`，无需重启服务。

## 部署回滚

部署回滚用于代码或镜像故障。保留上一个已知可用镜像 tag，然后把 compose 指回该 tag：

```bash
docker tag models-dev-explorer:previous-good models-dev-explorer:local
docker compose up -d
curl http://localhost:${PORT:-3000}/status
```

两类回滚刻意分离：源数据错误走 Admin 数据回滚；应用代码错误走镜像回滚。
