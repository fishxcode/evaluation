# Schema & Merge Strategy — Phase 1

> Branch: claude-opus-4-8 | Depends on: docs/data-source-analysis.md (Phase 0)

This document defines the normalized data model, the merge pipeline strategy,
conflict resolution, manual-override design, and the SourceAdapter extension
model. All decisions are grounded in the **real** Phase 0 data.

---

## 1. Design rationale — why a canonical `Model` keyed by `lab/slug`

The three sources model data differently:

- **api.json**: 169 providers → 5751 offerings (pricing lives here, keyed by short slug)
- **catalog.json**: 263 canonical models keyed `lab/slug` (benchmarks/weights/license)
- **labs search-index**: 24 labs (name/logo/description)

### Chosen unit: one `Model` per canonical `lab/slug`

Each `Model` collapses N provider offerings into an `offerings[]` array. This is
the natural unit for the product: a user compares "GPT-5" as one thing, then
sees its price across providers.

### Rejected alternative: one row per provider-offering

Keying by `(provider, slug)` would fragment a single model into dozens of rows,
duplicate metadata, and make the Explorer/Compare pages awkward. Instead we keep
offerings nested and expose a flattened view only in Pricing Compare (10.4).

---

## 2. Global ID rule

| Entity | ID format | Source of truth |
|---|---|---|
| `Model.id` | `{lab}/{slug}` | catalog.json canonical key |
| `Model.slug` | `{slug}` | short model id |
| `Lab.id` | `{lab}` | catalog id prefix / labs index |
| `Provider.id` | `{provider}` | api.json / catalog.json provider key |

**Linking**: an api.json offering `(provider, slug)` links to a canonical model
when `catalog.models` contains a key ending in `/{slug}`. Of 263 canonical
models, **231** match an api slug directly; **32** are catalog-only (no pricing);
**2597** api slugs have no canonical entry.

For api slugs without a canonical match, the normalizer **synthesizes** a Model
using the lab inferred from provider grouping, marks `sources: [{kind:'api'}]`,
and leaves benchmark/weights empty. This keeps pricing-only models visible
rather than dropping them.

---

## 3. Field-level merge precedence

Precedence (highest wins), applied per field:

```
manual override  >  catalog.json  >  api.json  >  labs index
```

| Field group | Primary source | Rationale |
|---|---|---|
| name, description, family | catalog → api → labs | catalog is curated |
| benchmarks, weights, license, links | catalog only | only source that has them |
| modalities, capabilities, limit | catalog → api | catalog canonical, api fills gaps |
| pricing (per offering) | api only | only source with cost |
| lab name/logo/description | labs index | authoritative lab registry |
| release/last_updated/knowledge | catalog → api | catalog canonical |

`offerings[]` is built by aggregating **all** api.json provider entries whose
model slug maps to this canonical model. Each offering keeps its own pricing.

---

## 4. Conflict resolution (9.2.2)

When two sources disagree on a high-precedence field (e.g. `name`, `limit.context`),
the higher-precedence value wins and a `FieldConflict` is recorded:

```ts
{ field: "limit.context",
  candidates: [ {source:"catalog", value:1000000}, {source:"api", value:200000} ],
  resolvedFrom: "catalog" }
```

Conflicts are stored on `model.conflicts[]`, surfaced to the Admin quarantine/
conflict view, and never silently discarded.

---

## 5. Manual override (9.2.4) — designed now, not deferred

Overrides live in a **separate persisted file** (`data/overrides.json`), NOT in
the source snapshots, so they survive every auto-refresh. The merge runs in two
passes:

1. **Base merge** from sources → candidate Model.
2. **Override pass**: for each `FieldOverride` on that model id, set the dotted
   `field` path to `value`, stash the pre-override value as `originalValue`, and
   append to `model.overrides[]`.

Because overrides apply *after* the source merge on every run, a re-refresh can
never overwrite an override. "Undo" simply removes the override entry; the next
merge restores the source value. Every override records
`{field, value, originalValue, updatedBy, updatedAt}` for the audit log (9.2.5).

---

## 6. Missing-value policy (铁律 2)

- Optional fields stay `undefined`; **never** invented or zero-filled.
- Absent pricing → `offering.pricing = null` → UI shows "—".
- `license` (8/263), `benchmarks` (121/263), `weights` (93/263): absent → omitted.
- Lab `founded`/`website`: **absent in ALL sources** → always `undefined`.

---

## 7. Validation & quarantine (9.2.2)

Every merged record is validated with `modelSchema.safeParse`. On failure the
record is written to `data/merged/quarantine.json` with its Zod issues, counted
in `metadata.quarantinedCount`, and **excluded** from the main dataset. The main
dataset therefore always contains only schema-valid records.

---

## 8. Extensibility — SourceAdapter plugin model

Every source implements one interface:

```ts
interface SourceAdapter {
  kind: SourceKind;
  fetch(prev?: SourceSnapshotMeta): Promise<RawSnapshot>;   // download + etag/hash
  parse(raw: RawSnapshot): ParsedRecord[];                  // source shape → intermediate
  normalize(records: ParsedRecord[]): ModelContribution[];  // intermediate → partial Model
}
```

The `Merger` consumes `ModelContribution[]` from all adapters and knows nothing
about any specific source. **Adding OpenRouter tomorrow** = create
`openrouter.adapter.ts` implementing the interface + register it in the adapter
list. Zero changes to merge/validation/API/frontend.

### Walkthrough: "add OpenRouter"

1. `openrouter.adapter.ts`: `fetch()` GETs their models endpoint (etag-aware),
   `parse()` maps their JSON, `normalize()` emits `ModelContribution` with
   `sources:[{kind:'api'}]`-style pricing offerings.
2. Register in `adapters/index.ts`.
3. Run `pnpm data:refresh` — merge, conflict-record, validate, version, hot-reload
   all work unchanged.

---

## 9. Incremental update (Phase 2 hook)

Each adapter's `fetch()` compares the new ETag/content-hash with the previous
snapshot's. Unchanged → returns `{skipped:true}`, the pipeline skips parse/merge
for that source and marks it `skipped` in metadata.

---

## 10. DoD checklist

- [x] Normalized `Model`/`Lab`/`Provider` Zod schemas (packages/shared)
- [x] Global ID rule documented (`lab/slug`)
- [x] Field-level merge precedence table
- [x] Conflict resolution design + `FieldConflict` schema
- [x] Manual override design (separate file, two-pass, survives refresh)
- [x] Missing-value policy (no fabrication)
- [x] Validation + quarantine design
- [x] SourceAdapter plugin model + "add OpenRouter" walkthrough
- [x] Unit tests for pagination contract (pageSize<=100) — 9 passing
