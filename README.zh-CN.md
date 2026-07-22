# Models.dev Explorer

[English](./README.md) | [简体中文](./README.zh-CN.md)

Models.dev Explorer 是一个基于 `models.dev` 公开数据构建的模型目录平台仓库。

当前实现状态：

- Phase 0 数据快照与分析已完成。
- Phase 1 统一 Schema、Merge 策略、Zod 校验和关键单元测试已完成。
- Phase 2 数据管线已具备 CLI、增量跳过、失败不覆盖旧版本、历史版本保留。
- Phase 3 NestJS REST API 已具备主端点、Swagger、统一响应包络、ETag、缓存头、错误包络与 e2e。
- Phase 4 React P0 页面已具备模型探索器、模型详情、价格对比、国际化、深浅色模式、响应式布局与 API 文档入口。
- Phase 11 SEO 可发现性端点与持久化访问计数已实现，适用于同源部署。
- Phase 5/8 P1 页面已具备仪表盘、实验室、基准、全局命令面板与管理控制台。
- 基准对比页已支持从模型探索器/价格对比/模型详情通过 `compare=` URL 预填，页面内可搜索添加/移除模型，并提供表格、柱状图、热力图、散点图、雷达图视图。缺测基准不会被当作 0。
- 价格对比页已支持 URL 驱动排序/筛选、CSV 导出、复制、对比选择、左侧固定列与 TanStack Virtual 行虚拟渲染。
- 实验室卡片展示 logo、来源简介、模型/供应商数量、平均输入价格、平均基准分数、更新时间线与最近模型，这些数据都来自归一化后的 merged dataset。
- 细节对齐：根路径 `/` 按 `Accept-Language` 跳转到 `/en/models` 或 `/zh/models`；主题切换为 system/light/dark 三态；模型详情展示架构、权重状态、时间线、相关模型、来源与完整 Raw JSON。
- Phase 6 交付物包含 `.env.example`、Docker 单容器部署、GitHub Actions CI 和部署 Runbook。

## 命令

```bash
pnpm install --ignore-scripts
cp .env.example .env
pnpm dev
```

`pnpm dev` 会同时启动 API 和 web。web 包会读取 `apps/web/.env.development`，因此本地浏览器流量会自动指向 3002 端口上的最新 API，不需要额外设置 shell 环境变量。

## Admin Console

后台入口是 `http://localhost:3000/admin`，不会出现在公开导航、sitemap 或 robots 可抓取范围中。启动前通过环境变量配置管理员账号：

```bash
ADMIN_USERNAME=admin
ADMIN_PASSWORD_HASH='pbkdf2$210000$local-salt$...'
ADMIN_SESSION_SECRET='replace-me'
pnpm --filter @models-dev/api start
```

管理控制台覆盖数据管线刷新/回滚、隔离区与冲突、数据源健康、人工覆盖、审计日志、API 调用与页面访问统计。人工覆盖只支持后端白名单字段，避免随意写入任意路径。

## 结构

```text
apps/api              # NestJS API 与同源静态前端服务
apps/web              # React 前端
packages/shared       # 共享 TypeScript 类型与 Zod Schema
packages/data         # 数据解析、归一化、合并、验证、CLI
packages/ui           # 预留共享 UI 组件包
packages/utils        # 预留通用工具包
scripts               # 自动化脚本
docker                # Docker 资产
docs                  # 设计与分析文档
data/raw              # 上游真实快照
data/merged           # 归一化后的发布数据
data/analytics        # 运行期持久化访问计数
```

## 数据管线

当前 CLI 读取 `data/raw/` 中的真实快照：

- `api.json`
- `catalog.json`
- `labs.html`

运行 `pnpm data:refresh` 后会生成：

- `data/merged/models.json`
- `data/merged/metadata.json`

## API 与 SEO

