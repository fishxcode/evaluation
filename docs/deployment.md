# Deployment Runbook

[English](./deployment.md) | [简体中文](./deployment.zh-CN.md)

This project uses one Docker environment for evaluation and self-hosting. Staging and production can later be split by copying the compose file and changing environment variables only.

Vercel deployment is supported as a single frontend-plus-function app. The root `api/index.ts` file runs the NestJS app as a Vercel Function, while `apps/web` is built as the static client.

## Prepare

```bash
cp .env.example .env
vim .env
```

Required values:

- `PORT`: API listen port.
- `NODE_ENV`: `production` or `development`.
- `REFRESH_TOKEN`: token for `POST /refresh`.
- `ADMIN_USERNAME`: initial Admin Console username.
- `ADMIN_PASSWORD_HASH`: PBKDF2 admin password hash.
- `ADMIN_SESSION_SECRET` / `JWT_SECRET`: admin session signing secret.

## Build And Start

```bash
docker compose build
docker compose up -d
```

First boot runs `pnpm data:refresh` if `/app/data/merged/models.json` is missing. The container then serves the API and built React app on the same origin.

## Verify

```bash
curl http://localhost:${PORT:-3000}/status
curl http://localhost:${PORT:-3000}/api/docs
curl -I -H 'Accept-Language: zh-CN,zh;q=0.9,en;q=0.8' http://localhost:${PORT:-3000}/
```

Passing deployment means `/status` returns `200`, Swagger UI is reachable at `/api/docs`, and `/` redirects to the language-prefixed app route.

## Vercel

The root `vercel.json` builds `apps/web`, deploys `api/index.ts` as the backend function, and rewrites application routes and API routes to the right target.

Deploy from the repository root:

```bash
pnpm install --frozen-lockfile
vercel --prod
```

Verification:

```bash
curl -I https://<your-vercel-domain>/
curl https://<your-vercel-domain>/api/docs
curl https://<your-vercel-domain>/status
```

The Vercel deployment does not replace the Docker deployment. For production data persistence, keep using the Docker/API deployment. On Vercel, admin and analytics writes fall back to writable temp storage only.

## Logs

```bash
docker compose logs -f models-dev-explorer
```

## Data Rollback

Data rollback is handled by Admin Console, not by Docker image tags. Open `/admin`, sign in, inspect pipeline versions, and run rollback for the selected data version. The API reloads `data/merged` without a service restart.

## Deployment Rollback

Deployment rollback is for code or image failures. Keep the previous known-good image tag, then restart compose with that tag:

```bash
docker tag models-dev-explorer:previous-good models-dev-explorer:local
docker compose up -d
curl http://localhost:${PORT:-3000}/status
```

The distinction is intentional: bad source data uses Admin data rollback; bad application code uses image rollback.
