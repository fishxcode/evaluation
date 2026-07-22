import type {
  ApiEnvelope,
  BenchmarkSummary,
  FilterValues,
  LabCatalogRow,
  Model,
  PricingRow,
  Provider,
  SearchResult,
  Stats,
} from "./types";

const apiBaseUrl = import.meta.env.VITE_API_BASE_URL ?? "";

export const apiDocsUrl = `${apiBaseUrl}/api/docs`;

function toQuery(
  params: Record<string, string | number | boolean | undefined>,
) {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== "") search.set(key, String(value));
  }
  return search.toString();
}

/**
 * Fetch an API endpoint and unwrap the shared response envelope.
 * 请求 API 端点并解开统一响应包络。
 *
 * @param path Endpoint path without base URL.
 * @param params Query parameters.
 * @returns The typed response payload and metadata.
 * @throws Error when HTTP or API envelope reports a failure.
 */
export async function requestApi<T>(
  path: string,
  params: Record<string, string | number | boolean | undefined> = {},
) {
  const query = toQuery(params);
  const response = await fetch(
    `${apiBaseUrl}${path}${query ? `?${query}` : ""}`,
  );
  const envelope = (await response.json()) as ApiEnvelope<T>;
  if (!response.ok || envelope.error) {
    throw new Error(
      envelope.error?.message ?? `Request failed: ${response.status}`,
    );
  }
  return envelope;
}

export function listModels(
  params: Record<string, string | number | boolean | undefined>,
) {
  return requestApi<Model[]>("/models", params);
}

export function getModel(id: string) {
  return requestApi<Model>(`/models/${encodeURIComponent(id)}`);
}

export function listLabs() {
  return requestApi<LabCatalogRow[]>("/labs");
}

export function listProviders() {
  return requestApi<Provider[]>("/providers");
}

export function listBenchmarks() {
  return requestApi<BenchmarkSummary[]>("/benchmarks");
}

export function getFilters() {
  return requestApi<FilterValues>("/filters");
}

export function getStats() {
  return requestApi<Stats>("/stats");
}

export function listPricing(provider?: string) {
  return requestApi<PricingRow[]>("/pricing", { provider });
}

export function searchModels(q: string) {
  return requestApi<SearchResult[]>("/search", { q });
}

export async function recordPageView(path: string, sessionId: string) {
  const response = await fetch(`${apiBaseUrl}/analytics/page-view`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-page-session": sessionId,
    },
    body: JSON.stringify({ path }),
  });
  return (await response.json()) as ApiEnvelope<{
    counted: boolean;
    pageViews: number;
    updatedAt: string;
  }>;
}

export async function adminRequest<T>(
  path: string,
  token: string,
  init: RequestInit = {},
) {
  const response = await fetch(`${apiBaseUrl}${path}`, {
    ...init,
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${token}`,
      ...init.headers,
    },
  });
  const envelope = (await response.json()) as ApiEnvelope<T>;
  if (!response.ok || envelope.error)
    throw new Error(
      envelope.error?.message ?? `Request failed: ${response.status}`,
    );
  return envelope;
}

export async function adminLogin(username: string, password: string) {
  const response = await fetch(`${apiBaseUrl}/admin/login`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ username, password }),
  });
  const envelope = (await response.json()) as ApiEnvelope<{
    token: string;
    expiresAt: string;
    user: { username: string };
  }>;
  if (!response.ok || envelope.error)
    throw new Error(
      envelope.error?.message ?? `Request failed: ${response.status}`,
    );
  return envelope;
}