- Swagger UI：`http://localhost:3000/api/docs`
- 健康检查：`GET /status`
- Sitemap：`GET /sitemap.xml`
- RSS：`GET /rss.xml`
- Robots：`GET /robots.txt`
- 访问计数：`POST /analytics/page-view`，并通过 `GET /stats` 的 `pageViews` 字段展示

当 `apps/web/dist` 存在时，API 进程会同源服务构建后的前端，并按路由向 SPA HTML 注入 title、description、Open Graph、Twitter Card、canonical 与 `hreflang` 标签。

## Docker

```bash
docker compose up --build
```

容器会在 `http://localhost:3000` 同时服务 API 与 React 前端。`/app/data` 挂载为 volume，因此 merged 数据和 `data/analytics/pageviews.json` 在重启后不会丢失。首次启动时如果缺少 `data/merged/models.json`，容器会自动执行 `pnpm data:refresh`。后台轻量循环按 `REFRESH_INTERVAL_SECONDS` 定时刷新数据，默认 6 小时。

部署 Runbook：[`docs/deployment.zh-CN.md`](./docs/deployment.zh-CN.md)

## 验证与 Review

本轮自验证命令：

- `pnpm test`：3 个测试文件，14 个测试通过。
- `pnpm lint`：工作区 TypeScript 源码的 ESLint 通过。
- `pnpm format:check`：工作区源码与文档的 Prettier 检查通过。
- `pnpm typecheck`：TypeScript 严格检查通过。
- `pnpm build`：shared/data/api 类型构建与 web Vite 构建通过。
- `pnpm --filter @models-dev/api test:e2e`：1 个 e2e 文件，8 个测试通过。
- `pnpm --filter @models-dev/web build`：前端 Vite 构建通过，覆盖对比选择、三态排序与价格对比虚拟滚动改动。
- Docker 镜像构建：`docker build -t models-dev-explorer:local-check .` 已通过。
- 运行时分页边界检查：`GET /models?pageSize=101` 与 `GET /models?pageSize=0` 返回 `400`；`GET /models?pageSize=100` 返回 `200` 且包含 100 行。
- 运行时检查：临时以 `PORT=3002 pnpm --filter @models-dev/api start` 启动；`Accept-Language: zh-CN...` 的 `/` 返回 `302 Location: /zh/models`，`Accept-Language: en-US...` 的 `/` 返回 `302 Location: /en/models`；`/en/models` 与 `/zh/models` HTML 均注入对应 `lang`、title、description、canonical 与 `hreflang`。
- 筛选契约检查：临时以 `PORT=3004 pnpm --filter @models-dev/api start` 启动；`GET /filters` 返回 `releaseYears`、`contextBands`、`priceBands` 与 64 个 benchmark 维度。
- Docker compose 冒烟测试：执行 `docker compose -f docker-compose.yml -f /tmp/modelsdev-compose-override.yml up -d --no-build`，容器已健康启动；`/status`、`/api/docs` 与根路径语言跳转在 3006 端口均正常响应。

已完成：

- P0：真实数据快照、统一 Schema、Merge Pipeline、API、Swagger、模型探索器/详情/价格对比、国际化、响应式、三态主题、Docker 资产。
- P1：仪表盘、实验室、基准对比、命令面板、SEO/RSS/Sitemap/robots、页面访问计数、管理控制台、人工覆盖与审计。
- Phase 6：`.env.example`、CI workflow、Dockerfile/docker-compose 和部署 Runbook 已补齐。
- 最终 Review：[`docs/final-review.zh-CN.md`](./docs/final-review.zh-CN.md)

已知限制：

- 部分模型源数据没有 `architecture` 或 `license`，详情页如实显示 `-`，不补造字段。
- Related models 是基于同 Lab / 同 family 的派生结果，不是上游显式关系字段。
- 本轮使用 HTTP、构建、e2e 和浏览器截图回归验证；Playwright 检查中 Explorer、Pricing、Benchmark、Labs 和 Detail 页面都保持在目标宽度内。
