# Phase 0 Data Source Analysis

## Snapshot

- Captured at: 2026-07-22T13:29:27Z
- `https://models.dev/api.json`: HTTP 200, JSON, 3,219,527 bytes, ETag `a0cb67f7ce74d398c2ca028c7bf75842`
- `https://models.dev/catalog.json`: HTTP 200, JSON, 3,430,910 bytes, ETag `0ee54852487ed268e167dd57c1a3ea2e`
- `https://models.dev/labs`: HTTP 307 to `/labs/`; `https://models.dev/labs/`: HTTP 200, HTML, 451,900 bytes

Raw snapshots are stored in `data/raw/`.

## Source Shapes

### API JSON

Root shape: object keyed by provider id.

Observed count:

- Providers: 169
- Provider offerings: 5,728

Provider fields:

- `id`
- `env`
- `npm`
- `api`
- `name`
- `doc`
- `models`

Model/offering fields observed:

- Required in observed records: `id`, `name`, `description`, `attachment`, `reasoning`, `tool_call`, `release_date`, `last_updated`, `modalities`, `open_weights`, `limit`
- Optional or partial: `family`, `cost`, `reasoning_options`, `interleaved`, `knowledge`, `provider`, `experimental`, `status`, `structured_output`, `temperature`

Pricing lives here. Observed cost keys include `input`, `output`, `cache_read`, `cache_write`, audio price keys, `tiers`, and `context_over_200k`. Missing `cost` means the UI must render an unknown price, not zero.

### Catalog JSON

Root shape: `{ models, providers }`.

Observed count:

- Canonical models: 262
- Providers: 169

Canonical model fields observed:

- `id`, `name`, `description`, `family`, `attachment`, `reasoning`, `tool_call`, `structured_output`, `temperature`, `knowledge`, `release_date`, `last_updated`, `modalities`, `open_weights`, `limit`
- Optional enrichment: `benchmarks`, `links`, `weights`, `license`

Catalog is the authoritative source for provider-agnostic model identity and model metadata such as benchmarks, license, links, weights, and canonical lab/model ids.

### Labs HTML

`/labs` redirects to `/labs/`. The final page is a static Astro HTML document. It contains both a table and an embedded `<script id="search-index" type="application/json">` with search records.

Observed lab data in the embedded index includes:

- `type: "lab"`
- `id`
- `title`
- `href`
- `logo`
- `modelCount`
- `providerCount`
- `releaseDate`
- `description` when available
- `updated`
- `tokens`

The embedded search index is more stable than scraping visual table cells because it carries structured JSON for lab rows. The table remains a fallback.

## Association Keys

Primary canonical model key:

- `catalog.models` uses `{lab}/{modelSlug}`, for example `openai/gpt-4o`.

API offering association strategy:

1. Use exact `model.id` if it exists in `catalog.models`.
2. Use `{provider.id}/{model.id}` if it exists in `catalog.models`.
3. Strip provider variants after `@` and retry the exact and provider-prefixed forms.
4. Match by unique normalized model name against catalog names.
5. If no safe match exists, keep the offering under `external/{provider.id}/{model.id}` and record the miss in metadata.

This keeps all provider pricing visible while preventing guessed canonical joins.

Lab association strategy:

- Canonical model lab id is the prefix before `/` in `catalog.models` ids.
- Labs HTML records enrich that lab id with name, logo, description, model count, provider count, and update date.
- If Labs HTML does not contain a lab id, derive a minimal lab ref from the canonical model id and mark fields as missing.

## Conflicts And Missing Data

- `api.json` has far more model offerings than `catalog.json` canonical models. Many offerings belong to aggregator providers and need fuzzy-but-safe association.
- Some Labs rows omit `description`; render `-` or an em-dash equivalent at the presentation layer.
- Pricing is absent for many records. Absence must remain `undefined`; `0` is only allowed when source data explicitly says `0`.
- Benchmarks are sparse and come from catalog records only. Missing benchmark means "not measured here", not score `0`.

## Phase 0 DoD Self-Check

- Raw snapshots exist in `data/raw/`.
- Headers with HTTP status and ETag are stored next to JSON/HTML.
- Real field lists, counts, data source gaps, and association keys are documented above.
