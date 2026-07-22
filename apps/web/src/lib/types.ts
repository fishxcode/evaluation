import type { Lab, Model, Provider } from "@models-dev/shared";

export interface ApiEnvelope<T> {
  data: T;
  meta: Record<string, unknown>;
  error: null | { code: string; message: string };
}

export interface Stats {
  modelCount: number;
  labCount: number;
  providerCount: number;
  pageViews?: number;
  latestReleaseDate?: string;
  averageInputPrice?: number;
  updatedAt?: string;
  contentHash?: string;
}

export interface FilterValues {
  labs: string[];
  providers: string[];
  capabilities: string[];
  modalities: string[];
  licenses: string[];
  architectures: string[];
  releaseYears: string[];
  contextBands: string[];
  priceBands: string[];
  benchmarks: string[];
}

export interface PricingRow {
  modelId: string;
  modelName: string;
  lab: { id: string; name: string };
  provider: Provider;
  providerModelId: string;
  pricing?: {
    input?: number;
    cachedInput?: number;
    output?: number;
    reasoning?: number;
    inputAudio?: number;
    outputAudio?: number;
  };
}

export interface BenchmarkSummary {
  benchmark: string;
  count: number;
}

export interface SearchResult {
  type: "model";
  id: string;
  title: string;
  lab: { id: string; name: string };
  href: string;
}

export interface LabModelSummary {
  id: string;
  name: string;
  releaseDate?: string;
  benchmarkCount: number;
  providerCount: number;
}

export interface LabCatalogRow extends Lab {
  averageInputPrice?: number;
  averageBenchmarkScore?: number;
  models: LabModelSummary[];
}

export type { Lab, Model, Provider };
