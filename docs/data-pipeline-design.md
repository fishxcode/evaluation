# Phase 2 Data Pipeline Design

## English

### Goal

Build a maintainable data pipeline that can run from the CLI now and be reused by the future NestJS `POST /refresh` endpoint without duplicating refresh logic.

### Pipeline

`Downloader -> Raw Cache -> Parser -> Normalizer -> Merge -> Validation -> Versioning -> Atomic Publish`

The API hot reload boundary will consume the published `data/merged/models.json` and `data/merged/metadata.json` files. The API process can later watch the metadata version or file mtime without knowing how downloads, hashes, and rollback work.

### Design Choices

- Keep `packages/data` as the only owner of refresh orchestration. This keeps CLI and API refresh behavior identical.
- Store per-source ETag/hash metadata in `data/merged/metadata.json`. A repeated run can skip unchanged downloads and still rebuild from raw cache when needed.
- Use temporary output files and atomic rename for publish. Readers either see the old complete version or the new complete version.
- Move the previous published dataset into `data/merged/history/` before replacement. On validation or write failure, the current published version remains available.
- Use Zod validation at the normalized dataset boundary. Invalid records are quarantined by merge logic; a completely invalid dataset fails the pipeline.
- Keep at least five history entries. This is enough for local rollback/debugging while avoiding unbounded repository or volume growth.

### Failure Strategy

If any source download fails and a raw cache exists, the pipeline uses the cached file and records the source status as `cache-fallback`. If parsing or validation fails after a previous version exists, the pipeline keeps the previous published files untouched and returns a failed run result.

### Extensibility

Each source is represented as a small `SourceDefinition` with id, URL, raw filename, and parser. Adding OpenRouter later should add a new source definition and adapter normalization code, not a second refresh command.

## 简体中文

### 目标

实现可维护的数据管线：当前可由 CLI 独立运行，后续 NestJS `POST /refresh` 端点复用同一套刷新逻辑，避免 CLI 与 API 各写一套。

### 管线

`Downloader -> Raw Cache -> Parser -> Normalizer -> Merge -> Validation -> Versioning -> Atomic Publish`

API 热刷新边界只读取已发布的 `data/merged/models.json` 与 `data/merged/metadata.json`。未来 API 进程可以监听 metadata version 或文件 mtime，不需要了解下载、hash、回滚细节。

### 设计取舍

- `packages/data` 独占 refresh 编排职责，保证 CLI 与 API 触发行为一致。
- 在 `data/merged/metadata.json` 保存每个来源的 ETag/hash 元信息。重复运行时可跳过未变化下载，也可在需要时从 raw cache 重建。
- 使用临时文件加 atomic rename 发布，读者只能看到旧完整版本或新完整版本。
- 替换前把上一版发布数据移动到 `data/merged/history/`。校验或写入失败时，当前发布版本保持不变。
- 在 normalized dataset 边界使用 Zod 校验。单条无效记录由 merge 逻辑进入 quarantine；整体数据集无效则让管线失败。
- 默认保留至少 5 个历史版本，满足本地回滚与排查，同时避免仓库或 volume 无限膨胀。

### 失败策略

任一来源下载失败但存在 raw cache 时，管线使用缓存文件并将来源状态记录为 `cache-fallback`。如果解析或校验阶段失败且已有上一版发布数据，管线保持上一版文件不变并返回失败结果。

### 扩展性

每个来源用小型 `SourceDefinition` 表达 id、URL、raw 文件名与 parser。未来接入 OpenRouter 应新增 source definition 与 adapter normalization，而不是另写一条 refresh 命令。
