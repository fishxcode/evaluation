/**
 * API adapter — parses api.json (providers + model offerings with pricing).
 * API adapter——解析 api.json（providers 及带定价的模型 offering）。
 *
 * Source: https://models.dev/api.json
 * 169 providers, 5751 model offerings, 2828 unique slugs.
 */
import type { SourceAdapter, RawSnapshot, ParsedContribution, SourceSnapshotMeta, ModelContribution, ProviderContribution } from './types.js';
import { fetchText, blankToUndef } from './fetch-utils.js';
import type { Pricing, Limit, Modalities, Capability, ReasoningOption } from '@models-dev/shared';

const API_URL = 'https://models.dev/api.json';

// ---- raw source types (as observed in data/raw/api.json) ----
interface RawCost {
  input?: number; output?: number; cache_read?: number; cache_write?: number;
  reasoning?: number; tiers?: unknown[];
  // context_over_200k is number OR nested object in real data / 数字或嵌套对象
  context_over_200k?: number | Record<string, number>;
  input_audio?: number; output_audio?: number;
}
interface RawLimit { context: number; output: number; input?: number }
interface RawModalities { input: string[]; output: string[] }
interface RawReasoningOption { type: string; values?: string[] }
interface RawModel {
  id: string; name: string; description: string;
  attachment: boolean; reasoning: boolean; tool_call: boolean;
  temperature?: boolean; structured_output?: boolean; interleaved?: unknown;
  release_date?: string; last_updated?: string; knowledge?: string;
  modalities: RawModalities; open_weights: boolean; limit: RawLimit;
  cost?: RawCost; family?: string; reasoning_options?: RawReasoningOption[];
  provider?: string; status?: string;
  // experimental: boolean OR complex config object in real data / 布尔或复杂配置对象
  experimental?: boolean | Record<string, unknown>;
}
interface RawProvider {
  id: string; name: string; env: string[]; npm: string; api?: string; doc?: string;
  models: Record<string, RawModel>;
}
type RawApiJson = Record<string, RawProvider>;

/**
 * Map raw context_over_200k which is EITHER a number OR a snake_cased object
 * {input,output,cache_read} — normalize the object's keys to camelCase.
 * 映射 context_over_200k：可能是数字，也可能是 snake_case 对象——
 * 将对象键归一化为 camelCase。
 */
function mapContextOver200k(raw: RawCost['context_over_200k']): Pricing['contextOver200k'] {
  if (raw == null) return undefined;
  if (typeof raw === 'number') return raw;
  const o = raw as Record<string, number>;
  return {
    input: o['input'],
    output: o['output'],
    cacheRead: o['cache_read'],
    cacheWrite: o['cache_write'],
  };
}

/** Map raw cost object to normalized Pricing / 将原始 cost 映射为归一化 Pricing */
function mapPricing(cost: RawCost | undefined): Pricing | null {
  if (!cost) return null;
  return {
    input: cost.input,
    output: cost.output,
    cacheRead: cost.cache_read,
    cacheWrite: cost.cache_write,
    reasoning: cost.reasoning,
    inputAudio: cost.input_audio,
    outputAudio: cost.output_audio,
    contextOver200k: mapContextOver200k(cost.context_over_200k),
    tiers: cost.tiers as Pricing['tiers'],
  };
}

/** Map raw limit / 映射 limit */
function mapLimit(raw: RawLimit): Limit {
  return { context: raw.context, output: raw.output, input: raw.input };
}

/** Map raw modalities / 映射 modalities */
function mapModalities(raw: RawModalities): Modalities {
  const validIn = ['text', 'image', 'pdf', 'video', 'audio'] as const;
  const validOut = ['text', 'image', 'pdf', 'video', 'audio'] as const;
  return {
    input: raw.input.filter((m): m is typeof validIn[number] => validIn.includes(m as never)),
    output: raw.output.filter((m): m is typeof validOut[number] => validOut.includes(m as never)),
  };
}

