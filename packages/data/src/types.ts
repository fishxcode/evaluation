import type { Lab, Metadata, Model, Provider } from "@models-dev/shared";

export interface RawApiProvider {
  id: string;
  name: string;
  npm?: string;
  env?: string[];
  api?: string;
  doc?: string;
  models: Record<string, RawApiModel>;
}

export interface RawApiModel {
  id: string;
  name: string;
  description: string;
  family?: string;
  attachment: boolean;
  reasoning: boolean;
  tool_call: boolean;
  structured_output?: boolean;
  temperature?: boolean;
  release_date: string;
  last_updated: string;
  modalities: { input: string[]; output: string[] };
  open_weights: boolean;
  limit: Record<string, number>;
  cost?: Record<string, number>;
  provider?: { npm?: string; api?: string };
  reasoning_options?: unknown[];
  knowledge?: string;
  status?: string;
  interleaved?: boolean | Record<string, unknown>;
  experimental?: Record<string, unknown>;
}

export interface RawCatalog {
  models: Record<string, RawCatalogModel>;
  providers: Record<string, RawCatalogProvider>;
}

export interface RawCatalogProvider {
  id: string;
  name: string;
  api?: string;
  doc?: string;
  models: Record<string, RawApiModel>;
}

export interface RawCatalogModel {
  id: string;
  name: string;
  description: string;
  family?: string;
  attachment: boolean;
  reasoning: boolean;
  tool_call: boolean;
  structured_output?: boolean;
  temperature?: boolean;
  release_date: string;
  last_updated: string;
  modalities: { input: string[]; output: string[] };
  open_weights: boolean;
  limit: Record<string, number>;
  benchmarks?: Array<{
    name: string;
    score: number;
    metric?: string;
    source?: string;
    date?: string;
  }>;
  weights?: unknown[];
  links?: unknown[];
  license?: string;
}

export interface ParsedLab {
  id: string;
  name: string;
  slug?: string;
  href?: string;
  logo?: string;
  description?: string;
  modelCount?: number;
  providerCount?: number;
  releaseDate?: string;
  updatedAt?: string;
  tokens?: string[];
  sources?: Array<{
    source: string;
    fetchedAt: string;
    url?: string;
    etag?: string;
    note?: string;
  }>;
}

export interface MergeInput {
  fetchedAt: string;
  api: Record<string, RawApiProvider>;
  catalog: RawCatalog;
  labs: ParsedLab[];
}

export interface MergeResult {
  models: Model[];
  labs: Lab[];
  providers: Provider[];
  metadata: Metadata;
}
