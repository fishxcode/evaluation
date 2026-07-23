# Data Source Analysis — Phase 0

> Generated: 2026-07-23T09:45:00+08:00 | Branch: claude-opus-4-8

---

## 1. Source Summary

| Source | URL | Method | Size | HTTP | ETag |
|---|---|---|---|---|---|
| api.json | https://models.dev/api.json | GET | 3.23 MB | 200 | `"630eeb477845971d1fdfcf8d3c00a517"` |
| catalog.json | https://models.dev/catalog.json | GET | 3.44 MB | 200 | (see headers) |
| labs (search-index) | https://models.dev/labs/ → HTML | GET (307→200) | 454 KB HTML | 200 | — |

---

## 2. api.json — Provider + Offering Catalog

**Structure**: Top-level object keyed by provider-id → provider object.

```
api.json
└── {provider-id}: ProviderEntry
    ├── id: string (same as key)
    ├── env: string[]          # required env var names
    ├── npm: string            # AI SDK package
    ├── api: string?           # base URL (absent in 24/169 providers)
    ├── name: string           # display name
    ├── doc: string            # docs URL
    └── models: {model-slug: ModelOffering}
```

**Stats**: 169 providers, 5751 total model offering records, **2828 unique model slugs**.

### ModelOffering fields

| Field | Present | Type | Notes |
|---|---|---|---|
| id | 5751/5751 | string | model slug (short, no lab prefix) |
| name | 5751/5751 | string | display name |
| description | 5751/5751 | string | |
| attachment | 5751/5751 | bool | file attachment support |
| reasoning | 5751/5751 | bool | |
| tool_call | 5751/5751 | bool | |
| release_date | 5751/5751 | string | ISO date |
| last_updated | 5751/5751 | string | ISO date |
| modalities.input | 5751/5751 | string[] | text/image/pdf/video/audio |
| modalities.output | 5751/5751 | string[] | text/image/audio/video/pdf |
| open_weights | 5751/5751 | bool | |
| limit.context | 5751/5751 | number | tokens |
| limit.output | 5751/5751 | number | tokens |
| limit.input | 1107/5751 | number? | optional, separate input limit |
| cost | 5352/5751 | object? | **pricing** — absent for 399 offerings |
| temperature | 5059/5751 | bool? | |
| family | 4506/5751 | string? | model family slug |
| reasoning_options | 3673/5751 | array? | `[{type: "effort"|"toggle"|"budget_tokens", values?}]` |
| structured_output | 2998/5751 | bool? | |
| knowledge | 2916/5751 | string? | knowledge cutoff ISO date |
| interleaved | 660/5751 | object? | `{field: string}` — reasoning field name |
| provider | 190/5751 | string? | cross-provider alias pointer |
| status | 177/5751 | string? | e.g. "deprecated" |
| experimental | 39/5751 | bool? | |

### cost subfields

| Field | Present | Unit |
|---|---|---|
| cost.input | 5352/5352 | USD per 1M tokens |
| cost.output | 5352/5352 | USD per 1M tokens |
| cost.cache_read | 2559/5352 | USD per 1M tokens |
| cost.cache_write | 930/5352 | USD per 1M tokens |
| cost.reasoning | 72/5352 | USD per 1M tokens |
| cost.tiers | 252/5352 | array — tiered pricing by volume |
| cost.context_over_200k | 232/5352 | USD per 1M (surcharge) |
| cost.input_audio | 70/5352 | USD per 1M tokens |
| cost.output_audio | 16/5352 | USD per 1M tokens |

---

## 3. catalog.json — Canonical Model Registry + Providers

**Structure**: Two top-level keys: `models` (263 canonical entries) and `providers` (169, identical schema to api.json).

```
catalog.json
├── models: {lab/slug: CanonicalModel}  # 263 entries
└── providers: {provider-id: ProviderEntry}  # 169, same as api.json
```

### CanonicalModel id format: `{lab}/{slug}`

24 labs: alibaba, anthropic, cohere, deepreinforce, deepseek, google, meituan, meta, microsoft, minimax, mistral, moonshotai, nvidia, openai, perplexity, poolside, sakana, sarvam, stepfun, tencent, thinkingmachines, xai, xiaomi, zhipuai

### CanonicalModel fields (beyond ModelOffering base)

| Field | Present | Notes |
|---|---|---|
| benchmarks | 121/263 | array of BenchmarkResult |
| weights | 93/263 | array of `{label, url}` (Hugging Face etc.) |
| license | 8/263 | string — **very sparse** |
| links | 7/263 | array of `{label, url, type}` |

### BenchmarkResult fields

