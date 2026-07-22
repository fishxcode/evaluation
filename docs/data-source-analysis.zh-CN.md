# Phase 0 数据源分析

## 快照

- 抓取时间：2026-07-22T13:29:27Z
- `https://models.dev/api.json`：HTTP 200，JSON，3,219,527 bytes，ETag `a0cb67f7ce74d398c2ca028c7bf75842`
- `https://models.dev/catalog.json`：HTTP 200，JSON，3,430,910 bytes，ETag `0ee54852487ed268e167dd57c1a3ea2e`
- `https://models.dev/labs`：HTTP 307 跳转到 `/labs/`；`https://models.dev/labs/` 返回 HTTP 200，HTML，451,900 bytes

原始快照存放在 `data/raw/`。

## 数据结构

### API JSON

根结构：以 provider id 为 key 的 object。

观测数量：

- Providers：169
- Provider offerings：5,728

Provider 字段：

- `id`
- `env`
- `npm`
- `api`
- `name`
- `doc`
- `models`

模型/offerings 字段：

- 观测为必备：`id`、`name`、`description`、`attachment`、`reasoning`、`tool_call`、`release_date`、`last_updated`、`modalities`、`open_weights`、`limit`
- 可选或部分存在：`family`、`cost`、`reasoning_options`、`interleaved`、`knowledge`、`provider`、`experimental`、`status`、`structured_output`、`temperature`

价格来自这里。观测到的 cost key 包括 `input`、`output`、`cache_read`、`cache_write`、音频价格字段、`tiers` 和 `context_over_200k`。缺少 `cost` 表示价格未知，不等于 0。

### Catalog JSON

根结构：`{ models, providers }`。

观测数量：

- Canonical models：262
- Providers：169

Canonical model 字段：

- `id`、`name`、`description`、`family`、`attachment`、`reasoning`、`tool_call`、`structured_output`、`temperature`、`knowledge`、`release_date`、`last_updated`、`modalities`、`open_weights`、`limit`
- 可选增强字段：`benchmarks`、`links`、`weights`、`license`

Catalog 是 provider 无关模型身份与模型元数据的权威来源，包括 benchmark、license、links、weights 以及 canonical lab/model id。

### Labs HTML

`/labs` 会跳转到 `/labs/`。最终页面是静态 Astro HTML，包含可视表格，也包含 `<script id="search-index" type="application/json">` 结构化搜索索引。

Lab 搜索索引记录包含：

- `type: "lab"`
- `id`
- `title`
- `href`
- `logo`
- `modelCount`
- `providerCount`
- `releaseDate`
- `description`（部分记录存在）
- `updated`
- `tokens`

嵌入式搜索索引比解析视觉表格更稳定，因为它已经是结构化 JSON；表格可作为后备来源。

## 关联键

主 canonical model key：

- `catalog.models` 使用 `{lab}/{modelSlug}`，例如 `openai/gpt-4o`。

API offering 关联策略：

1. 如果 `model.id` 存在于 `catalog.models`，直接使用。
2. 如果 `{provider.id}/{model.id}` 存在于 `catalog.models`，使用该值。
3. 去掉 `@` 后的 provider variant 后重试上述两种形式。
4. 使用规范化后的唯一模型名匹配 catalog name。
5. 如果无法安全匹配，保留为 `external/{provider.id}/{model.id}`，并记录关联缺失。

这样能保留所有 provider pricing，同时避免猜测式 canonical join。

Lab 关联策略：

- canonical model 的 lab id 来自 `catalog.models` id 的 `/` 前缀。
- Labs HTML 记录补充 lab name、logo、description、model count、provider count 与更新时间。
- 如果 Labs HTML 缺少某个 lab id，则从 canonical id 派生最小 lab ref，并标记缺失字段。

## 冲突与缺失

- `api.json` 的 provider offerings 明显多于 `catalog.json` canonical models。大量 offerings 来自聚合 provider，需要安全的模糊关联。
- 部分 Labs row 缺少 `description`；展示层应渲染为 `-` 或等价 dash。
- 很多记录没有价格。缺失必须保留为 `undefined`；只有源数据明确给出 `0` 时才显示 0。
- Benchmarks 很稀疏，并且只来自 catalog。缺失 benchmark 表示“本数据集中未测”，不代表 0 分。

## Phase 0 DoD 自检

- `data/raw/` 有真实快照。
- JSON/HTML 旁边保存了 HTTP status 和 ETag headers。
- 本文档记录了真实字段、数量、数据缺口与关联键。
