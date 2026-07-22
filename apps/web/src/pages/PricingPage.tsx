import { useLocation, useParams } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useVirtualizer } from "@tanstack/react-virtual";
import { Copy, Download } from "lucide-react";
import { useMemo, useRef } from "react";
import clsx from "clsx";
import { getFilters, listPricing } from "../lib/api";
import {
  compareLimit,
  parseCompareIds,
  stringifyCompareIds,
  toggleCompareId,
} from "../lib/compare";
import { csvEscape, price } from "../lib/format";
import { normalizeLocale, t } from "../lib/i18n";
import { useSeo } from "../lib/seo";
import { useUrlState, type UrlStateCodec } from "../lib/url-state";
import type { PricingRow } from "../lib/types";
import { EmptyState, ErrorState, LoadingState } from "../components/StateBlock";

interface PricingState {
  q: string;
  provider: string;
  sort: string;
  order: "asc" | "desc";
  compare: string;
}

const defaultState: PricingState = {
  q: "",
  provider: "",
  sort: "input",
  order: "asc",
  compare: "",
};

const pricingCodec: UrlStateCodec<PricingState> = {
  read(search) {
    const order = search.get("order");
    return {
      ...defaultState,
      q: search.get("q") ?? "",
      provider: search.get("provider") ?? "",
      sort:
        search.get("sort") === "none"
          ? ""
          : (search.get("sort") ?? defaultState.sort),
      order: order === "desc" ? "desc" : "asc",
      compare: stringifyCompareIds(parseCompareIds(search.get("compare"))),
    };
  },
  write(value) {
    const params = new URLSearchParams();
    if (value.q) params.set("q", value.q);
    if (value.provider) params.set("provider", value.provider);
    if (value.sort === "") params.set("sort", "none");
    if (value.sort) params.set("sort", value.sort);
    if (value.sort && value.order !== "asc") params.set("order", value.order);
    if (value.compare) params.set("compare", value.compare);
    return params;
  },
};

function useLocale() {
  const params = useParams({ strict: false }) as { locale?: string };
  return normalizeLocale(params.locale);
}

function downloadCsv(rows: PricingRow[]) {
  const header = [
    "modelId",
    "modelName",
    "lab",
    "provider",
    "providerModelId",
    "input",
    "cachedInput",
    "output",
    "reasoning",
  ];
  const lines = rows.map((row) =>
    [
      row.modelId,
      row.modelName,
      row.lab.name,
      row.provider.name,
      row.providerModelId,
      row.pricing?.input,
      row.pricing?.cachedInput,
      row.pricing?.output,
      row.pricing?.reasoning,
    ]
      .map(csvEscape)
      .join(","),
  );
  const blob = new Blob([[header.join(","), ...lines].join("\n")], {
    type: "text/csv;charset=utf-8",
  });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = "pricing.csv";
  anchor.click();
  URL.revokeObjectURL(url);
}

function sortValue(row: PricingRow, key: string) {
  if (key === "lab") return row.lab.name;
  if (key === "provider") return row.provider.name;
  if (key === "cachedInput")
    return row.pricing?.cachedInput ?? Number.POSITIVE_INFINITY;
  if (key === "output") return row.pricing?.output ?? Number.POSITIVE_INFINITY;
  if (key === "reasoning")
    return row.pricing?.reasoning ?? Number.POSITIVE_INFINITY;
  if (key === "input") return row.pricing?.input ?? Number.POSITIVE_INFINITY;
  return row.modelName;
}

