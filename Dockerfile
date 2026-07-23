# Multi-stage build (13.3): builds all workspaces, runs the pipeline for an
# initial data snapshot, and serves API + static frontend from one container.
# 多阶段构建：构建全部 workspace，跑管线生成初始数据快照，单容器同时服务 API 与前端静态资源。

# ---- Stage 1: build ----
FROM node:20-slim AS builder
WORKDIR /app
RUN corepack enable
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml tsconfig.base.json tsconfig.json ./
COPY packages/shared/package.json packages/shared/
COPY packages/data/package.json packages/data/
COPY apps/api/package.json apps/api/
COPY apps/web/package.json apps/web/
RUN pnpm install --frozen-lockfile
COPY . .
# Build order: shared -> data -> api -> web ; then initial data snapshot
RUN pnpm --filter @models-dev/shared build \
 && pnpm --filter @models-dev/data build \
 && pnpm --filter @models-dev/api build \
 && pnpm --filter @models-dev/web build \
 && pnpm --filter @models-dev/data pipeline:full

# ---- Stage 2: runtime ----
FROM node:20-slim AS runtime
WORKDIR /app
RUN corepack enable
ENV NODE_ENV=production
# Copy manifests + install prod deps only
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml ./
COPY packages/shared/package.json packages/shared/
COPY packages/data/package.json packages/data/
COPY apps/api/package.json apps/api/
RUN pnpm install --frozen-lockfile --prod --filter @models-dev/api...
# Copy built artifacts + data snapshot + web static
COPY --from=builder /app/packages/shared/dist packages/shared/dist
COPY --from=builder /app/packages/data/dist packages/data/dist
COPY --from=builder /app/apps/api/dist apps/api/dist
COPY --from=builder /app/apps/web/dist apps/web/dist
COPY --from=builder /app/data/merged data/merged

ENV PORT=3000
ENV DATA_DIR=/app/data
EXPOSE 3000

# HEALTHCHECK hits GET /status (8.1) / 健康检查对接 /status
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD node -e "fetch('http://localhost:'+(process.env.PORT||3000)+'/status').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["node", "apps/api/dist/main.js"]
