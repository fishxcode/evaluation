import { Link, useLocation, useParams } from "@tanstack/react-router";
import { useQuery, useQueries } from "@tanstack/react-query";
import clsx from "clsx";
import { getModel, listBenchmarks, searchModels } from "../lib/api";
import {
  compareLimit,
  parseCompareIds,
  stringifyCompareIds,
  toggleCompareId,
} from "../lib/compare";
import { dash } from "../lib/format";
import { normalizeLocale, t } from "../lib/i18n";
import { useSeo } from "../lib/seo";
import type { Model } from "../lib/types";
import { EmptyState, ErrorState, LoadingState } from "../components/StateBlock";
import { useMemo, useState } from "react";

type BenchmarkView = "table" | "bar" | "heatmap" | "scatter" | "radar";

const benchmarkViews: BenchmarkView[] = [
  "table",
  "bar",
  "heatmap",
  "scatter",
  "radar",
];
const chartColors = [
  "#0ea5e9",
  "#10b981",
  "#f59e0b",
  "#ef4444",
  "#8b5cf6",
  "#14b8a6",
];

function readBenchmarkView(search: string): BenchmarkView {
  const value = new URLSearchParams(search).get("view");
  return benchmarkViews.includes(value as BenchmarkView)
    ? (value as BenchmarkView)
    : "table";
}

function scoreMax(models: Model[], benchmarks: string[]) {
  const scores = models.flatMap((model) =>
    benchmarks
      .map((benchmark) => compareScore(model, benchmark))
      .filter((score): score is number => score !== undefined),
  );
  return Math.max(1, ...scores);
}

function scorePercent(score: number | undefined, max: number) {
  if (score === undefined) return undefined;
  return Math.min(100, Math.max(4, (score / max) * 100));
}

function heatColor(score: number | undefined, max: number) {
  if (score === undefined) return "rgba(148, 163, 184, 0.14)";
  const intensity = Math.min(0.9, Math.max(0.18, score / max));
  return `rgba(16, 185, 129, ${intensity})`;
}

function useLocale() {
  const params = useParams({ strict: false }) as { locale?: string };
  return normalizeLocale(params.locale);
}

function modelMaxScore(model: Model) {
  return model.benchmarks.reduce(
    (max, item) => Math.max(max, item.score),
    Number.NEGATIVE_INFINITY,
  );
}

function compareScore(model: Model, benchmark: string) {
  return model.benchmarks.find((item) => item.benchmark === benchmark)?.score;
}

function ViewTabs({
  locale,
  view,
  onChange,
}: {
  locale: "en" | "zh";
  view: BenchmarkView;
  onChange(view: BenchmarkView): void;
}) {
  return (
    <div className="inline-flex flex-wrap gap-1 rounded-md border border-slate-200 bg-white p-1 dark:border-slate-800 dark:bg-slate-950">
      {benchmarkViews.map((item) => (
        <button
          key={item}
          type="button"
          className={clsx(
            "h-8 rounded-sm px-3 text-sm font-medium",
            view === item
              ? "bg-slate-950 text-white dark:bg-white dark:text-slate-950"
              : "text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800",
          )}
          onClick={() => onChange(item)}
        >
          {t(locale, item)}
        </button>
      ))}
    </div>
  );
}