/** Derive capability flags from raw model booleans / 从原始布尔推导能力标记 */
function mapCapabilities(m: RawModel): Capability[] {
  const caps: Capability[] = [];
  if (m.reasoning) caps.push('reasoning');
  if (m.tool_call) caps.push('tool_call');
  if (m.attachment) caps.push('attachment');
  if (m.structured_output) caps.push('structured_output');
  if (m.temperature) caps.push('temperature');
  return caps;
}

/** Map reasoning options / 映射推理选项 */
function mapReasoningOptions(opts: RawReasoningOption[] | undefined): ReasoningOption[] | undefined {
  if (!opts?.length) return undefined;
  const validTypes = ['effort', 'toggle', 'budget_tokens'] as const;
  return opts
    .filter(o => validTypes.includes(o.type as never))
    .map(o => ({
      type: o.type as ReasoningOption['type'],
      // Source values array may contain nulls — filter to strings only (铁律 2)
      // 来源 values 数组可能含 null——仅保留字符串
      values: o.values?.filter((v): v is string => typeof v === 'string'),
    }));
}

export const apiAdapter: SourceAdapter = {
  kind: 'api',
  name: 'models.dev api.json',

  async fetch(prev?: SourceSnapshotMeta): Promise<RawSnapshot> {
    const fetchedAt = new Date().toISOString();
    try {
      const { text, etag, hash, durationMs, skipped } = await fetchText(API_URL, prev?.etag);
      if (skipped) {
        return { kind: 'api', raw: null, etag: prev?.etag, hash: prev?.hash ?? '', fetchedAt, durationMs, skipped: true };
      }
      const raw = JSON.parse(text) as RawApiJson;
      return { kind: 'api', raw, etag, hash, fetchedAt, durationMs, skipped: false };
    } catch (err) {
      return { kind: 'api', raw: null, hash: '', fetchedAt, durationMs: 0, skipped: false, error: String(err) };
    }
  },

  parse(snapshot: RawSnapshot): ParsedContribution {
    if (snapshot.skipped || snapshot.error || !snapshot.raw) {
      return { models: [], labs: [], providers: [] };
    }
    const data = snapshot.raw as RawApiJson;
    const models: ModelContribution[] = [];
    const providers: ProviderContribution[] = [];

    for (const [providerId, provider] of Object.entries(data)) {
      providers.push({
        id: providerId,
        name: provider.name,
        env: provider.env,
        npm: provider.npm,
        api: provider.api,
        doc: provider.doc,
      });

      for (const [modelSlug, m] of Object.entries(provider.models ?? {})) {
        // Canonical id will be resolved by Merger; set null here, lab unknown.
        // 规范 id 由 Merger 解析；此处设 null，lab 未知。
        const contribution: ModelContribution = {
          canonicalId: null, // filled by Merger after catalog linking
          slug: modelSlug,
          source: 'api',
          fields: {
            name: m.name,
            description: m.description,
            family: m.family,
            releaseDate: blankToUndef(m.release_date),
            lastUpdated: blankToUndef(m.last_updated),
            knowledge: blankToUndef(m.knowledge),
            limit: mapLimit(m.limit),
            modalities: mapModalities(m.modalities),
            capabilities: mapCapabilities(m),
            reasoningOptions: mapReasoningOptions(m.reasoning_options),
            openWeights: m.open_weights,
          },
          offering: {
            providerId,
            providerName: provider.name,
            modelId: modelSlug,
            pricing: mapPricing(m.cost),
            limit: mapLimit(m.limit),
            status: m.status,
            // experimental is boolean OR a complex {modes:...} config object in
            // real data — coerce presence to a boolean flag (detail not modeled)
            // experimental 在真实数据中为布尔或复杂 {modes:...} 配置对象——
            // 存在即视为 true（不建模其细节）
            experimental: m.experimental ? true : undefined,
          },
        };
        models.push(contribution);
      }
    }

    return { models, labs: [], providers };
  },
};
