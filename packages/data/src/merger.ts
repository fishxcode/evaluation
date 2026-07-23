/**
 * Merger — combines ModelContributions from all adapters into canonical Models.
 * Merger——将所有 adapter 的 ModelContribution 合并为规范 Model。
 *
 * Implements the field-level precedence from docs/schema-and-merge.md §3:
 *   manual override > catalog > api > labs
 * 实现文档 §3 的字段级优先级：人工覆盖 > catalog > api > labs。
 *
 * Records conflicts (§4) and applies manual overrides in a second pass (§5).
 * 记录冲突并在第二遍应用人工覆盖。
 */
import type {
  Model,
  Lab,
  LabRef,
  FieldOverride,
  FieldConflict,
  SourceKind,
  ProviderOffering,
} from '@models-dev/shared';
import type { ModelContribution, LabContribution, ParsedContribution } from './adapters/types.js';

/** Source precedence (higher index = higher priority) / 来源优先级（下标越大越高） */
const PRECEDENCE: Record<SourceKind, number> = {
  labs: 1,
  api: 2,
  catalog: 3,
  manual: 4,
};

/** Fields that catalog owns exclusively / catalog 独占字段 */
const CATALOG_ONLY_FIELDS = new Set(['benchmarks', 'weights', 'license', 'links']);

interface MergeInput {
  contributions: ParsedContribution[];
  labs: LabContribution[];
  overrides?: Record<string, FieldOverride[]>;
  sourceMeta: Partial<Record<SourceKind, { fetchedAt?: string; etag?: string }>>;
}

interface MergeOutput {
  models: Model[];
  labs: Lab[];
  conflictCount: number;
}

/**
 * Set a value at a dotted path on an object (for manual overrides).
 * 在对象的点号路径上设值（用于人工覆盖）。
 */
function setPath(obj: Record<string, unknown>, path: string, value: unknown): unknown {
  const parts = path.split('.');
  let cur: Record<string, unknown> = obj;
  for (let i = 0; i < parts.length - 1; i++) {
    const k = parts[i]!;
    if (typeof cur[k] !== 'object' || cur[k] === null) cur[k] = {};
    cur = cur[k] as Record<string, unknown>;
  }
  const last = parts[parts.length - 1]!;
  const prev = cur[last];
  cur[last] = value;
  return prev;
}

/**
 * Merge all contributions into canonical models.
 * 将所有贡献合并为规范模型。
 */
export function merge(input: MergeInput): MergeOutput {
  const { contributions, labs: labContributions, overrides = {}, sourceMeta } = input;

  // Build lab registry first (labs source is authoritative for lab info).
  // 先建立 Lab 注册表（labs 来源对 Lab 信息权威）。
  const labMap = new Map<string, Lab>();
  for (const lc of labContributions) {
    labMap.set(lc.id, {
      id: lc.id,
      name: lc.name,
      logo: lc.logo,
      description: lc.description,
      modelCount: lc.modelCount ?? 0,
      providerCount: lc.providerCount ?? 0,
      releaseDate: lc.releaseDate,
      updated: lc.updated,
      // founded/website intentionally omitted — absent in all sources
    });
  }

  // Group all model contributions by canonical id.
  // 按规范 id 分组所有模型贡献。
  // Strategy: catalog defines canonical ids. api contributions (slug-only) link
  // to a catalog canonical id by matching slug; unmatched api slugs synthesize
  // their own canonical id "<lab-or-provider>/<slug>".
  // 策略：catalog 定义规范 id；api 贡献（仅 slug）按 slug 匹配 catalog；
  // 未匹配的 api slug 自造规范 id。

  // First pass: index catalog canonical ids by slug.
  // 第一遍：按 slug 索引 catalog 规范 id。
  const slugToCanonical = new Map<string, string>();
  const allModelContribs: ModelContribution[] = [];
  for (const c of contributions) {
    for (const mc of c.models) {
      allModelContribs.push(mc);
      if (mc.source === 'catalog' && mc.canonicalId) {
        slugToCanonical.set(mc.slug, mc.canonicalId);
      }
    }
  }

  // Group contributions by resolved canonical id.
  // 按解析后的规范 id 分组贡献。
  const groups = new Map<string, ModelContribution[]>();
  for (const mc of allModelContribs) {
    let cid = mc.canonicalId;
    if (!cid) {
      // api contribution — try to link to a catalog canonical by slug
      // api 贡献——尝试按 slug 关联到 catalog 规范
      cid = slugToCanonical.get(mc.slug) ?? null;
    }
    if (!cid) {
      // Synthesize canonical id for pricing-only models (no catalog entry).
      // 为仅有定价的模型（无 catalog 条目）自造规范 id。
      const labGuess = mc.labId ?? mc.offering?.providerId ?? 'unknown';
      cid = `${labGuess}/${mc.slug}`;
    }
    const arr = groups.get(cid) ?? [];
    arr.push(mc);
    groups.set(cid, arr);
  }

  const models: Model[] = [];
  let conflictCount = 0;

  for (const [canonicalId, contribs] of groups) {
    const merged = mergeGroup(canonicalId, contribs, labMap, sourceMeta);
    conflictCount += merged.conflicts?.length ?? 0;

    // Second pass: apply manual overrides (survive every refresh, §5).
    // 第二遍：应用人工覆盖（每次刷新都保留，§5）。
    const ovs = overrides[canonicalId];
    if (ovs?.length) {
      const applied: FieldOverride[] = [];
      for (const ov of ovs) {
        const prev = setPath(merged as unknown as Record<string, unknown>, ov.field, ov.value);
        applied.push({ ...ov, originalValue: prev });
      }
      merged.overrides = applied;
      if (!merged.sources.some(s => s.kind === 'manual')) {
        merged.sources.push({ kind: 'manual' });
      }
    }

    models.push(merged);
  }

  // Recompute lab model counts from actual merged models.
  // 依据实际合并的模型重算 Lab 模型数。
  for (const lab of labMap.values()) {
    lab.modelCount = models.filter(m => m.lab.id === lab.id).length;
  }

  return { models, labs: [...labMap.values()], conflictCount };
}

