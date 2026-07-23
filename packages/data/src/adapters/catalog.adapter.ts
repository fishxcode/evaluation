/**
 * Catalog adapter — parses catalog.json (canonical models + providers).
 * Catalog adapter——解析 catalog.json（规范模型 + providers）。
 *
 * Source: https://models.dev/catalog.json
 * 263 canonical models keyed "lab/slug", carrying benchmarks/weights/license.
 * 263 个规范模型，键为 "lab/slug"，携带 benchmarks/weights/license。
 * This is the PRIMARY metadata source (highest merge precedence after manual).
 * 这是主要元数据来源（Merge 优先级仅次于人工覆盖）。
 */
import type {
  SourceAdapter,
  RawSnapshot,
  ParsedContribution,
  SourceSnapshotMeta,
  ModelContribution,
  ProviderContribution,
} from './types.js';
import { fetchText, blankToUndef } from './fetch-utils.js';
import type { Limit, Modalities, Capability, ReasoningOption, BenchmarkResult } from '@models-dev/shared';

const CATALOG_URL = 'https://models.dev/catalog.json';

interface RawLimit { context: number; output: number; input?: number }
interface RawModalities { input: string[]; output: string[] }
interface RawReasoningOption { type: string; values?: string[] }
interface RawBenchmark {
  name: string; score: number; source: string; metric?: string; date?: string;
  harness?: string; variant?: string; version?: string; dataset?: string;
}
interface RawWeight { label: string; url: string }
interface RawLink { label: string; url: string; type?: string }
interface RawCatalogModel {
  id: string; name: string; description: string; family?: string;
  attachment: boolean; reasoning: boolean; tool_call: boolean;
  temperature?: boolean; structured_output?: boolean;
  release_date?: string; last_updated?: string; knowledge?: string;
  modalities: RawModalities; open_weights: boolean; limit: RawLimit;
  reasoning_options?: RawReasoningOption[];
  benchmarks?: RawBenchmark[]; weights?: RawWeight[]; license?: string; links?: RawLink[];
}
interface RawProvider {
  id: string; name: string; env: string[]; npm: string; api?: string; doc?: string;
  models?: Record<string, unknown>;
}
interface RawCatalogJson {
  models: Record<string, RawCatalogModel>;
  providers: Record<string, RawProvider>;
}

function mapLimit(raw: RawLimit): Limit {
  return { context: raw.context, output: raw.output, input: raw.input };
}
function mapModalities(raw: RawModalities): Modalities {
  const valid = ['text', 'image', 'pdf', 'video', 'audio'] as const;
  return {
    input: raw.input.filter((m): m is typeof valid[number] => valid.includes(m as never)),
    output: raw.output.filter((m): m is typeof valid[number] => valid.includes(m as never)),
  };
}
function mapCapabilities(m: RawCatalogModel): Capability[] {
  const caps: Capability[] = [];
  if (m.reasoning) caps.push('reasoning');
  if (m.tool_call) caps.push('tool_call');
  if (m.attachment) caps.push('attachment');
  if (m.structured_output) caps.push('structured_output');
  if (m.temperature) caps.push('temperature');
  return caps;
}
function mapReasoningOptions(opts?: RawReasoningOption[]): ReasoningOption[] | undefined {
  if (!opts?.length) return undefined;
  const valid = ['effort', 'toggle', 'budget_tokens'] as const;
  return opts.filter(o => valid.includes(o.type as never))
    .map(o => ({ type: o.type as ReasoningOption['type'], values: o.values }));
}
function mapBenchmarks(bms?: RawBenchmark[]): BenchmarkResult[] {
  if (!bms?.length) return [];
  return bms.map(b => ({
    name: b.name, score: b.score, source: b.source, metric: b.metric,
    date: blankToUndef(b.date), harness: b.harness, variant: b.variant, version: b.version, dataset: b.dataset,
  }));
}

export const catalogAdapter: SourceAdapter = {
  kind: 'catalog',
  name: 'models.dev catalog.json',

  async fetch(prev?: SourceSnapshotMeta): Promise<RawSnapshot> {
    const fetchedAt = new Date().toISOString();
    try {
      const { text, etag, hash, durationMs, skipped } = await fetchText(CATALOG_URL, prev?.etag);
      if (skipped) {
        return { kind: 'catalog', raw: null, etag: prev?.etag, hash: prev?.hash ?? '', fetchedAt, durationMs, skipped: true };
      }
      const raw = JSON.parse(text) as RawCatalogJson;
      return { kind: 'catalog', raw, etag, hash, fetchedAt, durationMs, skipped: false };
    } catch (err) {
      return { kind: 'catalog', raw: null, hash: '', fetchedAt, durationMs: 0, skipped: false, error: String(err) };
    }
  },

  parse(snapshot: RawSnapshot): ParsedContribution {
    if (snapshot.skipped || snapshot.error || !snapshot.raw) {
      return { models: [], labs: [], providers: [] };
    }
    const data = snapshot.raw as RawCatalogJson;
    const models: ModelContribution[] = [];
    const providers: ProviderContribution[] = [];

    for (const [providerId, p] of Object.entries(data.providers ?? {})) {
      providers.push({ id: providerId, name: p.name, env: p.env, npm: p.npm, api: p.api, doc: p.doc });
    }

    for (const [canonicalId, m] of Object.entries(data.models ?? {})) {
      // canonicalId format is "lab/slug" / 规范 id 格式为 "lab/slug"
      const slashIdx = canonicalId.indexOf('/');
      const labId = slashIdx > 0 ? canonicalId.slice(0, slashIdx) : undefined;
      const slug = slashIdx > 0 ? canonicalId.slice(slashIdx + 1) : canonicalId;

      models.push({
        canonicalId,
        slug,
        labId,
        source: 'catalog',
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
          license: m.license,
          weights: m.weights,
          links: m.links,
          benchmarks: mapBenchmarks(m.benchmarks),
        },
      });
    }

    return { models, labs: [], providers };
  },
};
