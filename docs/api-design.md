# Phase 3 API Design

## English

### Goal

Expose the normalized dataset through a typed NestJS REST API that the React frontend can consume directly. The API must keep response shape, filtering, sorting, pagination, and refresh behavior centralized.

### Architecture

- `DatasetService` owns loading `data/merged/models.json`, building indexes, and reloading when the file changes.
- `ModelsController`, `LabsController`, and `CatalogController` expose endpoint-specific projections while sharing query helpers.
- `RefreshController` calls `refreshDataPipeline` from `packages/data`; the CLI and API therefore use the same data pipeline.
- DTO classes carry Swagger decorators so OpenAPI is generated from the implementation.
- Responses use `{ data, meta, error }` for every endpoint.

### Query Semantics

- Pagination uses `page` and `pageSize`, defaulting to `1` and `24`.
- Sort accepts stable field names such as `name`, `releaseDate`, `context`, and `price`.
- Filters are additive: lab, provider, capability, modality, openWeights, license, and text search narrow the result set.
- Missing values are never coerced to zero. Sort helpers place unknown numeric/date values last.

### Hot Reload

The first implementation uses file mtime polling through `DatasetService.reloadIfChanged()`. This keeps runtime dependencies low and works in Docker volumes. A future file-watch implementation can replace the polling internals without changing controllers.

### Security

- Helmet, CORS, compression, and Nest throttling are configured in bootstrap.
- `POST /refresh` requires a bearer token or `x-refresh-token`. The token comes from `REFRESH_TOKEN`.
- Bad query input returns a structured error response.

## 简体中文

### 目标

通过类型化 NestJS REST API 暴露 normalized dataset，让 React 前端可直接消费。响应包络、筛选、排序、分页与刷新行为集中维护。

### 架构

- `DatasetService` 负责读取 `data/merged/models.json`、建立索引，并在文件变化后重新加载。
- `ModelsController`、`LabsController` 与 `CatalogController` 暴露端点投影，共享查询辅助逻辑。
- `RefreshController` 调用 `packages/data` 的 `refreshDataPipeline`；因此 CLI 与 API 使用同一套数据管线。
- DTO 类使用 Swagger 装饰器，OpenAPI 由实现自动生成。
- 所有端点统一返回 `{ data, meta, error }`。

### 查询语义

- 分页使用 `page` 与 `pageSize`，默认 `1` 与 `24`。
- 排序接受稳定字段名，例如 `name`、`releaseDate`、`context`、`price`。
- 筛选为叠加关系：lab、provider、capability、modality、openWeights、license 与文本搜索会逐步缩小结果集。
- 缺失值绝不转为 0。数值与日期排序把未知值排到最后。

### 热刷新

首版通过 `DatasetService.reloadIfChanged()` 使用文件 mtime 轮询。这样依赖更少，并且适配 Docker volume。未来可以把内部替换为 file watch，而不改变 controller。

### 安全

- bootstrap 配置 Helmet、CORS、compression 与 Nest throttling。
- `POST /refresh` 要求 bearer token 或 `x-refresh-token`，token 来自 `REFRESH_TOKEN`。
- 错误查询输入返回结构化错误响应。
