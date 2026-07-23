/**
 * Typed API client wrapping the { data, meta, error } envelope. Throws
 * ApiClientError on non-2xx so React Query surfaces the error state.
 * 类型化 API 客户端，封装 { data, meta, error } 包络。非 2xx 抛出 ApiClientError，
 * 供 React Query 呈现错误态。
 */
import type { Model, Lab, PaginationMeta, FilterFacets, Status, DatasetMetadata } from '@models-dev/shared';

/** Base URL: same-origin '/...' in prod; Vite proxy handles dev. / 基础地址 */
const BASE = import.meta.env.VITE_API_BASE ?? '';

export class ApiClientError extends Error {
  constructor(public code: string, message: string, public status: number) {
    super(message);
  }
}

interface Envelope<T> {
  data: T | null;
  meta?: PaginationMeta;
  error?: { code: string; message: string };
}

async function get<T>(path: string): Promise<Envelope<T>> {
  const res = await fetch(`${BASE}${path}`, { headers: { Accept: 'application/json' } });
  const body = (await res.json()) as Envelope<T>;
  if (!res.ok || body.error) {
    throw new ApiClientError(body.error?.code ?? 'ERROR', body.error?.message ?? res.statusText, res.status);
  }
  return body;
}

export interface ModelListResult {
  data: Model[];
  meta: PaginationMeta;
}

/** Build a query string from a params object, skipping empty values / 构建查询串 */
export function qs(params: Record<string, unknown>): string {
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== null && v !== '') sp.set(k, String(v));
  }
  const s = sp.toString();
  return s ? `?${s}` : '';
}

export const api = {
  async models(params: Record<string, unknown>): Promise<ModelListResult> {
    const r = await get<Model[]>(`/models${qs(params)}`);
    return { data: r.data ?? [], meta: r.meta! };
  },
  async model(id: string): Promise<Model> {
    const r = await get<Model>(`/models/${id}`);
    return r.data!;
  },
  async labs(params: Record<string, unknown> = {}): Promise<{ data: Lab[]; meta: PaginationMeta }> {
    const r = await get<Lab[]>(`/labs${qs(params)}`);
    return { data: r.data ?? [], meta: r.meta! };
  },
  async lab(id: string): Promise<Lab & { models: Model[] }> {
    const r = await get<Lab & { models: Model[] }>(`/labs/${id}`);
    return r.data!;
  },
  async filters(): Promise<FilterFacets> {
    const r = await get<FilterFacets>('/filters');
    return r.data!;
  },
  async pricing(params: Record<string, unknown> = {}): Promise<{ data: PricingRow[]; meta: PaginationMeta }> {
    const r = await get<PricingRow[]>(`/pricing${qs(params)}`);
    return { data: r.data ?? [], meta: r.meta! };
  },
  async stats(): Promise<StatsResult> {
    const r = await get<StatsResult>('/stats');
    return r.data!;
  },
  async status(): Promise<Status> {
    const r = await get<Status>('/status');
    return r.data!;
  },
  async metadata(): Promise<DatasetMetadata | null> {
    const r = await get<DatasetMetadata>('/metadata');
    return r.data;
  },
};

export interface PricingRow {
  modelId: string; modelName: string; lab: string;
  providerId: string; providerName: string;
  input?: number; output?: number; cacheRead?: number; reasoning?: number;
}
export interface StatsResult {
  modelCount: number; labCount: number; providerCount: number;
  avgInputPrice: number;
  latestModels: Array<{ id: string; name: string; releaseDate?: string }>;
  dataVersion?: number; lastUpdated?: string;
}
