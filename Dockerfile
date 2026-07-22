FROM node:22-bookworm-slim AS deps

WORKDIR /app
RUN corepack enable

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml tsconfig.json tsconfig.shared.json ./
COPY apps/api/package.json apps/api/package.json
COPY apps/web/package.json apps/web/package.json
COPY packages/data/package.json packages/data/package.json
COPY packages/shared/package.json packages/shared/package.json

RUN pnpm install --frozen-lockfile

FROM deps AS build

COPY . .
RUN pnpm build

FROM node:22-bookworm-slim AS runtime

WORKDIR /app
ENV NODE_ENV=production \
    PORT=3000 \
    CLIENT_DIST_PATH=/app/apps/web/dist \
    MODELS_DATASET_PATH=/app/data/merged/models.json \
    ANALYTICS_STATE_PATH=/app/data/analytics/pageviews.json \
    PUBLIC_SITE_URL=http://localhost:3000 \
    REFRESH_INTERVAL_SECONDS=21600

RUN apt-get update \
  && apt-get install -y --no-install-recommends ca-certificates curl \
  && rm -rf /var/lib/apt/lists/* \
  && corepack enable

COPY --from=build /app /app

VOLUME ["/app/data"]
EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 CMD curl -fsS http://localhost:3000/status || exit 1

CMD ["sh", "-c", "if [ ! -s /app/data/merged/models.json ]; then pnpm data:refresh; fi; (while sleep ${REFRESH_INTERVAL_SECONDS}; do pnpm data:refresh || true; done) & pnpm --filter @models-dev/api start"]
