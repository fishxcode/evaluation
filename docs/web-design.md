# Phase 4 React Frontend Design

## English

### Goal

Build the P0 browser experience on top of the real NestJS API: Model Explorer, Model Detail, and Pricing Compare. The first screen is the actual Explorer workspace, not a landing page.

### Architecture

- `apps/web` uses Vite, React, TanStack Router, TanStack Query, TanStack Table, Tailwind CSS, and lucide-react.
- Routes are prefixed by locale: `/en/models`, `/zh/models`, `/en/models/:modelId`, `/zh/pricing`.
- API access is centralized in `src/lib/api.ts` and returns the shared `{ data, meta, error }` envelope.
- URL search params are the single source for Explorer state: query, filters, sort, order, view, page, and page size.
- UI primitives live locally under `src/components` until reuse across apps justifies promotion to `packages/ui`.

### Pages

- Model Explorer: work-focused split layout. Desktop uses a sticky filter sidebar and dense result panel; mobile uses a drawer-like filter panel and cards. View modes are grid, list, and compact.
- Model Detail: sections for overview, pricing, capabilities, benchmarks, providers, raw JSON, and source refs. Unknown values render as `-`.
- Pricing Compare: model/provider/lab price table with search, sorting, copy buttons, and CSV export.

### Interaction And States

- React Query supplies loading, error, success, and empty states.
- Dark mode follows system on first load and can be manually toggled.
- Language switching updates the URL prefix without losing route intent.
- Controls use icons where possible, segmented view controls, checkboxes, selects, and buttons that map to direct commands.

### Tradeoffs

- Use SPA rendering for this phase. The dataset is dynamic and API-driven, and P0 requires rich filtering rather than SEO-first content. SSR can be revisited after Docker and static asset serving are complete.
- Use a small local component set instead of installing shadcn generators. This keeps the repo deterministic during evaluation while still following Radix/shadcn-like composition and styling patterns.

## 简体中文

### 目标

基于真实 NestJS API 实现 P0 浏览器体验：Model Explorer、Model Detail 和 Pricing Compare。首屏就是可用的 Explorer 工作台，不做营销 landing page。

### 架构

- `apps/web` 使用 Vite、React、TanStack Router、TanStack Query、TanStack Table、Tailwind CSS 与 lucide-react。
- 路由带语言前缀：`/en/models`、`/zh/models`、`/en/models/:modelId`、`/zh/pricing`。
- API 访问集中在 `src/lib/api.ts`，统一消费 `{ data, meta, error }` 响应包络。
- Explorer 状态以 URL search params 为单一来源：搜索、筛选、排序、方向、视图、页码与分页大小。
- UI primitives 先放在 `src/components`，只有跨应用复用明确时再提升到 `packages/ui`。

### 页面

- Model Explorer：工作台式分栏布局。桌面端使用 sticky filter sidebar 和高密度结果区；移动端使用抽屉式 filter panel 和卡片结果。视图模式包含 grid、list、compact。
- Model Detail：包含 overview、pricing、capabilities、benchmarks、providers、raw JSON 与 source refs。未知字段统一显示 `-`。
- Pricing Compare：按 model/provider/lab 展示价格表，支持搜索、排序、复制与 CSV 导出。

### 交互与状态

- React Query 提供 loading、error、success、empty 四态。
- 暗色模式首次跟随系统，也支持手动切换。
- 语言切换通过 URL 前缀完成，且保持当前路由意图。
- 控件尽量使用图标、分段视图控制、复选框、select，以及表达直接命令的按钮。

### 取舍

- 本阶段选择 SPA。数据动态且 API 驱动，P0 更关注复杂筛选体验，而不是 SEO 优先内容。SSR 可在 Docker 和静态资源服务完成后再评估。
- 使用小型本地组件集，而不是引入 shadcn generator。这样评测期间仓库更确定，同时保持类似 Radix/shadcn 的组合和样式习惯。
