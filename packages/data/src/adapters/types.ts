/**
 * SourceAdapter contract — the extensibility backbone (Phase 1 §8).
 * SourceAdapter 契约——扩展性骨架。
 *
 * Adding a new source = implement this interface + register. Zero changes to
 * merge/validation/API/frontend.
 * 新增来源 = 实现此接口 + 注册。合并/校验/API/前端零改动。
 */
import type { SourceKind, Pricing, Modalities, Limit, BenchmarkResult, Capability, ReasoningOption } from '@models-dev/shared';

/**
 * Metadata about a previous snapshot, used for incremental fetch decisions.
 * 上一次快照的元数据，用于增量抓取判断。
 */
export interface SourceSnapshotMeta {
  etag?: string;
  hash?: string;
}

/**
 * Result of an adapter fetch. `skipped` means source unchanged (incremental).
 * adapter 抓取结果。`skipped` 表示来源未变（增量跳过）。
 */
export interface RawSnapshot {
  kind: SourceKind;
  /** Raw payload (parsed JSON or HTML string) / 原始载荷 */
  raw: unknown;
  etag?: string;
  hash: string;
  fetchedAt: string;
  durationMs: number;
  skipped: boolean;
  error?: string;
}

/**
 * A normalized contribution from one source toward one model. The Merger
 * combines contributions across sources by `canonicalId`.
 * 单来源对单模型的归一化贡献。Merger 按 `canonicalId` 跨源合并。
 */
export interface ModelContribution {
  /** Canonical id "lab/slug"; null if source can't determine lab / 规范 id */
  canonicalId: string | null;
  slug: string;
  labId?: string;
  source: SourceKind;
  fields: {
    name?: string;
    description?: string;
    family?: string;
    releaseDate?: string;
    lastUpdated?: string;
    knowledge?: string;
    limit?: Limit;
    modalities?: Modalities;
    capabilities?: Capability[];
    reasoningOptions?: ReasoningOption[];
    openWeights?: boolean;
    license?: string;
    weights?: Array<{ label: string; url: string }>;
    links?: Array<{ label: string; url: string; type?: string }>;
    benchmarks?: BenchmarkResult[];
  };
  /** Provider offering contributed by this source (pricing) / 该来源贡献的 offering */
  offering?: {
    providerId: string;
    providerName: string;
    modelId: string;
    pricing: Pricing | null;
    limit?: Limit;
    status?: string;
    experimental?: boolean;
  };
}

/**
 * A lab contribution.
 * Lab 贡献。
 */
export interface LabContribution {
  id: string;
  name: string;
  logo?: string;
  description?: string;
  modelCount?: number;
  providerCount?: number;
  releaseDate?: string;
  updated?: string;
}

/**
 * A provider contribution.
 * Provider 贡献。
 */
export interface ProviderContribution {
  id: string;
  name: string;
  env: string[];
  npm: string;
  api?: string;
  doc?: string;
}

/**
 * Parsed output of an adapter: contributions to models, labs, providers.
 * adapter 解析产物：对模型、Lab、Provider 的贡献。
 */
export interface ParsedContribution {
  models: ModelContribution[];
  labs: LabContribution[];
  providers: ProviderContribution[];
}

/**
 * The adapter interface every source must implement.
 * 每个来源必须实现的 adapter 接口。
 */
export interface SourceAdapter {
  /** Source identifier / 来源标识 */
  readonly kind: SourceKind;
  /** Human name for logs / 日志用名称 */
  readonly name: string;
  /**
   * Fetch raw data. Should compare prev meta (etag/hash) and set skipped=true
   * when unchanged (incremental update).
   * 抓取原始数据。应对比 prev（etag/hash），未变时置 skipped=true（增量更新）。
   */
  fetch(prev?: SourceSnapshotMeta): Promise<RawSnapshot>;
  /**
   * Parse+normalize a raw snapshot into contributions.
   * 将原始快照解析+归一化为贡献。
   */
  parse(snapshot: RawSnapshot): ParsedContribution;
}
