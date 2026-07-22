# Phase 1 Schema And Merge Strategy

## Design

The normalized data model separates canonical model identity from provider-specific offerings.

- `Model` is provider-agnostic and keyed by catalog canonical id when available.
- `ProviderOffering` carries provider id, provider model id, pricing, provider API override, status, and raw source ref.
- `Lab` is an independent dimension enriched from Labs HTML and referenced by `Model.lab`.
- `Provider` is sourced from API/Catalog provider records and can serve many offerings.

This avoids a flat JSON merge where repeated model metadata and provider-specific pricing overwrite each other.

## Source Priority

- Identity: catalog first.
- Pricing: API only.
- Benchmarks, weights, license, links: catalog only.
- Provider transport metadata: provider root fields from API/Catalog, with offering-level provider override preserved.
- Lab description/logo/counts: Labs HTML, with catalog id prefix fallback.

## Conflict Resolution

Field-level conflicts are recorded in `metadata.conflicts`.

- If API and catalog disagree on shared canonical fields, catalog wins for model-level fields.
- Provider offering fields are never merged into canonical fields except as fallback for external models.
- Ambiguous name matches are not joined. They are recorded and kept external.
- Invalid normalized records go to `metadata.quarantine` and are excluded from `models`.

## Missing Values

Missing source fields stay `undefined` or empty arrays depending on schema semantics.

- Unknown price: no `pricing` object.
- Missing benchmark: empty `benchmarks`.
- Missing lab description: absent `description`.
- Missing source link: absent `url`.

Presentation code must render missing fields as a dash and must not coerce unknown values to `0`.

## Validation

All normalized datasets are validated with shared Zod schemas. The data package validates every merged model and moves failures to quarantine with the failing path and message.

## Adapter Extensibility

Every source implements the same adapter boundary:

```ts
interface SourceAdapter<TParsed> {
  readonly id: string;
  fetch(): Promise<RawSnapshot>;
  parse(snapshot: RawSnapshot): TParsed;
}
```

Adding OpenRouter later should require one new adapter file that emits provider/offering records with source refs. Merge code receives normalized adapter outputs and does not need provider-specific branching.

## Chosen Tradeoffs

- Use catalog canonical ids as global ids because they are already provider-agnostic and lab-prefixed.
- Keep unmatched API offerings as external records so pricing coverage is visible while preserving join integrity.
- Use the embedded Labs search index before table scraping because it is structured JSON in the real page.