function BenchmarkTable({
  locale,
  models,
  benchmarks,
}: {
  locale: "en" | "zh";
  models: Model[];
  benchmarks: string[];
}) {
  return (
    <section className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <div className="overflow-x-auto">
        <table className="min-w-[920px] text-left text-sm">
          <thead className="bg-slate-50 text-xs uppercase text-slate-500 dark:bg-slate-900 dark:text-slate-400">
            <tr>
              <th className="px-4 py-3">{t(locale, "name")}</th>
              {benchmarks.map((benchmark) => (
                <th key={benchmark} className="px-4 py-3">
                  {benchmark}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
            {models.map((model) => (
              <tr
                key={model.id}
                className="hover:bg-slate-50 dark:hover:bg-slate-800/60"
              >
                <td className="max-w-sm px-4 py-3">
                  <Link
                    to="/$locale/models/$modelId"
                    params={{ locale, modelId: model.id }}
                    className="font-semibold text-slate-950 dark:text-white"
                  >
                    {model.name}
                  </Link>
                  <p className="mt-1 truncate font-mono text-xs text-slate-500">
                    {model.id}
                  </p>
                </td>
                {benchmarks.map((benchmark) => {
                  const score = compareScore(model, benchmark);
                  return (
                    <td key={benchmark} className="px-4 py-3">
                      {score === undefined ? (
                        <span className="text-slate-400">{dash(score)}</span>
                      ) : (
                        <div className="grid min-w-20 gap-1">
                          <span className="font-medium">{score}</span>
                          <div className="h-1.5 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
                            <div
                              className="h-full rounded-full bg-emerald-500"
                              style={{
                                width: `${Math.min(100, Math.max(4, score))}%`,
                              }}
                            />
                          </div>
                        </div>
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function BarView({
  models,
  benchmarks,
}: {
  models: Model[];
  benchmarks: string[];
}) {
  const max = scoreMax(models, benchmarks);
  return (
    <section className="grid gap-3 rounded-lg border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
      {benchmarks.map((benchmark) => (
        <div key={benchmark} className="grid gap-2">
          <div className="text-sm font-semibold text-slate-950 dark:text-white">
            {benchmark}
          </div>
          <div className="grid gap-2">
            {models.map((model, index) => {
              const score = compareScore(model, benchmark);
              const width = scorePercent(score, max);
              return (
                <div
                  key={model.id}
                  className="grid gap-1 md:grid-cols-[220px_1fr_64px] md:items-center"
                >
                  <div className="truncate text-sm text-slate-600 dark:text-slate-300">
                    {model.name}
                  </div>
                  <div className="h-3 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
                    {width === undefined ? null : (
                      <div
                        className="h-full rounded-full"
                        style={{
                          width: `${width}%`,
                          backgroundColor:
                            chartColors[index % chartColors.length],
                        }}
                      />
                    )}
                  </div>
                  <div className="text-right font-mono text-xs text-slate-500">
                    {dash(score)}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </section>
  );
}

function HeatmapView({
  locale,
  models,
  benchmarks,
}: {
  locale: "en" | "zh";
  models: Model[];
  benchmarks: string[];
}) {
  const max = scoreMax(models, benchmarks);
  return (
    <section className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <div className="overflow-x-auto">
        <div className="min-w-[820px]">
          <div
            className="grid border-b border-slate-200 bg-slate-50 text-xs uppercase text-slate-500 dark:border-slate-800 dark:bg-slate-900"
            style={{
              gridTemplateColumns: `220px repeat(${models.length}, minmax(120px, 1fr))`,
            }}
          >
            <div className="px-4 py-3">{t(locale, "benchmark")}</div>
            {models.map((model) => (
              <div key={model.id} className="truncate px-4 py-3">
                {model.name}
              </div>
            ))}
          </div>
          {benchmarks.map((benchmark) => (
            <div
              key={benchmark}
              className="grid border-b border-slate-100 text-sm dark:border-slate-800"
              style={{
                gridTemplateColumns: `220px repeat(${models.length}, minmax(120px, 1fr))`,
              }}
            >
              <div className="px-4 py-3 font-medium text-slate-950 dark:text-white">
                {benchmark}
              </div>
              {models.map((model) => {
                const score = compareScore(model, benchmark);
                return (
                  <div key={model.id} className="px-4 py-3">
                    <span
                      className="inline-flex min-w-16 justify-center rounded-md px-2 py-1 font-mono text-xs"
                      style={{
                        backgroundColor: heatColor(score, max),
                        color:
                          score === undefined ? undefined : "rgb(15, 23, 42)",
                      }}
                    >
                      {dash(score)}
                    </span>
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function ScatterView({
  models,
  benchmarks,
}: {
  models: Model[];
  benchmarks: string[];
}) {
  const width = 920;
  const height = 360;
  const pad = 48;
  const max = scoreMax(models, benchmarks);
  const xFor = (index: number) =>
    pad +
    (benchmarks.length <= 1
      ? 0
      : (index / (benchmarks.length - 1)) * (width - pad * 2));
  const yFor = (score: number) =>
    height - pad - (score / max) * (height - pad * 2);
  return (
    <section className="overflow-hidden rounded-lg border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <div className="overflow-x-auto">
        <svg viewBox={`0 0 ${width} ${height}`} className="min-w-[920px]">
          <line
            x1={pad}
            y1={height - pad}
            x2={width - pad}
            y2={height - pad}
            stroke="currentColor"
            className="text-slate-200 dark:text-slate-700"
          />
          <line
            x1={pad}
            y1={pad}
            x2={pad}
            y2={height - pad}
            stroke="currentColor"
            className="text-slate-200 dark:text-slate-700"
          />
          {benchmarks.map((benchmark, index) => (
            <text
              key={benchmark}
              x={xFor(index)}
              y={height - 14}
              textAnchor="middle"
              className="fill-slate-500 text-[10px]"
            >
              {benchmark.slice(0, 18)}
            </text>
          ))}
          {models.map((model, modelIndex) => {
            const points = benchmarks.flatMap((benchmark, index) => {
              const score = compareScore(model, benchmark);
              return score === undefined
                ? []
                : [{ x: xFor(index), y: yFor(score), score }];
            });
            return (
              <g key={model.id}>
                <polyline
                  fill="none"
                  stroke={chartColors[modelIndex % chartColors.length]}
                  strokeWidth="2"
                  points={points
                    .map((point) => `${point.x},${point.y}`)
                    .join(" ")}
                />
                {points.map((point) => (
                  <circle
                    key={`${model.id}-${point.x}`}
                    cx={point.x}
                    cy={point.y}
                    r="4"
                    fill={chartColors[modelIndex % chartColors.length]}
                  />
                ))}
              </g>
            );
          })}
        </svg>
      </div>
      <ChartLegend models={models} />
    </section>
  );
}

function RadarView({
  models,
  benchmarks,
}: {
  models: Model[];
  benchmarks: string[];
}) {
  const size = 420;
  const center = size / 2;
  const radius = 150;
  const max = scoreMax(models, benchmarks);
  const pointFor = (index: number, score: number) => {
    const angle = -Math.PI / 2 + (index / benchmarks.length) * Math.PI * 2;
    const r = (score / max) * radius;
    return { x: center + Math.cos(angle) * r, y: center + Math.sin(angle) * r };
  };
  const axisFor = (index: number) => pointFor(index, max);
  return (
    <section className="overflow-hidden rounded-lg border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <div className="overflow-x-auto">
        <svg
          viewBox={`0 0 ${size} ${size}`}
          className="mx-auto min-w-[420px] max-w-xl"
        >
          {[0.33, 0.66, 1].map((scale) => (
            <circle
              key={scale}
              cx={center}
              cy={center}
              r={radius * scale}
              fill="none"
              stroke="currentColor"
              className="text-slate-200 dark:text-slate-700"
            />
          ))}
          {benchmarks.map((benchmark, index) => {
            const axis = axisFor(index);
            return (
              <g key={benchmark}>
                <line
                  x1={center}
                  y1={center}
                  x2={axis.x}
                  y2={axis.y}
                  stroke="currentColor"
                  className="text-slate-200 dark:text-slate-700"
                />
                <text
                  x={axis.x}
                  y={axis.y}
                  textAnchor="middle"
                  className="fill-slate-500 text-[10px]"
                >
                  {benchmark.slice(0, 14)}
                </text>
              </g>
            );
          })}
          {models.map((model, modelIndex) => {
            const points = benchmarks.flatMap((benchmark, index) => {
              const score = compareScore(model, benchmark);
              return score === undefined ? [] : [pointFor(index, score)];
            });
            return points.length ? (
              <polygon
                key={model.id}
                points={points
                  .map((point) => `${point.x},${point.y}`)
                  .join(" ")}
                fill={chartColors[modelIndex % chartColors.length]}
                fillOpacity="0.12"
                stroke={chartColors[modelIndex % chartColors.length]}
                strokeWidth="2"
              />
            ) : null;
          })}
        </svg>
      </div>
      <ChartLegend models={models} />
    </section>
  );
}

function ChartLegend({ models }: { models: Model[] }) {
  return (
    <div className="mt-3 flex flex-wrap gap-3 text-xs text-slate-500">
      {models.map((model, index) => (
        <span key={model.id} className="inline-flex items-center gap-2">
          <span
            className="h-2.5 w-2.5 rounded-full"
            style={{ backgroundColor: chartColors[index % chartColors.length] }}
          />
          {model.name}
        </span>
      ))}
    </div>
  );
}

function BenchmarkVisualization({
  view,
  locale,
  models,
  benchmarks,
}: {
  view: BenchmarkView;
  locale: "en" | "zh";
  models: Model[];
  benchmarks: string[];
}) {
  if (view === "bar")
    return <BarView models={models} benchmarks={benchmarks} />;
  if (view === "heatmap")
    return (
      <HeatmapView locale={locale} models={models} benchmarks={benchmarks} />
    );
  if (view === "scatter")
    return <ScatterView models={models} benchmarks={benchmarks} />;
  if (view === "radar")
    return <RadarView models={models} benchmarks={benchmarks} />;
  return (
    <BenchmarkTable locale={locale} models={models} benchmarks={benchmarks} />
  );
}

/** Benchmark comparison page with missing values rendered distinctly.
 * Benchmark 对比页，缺测值明确显示为缺失而不是 0。 */
export function BenchmarksPage() {
  const locale = useLocale();
  const location = useLocation();
  const benchmarksQuery = useQuery({
    queryKey: ["benchmarks"],
    queryFn: listBenchmarks,
  });
  const [query, setQuery] = useState("");
  const search = window.location.search;
  const compareIds = useMemo(
    () => parseCompareIds(new URLSearchParams(search).get("compare")),
    [search],
  );
  const view = useMemo(() => readBenchmarkView(search), [search]);
  const compareQueries = useQueries({
    queries: compareIds.map((id) => ({
      queryKey: ["compare-model", id],
      queryFn: () => getModel(id),
      enabled: Boolean(id),
    })),
  });
  const searchQuery = useQuery({
    queryKey: ["benchmark-search", query],
    queryFn: () => searchModels(query),
    enabled: query.length > 0,
  });

  useSeo({
    locale,
    title:
      locale === "zh"
        ? "Benchmark 对比 | Models.dev Explorer"
        : "Benchmark comparison | Models.dev Explorer",
    description:
      locale === "zh"
        ? "比较 benchmark 覆盖和分数，缺测不会被当作 0 分。"
        : "Compare benchmark coverage and scores without treating missing results as zero.",
    path: location.pathname,
  });

  if (
    benchmarksQuery.isLoading ||
    compareQueries.some((item) => item.isLoading)
  )
    return <LoadingState label={t(locale, "loading")} />;
  if (benchmarksQuery.isError)
    return (
      <ErrorState
        label={t(locale, "error")}
        message={benchmarksQuery.error.message}
      />
    );
  if (compareQueries.some((item) => item.isError))
    return (
      <ErrorState
        label={t(locale, "error")}
        message={
          compareQueries.find((item) => item.isError)?.error?.message ??
          t(locale, "error")
        }
      />
    );

  const benchmarkNames = (benchmarksQuery.data?.data ?? [])
    .sort((a, b) => b.count - a.count)
    .slice(0, 8)
    .map((item) => item.benchmark);
  const selectedModels = compareQueries
    .map((item) => item.data?.data)
    .filter((model): model is Model => Boolean(model))
    .sort((a, b) => modelMaxScore(b) - modelMaxScore(a));
  const unionBenchmarks = [
    ...new Set(
      selectedModels.flatMap((model) =>
        model.benchmarks.map((item) => item.benchmark),
      ),
    ),
  ].slice(0, 8);
  const activeBenchmarks = unionBenchmarks.length
    ? unionBenchmarks
    : benchmarkNames;
  const searchRows = (searchQuery.data?.data ?? []).slice(0, 8);
  const writeSearch = (updates: Record<string, string>) => {
    const nextSearch = new URLSearchParams(window.location.search);
    for (const [key, value] of Object.entries(updates)) {
      if (value) nextSearch.set(key, value);
      else nextSearch.delete(key);
    }
    window.location.href = `${location.pathname}?${nextSearch.toString()}`;
  };
  const updateCompare = (next: string[]) => {
    writeSearch({ compare: stringifyCompareIds(next) });
  };

  return (
    <div className="grid gap-4">
      <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <h1 className="text-xl font-semibold text-slate-950 dark:text-white">
              {t(locale, "compareModels")}
            </h1>
            <p className="mt-1 text-sm text-slate-500">
              {t(locale, "benchmarkCoverage")} · {activeBenchmarks.length}{" "}
              {t(locale, "benchmarks")} · {compareIds.length}/{compareLimit}
            </p>
          </div>
          <ViewTabs
            locale={locale}
            view={view}
            onChange={(next) => writeSearch({ view: next })}
          />
        </div>
        <div className="mt-4 grid gap-2 md:grid-cols-[1fr_320px]">
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={`${t(locale, "searchAndAdd")} ${t(locale, "explorer").toLowerCase()}`}
            className="h-11 rounded-md border border-slate-200 bg-white px-3 text-sm outline-none focus:border-sky-500 dark:border-slate-800 dark:bg-slate-950"
          />
          <div className="flex flex-wrap gap-2">
            {compareIds.map((id) => (
              <button
                key={id}
                type="button"
                className="rounded-md bg-slate-100 px-2 py-1 font-mono text-xs dark:bg-slate-800"
                onClick={() => updateCompare(toggleCompareId(compareIds, id))}
              >
                {id}
              </button>
            ))}
          </div>
        </div>
        {query ? (
          <div className="mt-3 grid gap-2 md:grid-cols-2">
            {searchRows.map((item) => (
              <button
                key={item.id}
                type="button"
                className="rounded-md border border-slate-200 px-3 py-2 text-left text-sm dark:border-slate-800"
                onClick={() =>
                  updateCompare(toggleCompareId(compareIds, item.id))
                }
              >
                <div className="font-semibold text-slate-950 dark:text-white">
                  {item.title}
                </div>
                <div className="mt-1 truncate font-mono text-xs text-slate-500">
                  {item.id}
                </div>
              </button>
            ))}
          </div>
        ) : null}
      </section>

      {!selectedModels.length ? (
        <EmptyState label={t(locale, "empty")} />
      ) : null}
      {selectedModels.length ? (
        <BenchmarkVisualization
          view={view}
          locale={locale}
          models={selectedModels}
          benchmarks={activeBenchmarks}
        />
      ) : null}
    </div>
  );
}
