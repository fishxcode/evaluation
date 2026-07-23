# Deployment Runbook

Two deployment targets: **Docker** (P0, single container) and **Vercel** (P2, serverless).

---

## A. Docker (single container, from zero to accessible) — 13.4

```bash
# 1. Prepare environment variables
cp .env.example .env
# Edit .env — at minimum set REFRESH_TOKEN, ADMIN_USERNAME, JWT_SECRET,
# and ADMIN_PASSWORD_HASH. Generate the hash:
node -e "require('bcryptjs').hash('YOUR_PASSWORD',12).then(console.log)"
# (bcryptjs is available under apps/api/node_modules after pnpm install)

# 2. Build the image (multi-stage; runs the pipeline for an initial snapshot)
docker compose build

# 3. Start (data volume persists merged snapshots across restarts)
docker compose up -d

# 4. Verify
curl http://localhost:3000/status          # → {"data":{"status":"ok",...}}
open http://localhost:3000/api/docs          # Swagger UI (Try it out)
open http://localhost:3000/en/models         # SPA

# 5. Logs (troubleshooting)
docker compose logs -f api
```

The container serves **both** the API and the built SPA (Nest ServeStatic +
Express SPA fallback), so a single port (3000) exposes everything.

### Scheduled refresh inside the container

Set `REFRESH_CRON` (e.g. `0 */6 * * *`) in `.env`. The app reads it and triggers
the pipeline on schedule; new data hot-reloads without a restart.

---

## B. Deployment rollback (distinct from data rollback) — 13.5

Two different layers — do not confuse:

| | Data rollback (9.2.1) | Deployment rollback (13.5) |
|---|---|---|
| What broke | `merged/` data is bad | image/code is bad (won't start / 500s) |
| Action | Admin Console → rollback to prior data version | redeploy previous good image |
| Restart? | No (hot reload) | Yes (`docker compose up`) |

### Deployment rollback commands

```bash
# Images are tagged with the git short sha (see CI 13.2). To roll back:
docker tag models-dev-explorer:<PREVIOUS_SHA> models-dev-explorer:latest
docker compose up -d          # restarts with the previous good image

# To mark "the last known-good version", tag it on successful deploy:
docker tag models-dev-explorer:latest models-dev-explorer:known-good
```

### Data rollback

Via Admin Console (`/admin` → pipeline → rollback) or API:

```bash
curl -X POST http://localhost:3000/admin/pipeline/rollback/<versionId> \
  -H "Authorization: Bearer <ADMIN_JWT>"
```

---

## C. Vercel (P2, serverless) — 13.6

### Architecture & tradeoffs

- **Frontend**: Vite static build → served from Vercel's CDN.
- **Backend**: NestJS wrapped in an Express serverless function (`api/index.ts`
  → `apps/api/dist/vercel.js`). Pre-compiled with `tsc` so decorator metadata
  survives (Vercel's esbuild would strip it).
- **Data**: The pipeline runs at **build time** (`vercel-build`), producing a
  `data/merged` snapshot bundled with the function via `includeFiles`. The
  function reads this read-only snapshot.

**Tradeoffs (serverless is read-only except `/tmp`):**

- `POST /refresh` and Admin overrides/audit write only to `/tmp` (ephemeral,
  per-instance). They do NOT persist across cold starts on Vercel.
- **Persistent data updates** on Vercel = trigger a **redeploy** (rebuild
  regenerates the snapshot). Wire a Vercel **Deploy Hook** to a schedule
  (external cron / GitHub Action) for periodic freshness. This is the
  serverless-appropriate substitute for the container's internal `REFRESH_CRON`.
- For a stateful production deployment (persistent refresh/overrides), prefer
  the Docker target with a volume, or attach external storage (e.g. Vercel Blob
  / a database) — out of scope for this eval.

### Deploy commands

```bash
# From the repo root (already logged in via `vercel login`)
vercel link            # link to a project (first time)
vercel --prod          # build (vercel-build) + deploy

# Required env vars in the Vercel project settings:
#   ADMIN_USERNAME, ADMIN_PASSWORD_HASH, JWT_SECRET, REFRESH_TOKEN
```

Routing (`vercel.json`): API paths (`/models`, `/labs`, `/status`, `/admin/*`,
`/api/docs`, …) rewrite to the function; everything else falls back to
`index.html` for the SPA.
