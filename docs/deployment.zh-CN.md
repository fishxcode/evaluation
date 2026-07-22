# 部署 Runbook

[English](./deployment.md) | [简体中文](./deployment.zh-CN.md)

本项目面向评测和自部署使用单环境部署。后续如需 staging/production，只需要复制 compose 配置并替换环境变量，不需要改业务代码。

Vercel 部署支持前端 + Function 的单体模式。根目录 `api/index.ts` 以 Vercel Function 方式运行 NestJS，`apps/web` 作为静态客户端构建。

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

## Vercel

根目录 `vercel.json` 会构建 `apps/web`，同时把 `api/index.ts` 部署成后端 Function，并把应用路由和 API 路由重写到对应目标。

从仓库根目录部署：

```bash
pnpm install --frozen-lockfile
vercel --prod
```

验证：

```bash
curl -I https://<your-vercel-domain>/
curl https://<your-vercel-domain>/api/docs
curl https://<your-vercel-domain>/status
```

Vercel 部署不会替代 Docker 部署。生产级数据持久化仍建议走 Docker/API。Vercel 上的 admin 和 analytics 写入只会回落到可写临时目录，不具备持久性。

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
