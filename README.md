# Models.dev Explorer

[English](./README.md) | [简体中文](./README.zh-CN.md)

Models.dev Explorer is a monorepo for building a production-grade AI model catalog on top of real `models.dev` data.

Current implementation status:

- Phase 0 data snapshots and analysis are complete.
- Phase 1 normalized schema, merge strategy, Zod validation, and focused tests are complete.
- Phase 2 data refresh has a CLI with incremental skip, rollback-safe publishing, and history retention.
- Phase 3 NestJS REST API includes the public catalog endpoints, `/status`, Swagger at `/api/docs`, response envelopes, ETag/cache headers, errors, and e2e coverage.
- Phase 4 React P0 pages include Explorer, Model Detail, Pricing Compare, i18n, dark/light mode, responsive layouts, and an API Docs entry.
- Phase 11 SEO discovery endpoints and persistent page-view counting are implemented for same-origin deployments.
- Phase 5/8 P1 surfaces include Dashboard, Labs, Benchmark, global command palette, and Admin Console.
- Benchmark Compare supports `compare=` URL prefill from Explorer/Pricing/Model Detail, plus in-page model search/add/remove and Table/Bar/Heatmap/Scatter/Radar views. Missing benchmark values render as `-`, not zero.
- Pricing Compare uses URL-driven sorting/filtering, CSV/export actions, compare selection, fixed left columns, and TanStack Virtual row rendering.
- Labs cards show logo, source description, model/provider counts, average input price, average benchmark score, update timeline, and recent models derived from the merged dataset.
- Alignment details: `/` redirects to `/en/models` or `/zh/models` from `Accept-Language`; theme mode is system/light/dark; Model Detail includes architecture, weights status, timeline, related models, sources, and full raw JSON.
- Phase 6 deliverables include `.env.example`, Docker single-container deployment, GitHub Actions CI, and deployment runbook.

## Commands

```bash
pnpm install --ignore-scripts
cp .env.example .env
pnpm dev
```

`pnpm dev` launches the API and web apps together. The web package reads `apps/web/.env.development`, so local browser traffic points at the latest API on port 3002 without extra shell variables.

## Admin Console

The admin entry is `http://localhost:3000/admin`. It is excluded from public navigation, sitemap, and robots discovery. Configure credentials through environment variables before starting the API:

```bash
ADMIN_USERNAME=admin
ADMIN_PASSWORD_HASH='pbkdf2$210000$local-salt$...'
ADMIN_SESSION_SECRET='replace-me'
pnpm --filter @models-dev/api start
```

Admin Console covers pipeline refresh/rollback, quarantine and conflicts, source health, manual overrides, audit logs, API usage, and page-view stats. Manual overrides are restricted to a backend whitelist of supported fields.

## Structure

```text
apps/api              # NestJS API and same-origin static web serving
apps/web              # React frontend
packages/shared       # shared TypeScript types and Zod schemas
packages/data         # data parsing, normalization, merge, validation, CLI
packages/ui           # reserved shared UI package
packages/utils        # reserved shared utilities package
scripts               # automation scripts
docker                # Docker assets
docs                  # design and analysis documents
data/raw              # captured upstream snapshots
data/merged           # normalized generated dataset
data/analytics        # persisted runtime page-view counters
```

## Data Pipeline

The current CLI expects real snapshots in `data/raw/`:

- `api.json`
- `catalog.json`
- `labs.html`

Run `pnpm data:refresh` to produce:

- `data/merged/models.json`
- `data/merged/metadata.json`

## API And SEO

- Swagger UI: `http://localhost:3000/api/docs`
- Health check: `GET /status`
- Sitemap: `GET /sitemap.xml`
- RSS feed: `GET /rss.xml`
- Robots: `GET /robots.txt`
- Page views: `POST /analytics/page-view`, surfaced through `GET /stats` as `pageViews`

When `apps/web/dist` exists, the API process serves the built frontend from the same origin and injects route-specific title, description, Open Graph, Twitter Card, canonical, and `hreflang` tags into the SPA HTML.

## Docker

```bash
docker compose up --build
```

The container serves the API and built React app on `http://localhost:3000`. `/app/data` is mounted as a volume so merged data and `data/analytics/pageviews.json` survive restarts. On first boot, the container runs `pnpm data:refresh` if `data/merged/models.json` is missing. A lightweight background loop refreshes data every `REFRESH_INTERVAL_SECONDS` seconds; the default is 6 hours.

Deployment runbook: [`docs/deployment.md`](./docs/deployment.md)

## Verification And Review

Fresh verification commands:

- `pnpm test`: 3 test files, 14 tests passed.
- `pnpm lint`: ESLint passed on the workspace TypeScript sources.
- `pnpm format:check`: Prettier check passed on the workspace sources and docs.
- `pnpm typecheck`: TypeScript strict check passed.
- `pnpm build`: shared/data/api type builds and web Vite build passed.
- `pnpm --filter @models-dev/api test:e2e`: 1 e2e file, 8 tests passed.
- `pnpm --filter @models-dev/web build`: web Vite build passed for compare-selection, three-state sorting, and Pricing Compare virtual scrolling changes.
- Docker image build: `docker build -t models-dev-explorer:local-check .` passed.
- Runtime pagination boundary check: `GET /models?pageSize=101` and `GET /models?pageSize=0` return `400`; `GET /models?pageSize=100` returns `200` with 100 rows.
- Runtime check: started the API with `PORT=3002 pnpm --filter @models-dev/api start`; `/` returned `302 Location: /zh/models` for `Accept-Language: zh-CN...` and `302 Location: /en/models` for `Accept-Language: en-US...`; `/en/models` and `/zh/models` HTML included matching `lang`, title, description, canonical, and `hreflang` tags.
- Filter contract check: started the API with `PORT=3004 pnpm --filter @models-dev/api start`; `GET /filters` returned `releaseYears`, `contextBands`, `priceBands`, and 64 benchmark dimensions.
- Docker compose smoke test: `docker compose -f docker-compose.yml -f /tmp/modelsdev-compose-override.yml up -d --no-build` started a healthy container; `/status`, `/api/docs`, and root-language redirects all responded correctly on port 3006.

Completed:

- P0: real data snapshots, normalized schema, merge pipeline, API, Swagger, Explorer/Detail/Pricing, i18n, responsive layout, three-state theme, and Docker assets.
- P1: Dashboard, Labs, Benchmark Compare, command palette, SEO/RSS/Sitemap/robots, page-view counting, Admin Console, manual overrides, and audit logs.
- Phase 6: `.env.example`, CI workflow, Dockerfile/docker-compose, and deployment runbook are present.
- Final Review: [`docs/final-review.md`](./docs/final-review.md)

Known limits:

- Some upstream model records do not include `architecture` or `license`; detail pages display `-` instead of inventing values.
- Related models are derived from the same lab/family, not from an upstream explicit relationship field.
- This pass used HTTP, build, e2e, and browser screenshot regression verification; Explorer, Pricing, Benchmark, Labs, and Detail pages all held at their target widths in Playwright checks.