/**
 * Merge one group of contributions (same canonical id) into a Model.
 * 将同一规范 id 的一组贡献合并为一个 Model。
 */
function mergeGroup(
  canonicalId: string,
  contribs: ModelContribution[],
  labMap: Map<string, Lab>,
  sourceMeta: MergeInput['sourceMeta'],
): Model {
  const slashIdx = canonicalId.indexOf('/');
  const labId = slashIdx > 0 ? canonicalId.slice(0, slashIdx) : 'unknown';
  const slug = slashIdx > 0 ? canonicalId.slice(slashIdx + 1) : canonicalId;

  // Sort contributions by precedence ascending so higher-precedence overwrites.
  // 按优先级升序排序，使高优先级覆盖低优先级。
  const sorted = [...contribs].sort((a, b) => PRECEDENCE[a.source] - PRECEDENCE[b.source]);

  const fieldSources = new Map<string, { source: SourceKind; value: unknown }[]>();
  const acc: Record<string, unknown> = {};

  // Merge scalar/array metadata fields with precedence + conflict tracking.
  // 按优先级合并标量/数组元数据字段，并跟踪冲突。
  for (const c of sorted) {
    for (const [key, value] of Object.entries(c.fields)) {
      if (value === undefined) continue;
      // record candidate for conflict detection
      const cands = fieldSources.get(key) ?? [];
      cands.push({ source: c.source, value });
      fieldSources.set(key, cands);
      acc[key] = value; // higher precedence (later in sorted) wins
    }
  }

  // Detect conflicts: fields where >1 source gave differing non-catalog-only values.
  // 检测冲突：多个来源对非 catalog 独占字段给出不同值。
  const conflicts: FieldConflict[] = [];
  for (const [field, cands] of fieldSources) {
    if (CATALOG_ONLY_FIELDS.has(field)) continue;
    const distinct = new Map<string, { source: SourceKind; value: unknown }>();
    for (const c of cands) distinct.set(JSON.stringify(c.value), c);
    if (distinct.size > 1) {
      const winner = cands.reduce((a, b) => (PRECEDENCE[b.source] >= PRECEDENCE[a.source] ? b : a));
      conflicts.push({
        field,
        candidates: cands.map(c => ({ source: c.source, value: c.value })),
        resolvedFrom: winner.source,
      });
    }
  }

  // Collect provider offerings (from api contributions).
  // 收集 provider offering（来自 api 贡献）。
  const offerings: ProviderOffering[] = [];
  const aliasSet = new Set<string>();
  for (const c of contribs) {
    if (c.offering) {
      offerings.push({
        providerId: c.offering.providerId,
        providerName: c.offering.providerName,
        modelId: c.offering.modelId,
        pricing: c.offering.pricing,
        limit: c.offering.limit,
        status: c.offering.status,
        experimental: c.offering.experimental,
      });
    }
    // collect name variants as aliases
    if (c.fields.name && c.fields.name !== acc['name']) aliasSet.add(c.fields.name);
  }

  const lab: LabRef = labMap.has(labId)
    ? { id: labId, name: labMap.get(labId)!.name, logo: labMap.get(labId)!.logo }
    : { id: labId, name: labId };

  const sourceKinds = [...new Set(contribs.map(c => c.source))];

  return {
    id: canonicalId,
    slug,
    name: (acc['name'] as string) ?? slug,
    description: acc['description'] as string | undefined,
    family: acc['family'] as string | undefined,
    lab,
    aliases: [...aliasSet],
    releaseDate: acc['releaseDate'] as string | undefined,
    lastUpdated: acc['lastUpdated'] as string | undefined,
    knowledge: acc['knowledge'] as string | undefined,
    limit: acc['limit'] as Model['limit'],
    modalities: (acc['modalities'] as Model['modalities']) ?? { input: [], output: [] },
    capabilities: (acc['capabilities'] as Model['capabilities']) ?? [],
    reasoningOptions: acc['reasoningOptions'] as Model['reasoningOptions'],
    openWeights: (acc['openWeights'] as boolean) ?? false,
    license: acc['license'] as string | undefined,
    weights: acc['weights'] as Model['weights'],
    links: acc['links'] as Model['links'],
    benchmarks: (acc['benchmarks'] as Model['benchmarks']) ?? [],
    offerings,
    sources: sourceKinds.map(kind => ({
      kind,
      fetchedAt: sourceMeta[kind]?.fetchedAt,
      etag: sourceMeta[kind]?.etag,
    })),
    conflicts: conflicts.length ? conflicts : undefined,
  };
}