| Field | Present | Notes |
|---|---|---|
| name | 508/508 | benchmark name |
| score | 508/508 | number |
| source | 508/508 | URL or source name |
| metric | 475/508 | accuracy/pass@1/etc. |
| date | 327/508 | ISO date |
| harness | 122/508 | eval harness name |
| variant | 100/508 | variant label |
| version | 63/508 | version string |
| dataset | 47/508 | dataset name |

---

## 4. labs (search-index) — Lab Registry

Embedded in `/labs/` HTML as `<script id="search-index" type="application/json">`.

The search-index contains 456 entries: **24 labs**, **263 models**, **169 providers**.

### Lab entry fields

| Field | Present | Notes |
|---|---|---|
| type | 24/24 | "lab" |
| id | 24/24 | slug (e.g. "anthropic") |
| title | 24/24 | display name |
| href | 24/24 | `/labs/{id}` |
| logo | 24/24 | `/logos/labs/{id}.svg` |
| modelCount | 24/24 | number |
| providerCount | 24/24 | number |
| releaseDate | 24/24 | latest model date |
| description | 24/24 | 1–2 sentence description |
| updated | 24/24 | ISO date |
| tokens | 24/24 | search token array |
| founded | 0/24 | **ABSENT** — not available |
| website | 0/24 | **ABSENT** — not available |

**Note**: `founded` year and official `website` URL are NOT present in any data source. These fields must be marked as absent in the schema, not filled with invented values (铁律 2).

---

## 5. Cross-Source Alignment (Merge Key Analysis)

### Key formats

| Source | Model key format | Example |
|---|---|---|
| api.json | `slug` (short, provider-scoped) | `gpt-5` |
| catalog.json | `lab/slug` | `openai/gpt-5` |
| labs search-index | `lab/slug` (same as catalog) | `openai/gpt-5` |

### Alignment strategy

```
CanonicalModel.id = "lab/slug"  (from catalog.json, primary key)
ModelOffering.id = "slug"       (from api.json, under provider)

Link: canonicalId = labId + "/" + offeringSlug
```

### Alignment metrics

| | Count |
|---|---|
| catalog canonical models | 263 |
| api unique model slugs | 2828 |
| catalog slugs matched in api | 231 / 263 (87.8%) |
| catalog models NOT in api | **32** (catalog metadata only, no pricing) |
| api slugs WITHOUT catalog entry | **2597** (provider-specific variants/mirrors) |

### Unmatched catalog models (32)

These 32 canonical models have benchmark/weights data but no corresponding api offering. They will be stored with `offerings: []` and `cost: null`.

### api slugs without catalog entry (2597)

These are provider-specific model IDs (mirrors, regional variants, versioned aliases). They will be stored as `offerings` under their closest canonical match (if found by slug prefix heuristics), or as standalone offerings with `canonicalId: null`.

### Conflict areas

1. **Same model, different field values across providers**: `name`, `description`, `limit.*` may differ. Resolution: catalog entry takes precedence; per-provider override stored in `offerings[].meta`.
2. **Pricing absent in api.json**: 399 offerings have no `cost` object — displayed as "—".
3. **benchmark.name field**: In catalog.json, the benchmark name key is `name` (not `benchmark` as prompt template suggested) — schema adjusted to reality.
4. **license very sparse**: Only 8/263 catalog entries have `license`. Remaining shown as "—".

---

## 6. What Each Source Has / Lacks

| Field | api.json | catalog.json | labs search-index |
|---|---|---|---|
| Pricing (input/output/cache) | ✓ | ✗ | ✓ (inputCost/outputCost only) |
| Context window | ✓ (limit) | ✓ (limit) | ✓ (context) |
| Capabilities | ✓ | ✓ | ✗ |
| Benchmarks | ✗ | ✓ (121/263) | ✗ |
| Weights/HF links | ✗ | ✓ (93/263) | ✗ |
| License | ✗ | ✓ (8/263, sparse) | ✗ |
| Lab info (name/logo/desc) | ✗ | ✗ | ✓ (24 labs) |
| Lab founded/website | ✗ | ✗ | ✗ (**absent everywhere**) |
| Provider SDK info (npm/env) | ✓ | ✓ | ✗ |
| Modalities | ✓ | ✓ | ✗ |
| Release date | ✓ | ✓ | ✓ |

---

## 7. DoD Checklist

- [x] `data/raw/api.json` — 3.23 MB real snapshot with ETag
- [x] `data/raw/catalog.json` — 3.44 MB real snapshot
- [x] `data/raw/labs.html` — 454 KB HTML with embedded search-index
- [x] `data/raw/labs.json` — extracted 24 lab entries
- [x] Field inventory for all sources (this document)
- [x] Cross-source alignment key analysis documented
- [x] Conflict and missing field areas identified
- [x] `founded`/`website` confirmed absent — not to be fabricated