export function PricingPage() {
  const locale = useLocale();
  const location = useLocation();
  const [state, setState] = useUrlState(pricingCodec);
  const rowsRef = useRef<HTMLDivElement | null>(null);
  const pricingQuery = useQuery({
    queryKey: ["pricing", state.provider],
    queryFn: () => listPricing(state.provider),
  });
  const filtersQuery = useQuery({ queryKey: ["filters"], queryFn: getFilters });

  const filteredRows = useMemo(() => {
    const query = state.q.toLowerCase();
    return (pricingQuery.data?.data ?? []).filter((row) => {
      if (!query) return true;
      return (
        row.modelId.toLowerCase().includes(query) ||
        row.modelName.toLowerCase().includes(query) ||
        row.provider.name.toLowerCase().includes(query) ||
        row.lab.name.toLowerCase().includes(query)
      );
    });
  }, [pricingQuery.data?.data, state.q]);

  const rows = useMemo(() => {
    if (!state.sort) return filteredRows;
    const direction = state.order === "desc" ? -1 : 1;
    return [...filteredRows].sort((a, b) => {
      const left = sortValue(a, state.sort);
      const right = sortValue(b, state.sort);
      if (typeof left === "number" && typeof right === "number")
        return (left - right) * direction;
      return String(left).localeCompare(String(right)) * direction;
    });
  }, [filteredRows, state.order, state.sort]);
  const rowVirtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => rowsRef.current,
    estimateSize: () => 72,
    overscan: 8,
  });

  const compareIds = parseCompareIds(state.compare);
  const toggleCompare = (modelId: string) => {
    if (!compareIds.includes(modelId) && compareIds.length >= compareLimit) {
      window.alert(`${t(locale, "selected")} ${compareLimit}`);
      return;
    }
    setState((current) => ({
      ...current,
      compare: stringifyCompareIds(
        toggleCompareId(parseCompareIds(current.compare), modelId),
      ),
    }));
  };
  const cycleSort = (key: string) => {
    setState((current) => {
      if (current.sort !== key) return { ...current, sort: key, order: "asc" };
      if (current.order === "asc") return { ...current, order: "desc" };
      return { ...current, sort: "", order: "asc" };
    });
  };
  const columns = [
    ["modelName", t(locale, "name")],
    ["lab", t(locale, "lab")],
    ["provider", t(locale, "provider")],
    ["input", t(locale, "input")],
    ["cachedInput", t(locale, "cached")],
    ["output", t(locale, "output")],
    ["reasoning", t(locale, "reasoning")],
  ] as const;
  const gridTemplateColumns =
    "52px minmax(260px, 1.45fr) minmax(132px, 0.9fr) minmax(132px, 0.9fr) minmax(104px, 0.65fr) minmax(104px, 0.65fr) minmax(104px, 0.65fr) minmax(104px, 0.65fr)";
  const fixedCell =
    "sticky z-20 border-r border-slate-100 dark:border-slate-800";
  const fixedHeaderCell =
    "sticky z-30 border-r border-slate-200 dark:border-slate-800";

  useSeo({
    locale,
    title:
      locale === "zh"
        ? "AI 模型价格对比 | Models.dev Explorer"
        : "AI model pricing comparison | Models.dev Explorer",
    description:
      locale === "zh"
        ? "比较各 Provider 的输入、缓存输入、输出和推理价格。"
        : "Compare provider pricing for input, cached input, output, and reasoning tokens.",
    path: location.pathname,
  });

  return (
    <div className="grid gap-4">
      <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-xl font-semibold text-slate-950 dark:text-white">
              {t(locale, "pricing")}
            </h1>
            <p className="mt-1 text-sm text-slate-500">{rows.length} rows</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              className="inline-flex h-10 items-center gap-2 rounded-md border border-slate-200 px-3 text-sm font-medium dark:border-slate-800"
              onClick={() =>
                navigator.clipboard.writeText(JSON.stringify(rows, null, 2))
              }
            >
              <Copy className="h-4 w-4" />
              {t(locale, "copy")}
            </button>
            <button
              type="button"
              className="inline-flex h-10 items-center gap-2 rounded-md bg-slate-950 px-3 text-sm font-medium text-white dark:bg-white dark:text-slate-950"
              onClick={() => downloadCsv(rows)}
            >
              <Download className="h-4 w-4" />
              {t(locale, "exportCsv")}
            </button>
          </div>
        </div>
        <div className="mt-4 grid gap-2 md:grid-cols-[1fr_240px]">
          <input
            value={state.q}
            onChange={(event) =>
              setState((current) => ({ ...current, q: event.target.value }))
            }
            placeholder={t(locale, "search")}
            className="h-11 rounded-md border border-slate-200 bg-white px-3 text-sm outline-none focus:border-sky-500 dark:border-slate-800 dark:bg-slate-950"
          />
          <select
            value={state.provider}
            onChange={(event) =>
              setState((current) => ({
                ...current,
                provider: event.target.value,
              }))
            }
            className="h-11 rounded-md border border-slate-200 bg-white px-3 text-sm dark:border-slate-800 dark:bg-slate-950"
          >
            <option value="">{t(locale, "all")}</option>
            {(filtersQuery.data?.data.providers ?? []).map((provider) => (
              <option key={provider} value={provider}>
                {provider}
              </option>
            ))}
          </select>
        </div>
      </section>

      {pricingQuery.isLoading ? (
        <LoadingState label={t(locale, "loading")} />
      ) : null}
      {pricingQuery.isError ? (
        <ErrorState
          label={t(locale, "error")}
          message={pricingQuery.error.message}
        />
      ) : null}
      {!pricingQuery.isLoading && !pricingQuery.isError && !rows.length ? (
        <EmptyState label={t(locale, "empty")} />
      ) : null}
      {!pricingQuery.isLoading && !pricingQuery.isError && rows.length ? (
        <div className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <div className="overflow-x-auto">
            <div
              ref={rowsRef}
              className="max-h-[calc(100vh-18rem)] min-h-[22rem] overflow-auto"
            >
              <div
                className="sticky top-0 z-10 grid border-b border-slate-200 bg-slate-50 text-left text-xs uppercase text-slate-500 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-400"
                style={{ gridTemplateColumns }}
              >
                <div
                  className={clsx(
                    fixedHeaderCell,
                    "left-0 bg-slate-50 px-4 py-3 dark:bg-slate-900",
                  )}
                >
                  {t(locale, "compare")}
                </div>
                {columns.map(([key, label], index) => (
                  <div
                    key={key}
                    className={clsx(
                      "px-4 py-3",
                      state.sort === key && "text-slate-950 dark:text-white",
                      index === 0 &&
                        `${fixedHeaderCell} left-[52px] bg-slate-50 dark:bg-slate-900`,
                    )}
                  >
                    <button
                      type="button"
                      className="inline-flex items-center gap-1 font-semibold"
                      onClick={() => cycleSort(key)}
                    >
                      {label}
                      <span>
                        {state.sort === key
                          ? state.order === "asc"
                            ? "↑"
                            : "↓"
                          : ""}
                      </span>
                    </button>
                  </div>
                ))}
              </div>
              <div
                style={{
                  height: rowVirtualizer.getTotalSize(),
                  position: "relative",
                }}
              >
                {rowVirtualizer.getVirtualItems().map((virtualRow) => {
                  const row = rows[virtualRow.index];
                  if (!row) return null;
                  return (
                    <div
                      key={`${row.provider.id}-${row.providerModelId}`}
                      className="group absolute left-0 right-0 grid border-b border-slate-100 text-sm hover:bg-slate-50 dark:border-slate-800 dark:hover:bg-slate-800/60"
                      style={{
                        transform: `translateY(${virtualRow.start}px)`,
                        gridTemplateColumns,
                      }}
                    >
                      <div
                        className={clsx(
                          fixedCell,
                          "left-0 bg-white px-4 py-3 group-hover:bg-slate-50 dark:bg-slate-900 dark:group-hover:bg-slate-800/60",
                        )}
                      >
                        <input
                          type="checkbox"
                          checked={compareIds.includes(row.modelId)}
                          onChange={() => toggleCompare(row.modelId)}
                          aria-label={`${t(locale, "addToCompare")} ${row.modelName}`}
                          className="h-4 w-4 rounded border-slate-300"
                        />
                      </div>
                      <div
                        className={clsx(
                          fixedCell,
                          "left-[52px] bg-white px-4 py-3 group-hover:bg-slate-50 dark:bg-slate-900 dark:group-hover:bg-slate-800/60",
                        )}
                      >
                        <div className="min-w-0">
                          <div className="truncate font-semibold text-slate-950 dark:text-white">
                            {row.modelName}
                          </div>
                          <div className="mt-1 truncate font-mono text-xs text-slate-500">
                            {row.modelId}
                          </div>
                        </div>
                      </div>
                      <div className="px-4 py-3">{row.lab.name}</div>
                      <div className="px-4 py-3">{row.provider.name}</div>
                      <div className="px-4 py-3">
                        {price(row.pricing?.input)}
                      </div>
                      <div className="px-4 py-3">
                        {price(row.pricing?.cachedInput)}
                      </div>
                      <div className="px-4 py-3">
                        {price(row.pricing?.output)}
                      </div>
                      <div className="px-4 py-3">
                        {price(row.pricing?.reasoning)}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {compareIds.length ? (
        <div className="fixed inset-x-3 bottom-3 z-40 mx-auto max-w-5xl rounded-lg border border-slate-200 bg-white p-3 shadow-panel dark:border-slate-800 dark:bg-slate-900">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div className="flex min-w-0 flex-wrap gap-2 text-sm">
              <span className="font-semibold text-slate-950 dark:text-white">
                {t(locale, "selected")}: {compareIds.length}/{compareLimit}
              </span>
              {compareIds.map((id) => (
                <button
                  key={id}
                  type="button"
                  className="rounded-md bg-slate-100 px-2 py-1 font-mono text-xs dark:bg-slate-800"
                  onClick={() => toggleCompare(id)}
                >
                  {id}
                </button>
              ))}
            </div>
            <button
              type="button"
              className="h-10 rounded-md bg-slate-950 px-4 text-sm font-semibold text-white disabled:opacity-40 dark:bg-white dark:text-slate-950"
              disabled={compareIds.length < 2}
              onClick={() => {
                window.location.href = `/${locale}/benchmarks?compare=${encodeURIComponent(stringifyCompareIds(compareIds))}`;
              }}
            >
              {t(locale, "compareSelected")}
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
