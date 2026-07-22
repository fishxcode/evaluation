import { useLocation, useParams } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ExternalLink } from "lucide-react";
import { useMemo, useState } from "react";
import { listLabs } from "../lib/api";
import { compactNumber, dash, date, price } from "../lib/format";
import { normalizeLocale, t } from "../lib/i18n";
import { useSeo } from "../lib/seo";
import type { LabCatalogRow } from "../lib/types";
import { EmptyState, ErrorState, LoadingState } from "../components/StateBlock";

function useLocale() {
  const params = useParams({ strict: false }) as { locale?: string };
  return normalizeLocale(params.locale);
}

function assetUrl(path: string) {
  return path.startsWith("http") ? path : `https://models.dev${path}`;
}

/** Labs catalog page backed by the scraped models.dev labs source.
 * 基于抓取到的 models.dev labs 来源展示 Lab 目录。 */
export function LabsPage() {
  const locale = useLocale();
  const location = useLocation();
  const [query, setQuery] = useState("");
  const labsQuery = useQuery({ queryKey: ["labs"], queryFn: listLabs });

  useSeo({
    locale,
    title:
      locale === "zh"
        ? "AI 实验室目录 | Models.dev Explorer"
        : "AI labs catalog | Models.dev Explorer",
    description:
      locale === "zh"
        ? "浏览实验室、供应商、模型数量、时间线与来源链接。"
        : "Browse labs, providers, model counts, timelines, and source links from models.dev data.",
    path: location.pathname,
  });

  const labs = useMemo(() => {
    const normalized = query.toLowerCase();
    return [...((labsQuery.data?.data ?? []) as LabCatalogRow[])]
      .filter((lab) => {
        if (!normalized) return true;
        return (
          lab.name.toLowerCase().includes(normalized) ||
          lab.id.toLowerCase().includes(normalized) ||
          lab.tokens.some((token) => token.toLowerCase().includes(normalized))
        );
      })
      .sort((a, b) => (b.modelCount ?? 0) - (a.modelCount ?? 0));
  }, [labsQuery.data?.data, query]);

  if (labsQuery.isLoading) return <LoadingState label={t(locale, "loading")} />;
  if (labsQuery.isError)
    return (
      <ErrorState
        label={t(locale, "error")}
        message={labsQuery.error.message}
      />
    );

  return (
    <div className="grid gap-4">
      <section className="min-w-0 rounded-lg border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-xl font-semibold text-slate-950 dark:text-white">
              {t(locale, "labs")}
            </h1>
            <p className="mt-1 text-sm text-slate-500">
              {compactNumber(labs.length)} {t(locale, "labs")}
            </p>
          </div>
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={t(locale, "search")}
            className="h-11 rounded-md border border-slate-200 bg-white px-3 text-sm outline-none focus:border-sky-500 dark:border-slate-800 dark:bg-slate-950 md:w-80"
          />
        </div>
      </section>

      {!labs.length ? <EmptyState label={t(locale, "empty")} /> : null}
      <section className="grid min-w-0 gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {labs.map((lab) => (
          <article
            key={lab.id}
            className="min-w-0 overflow-hidden rounded-lg border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex min-w-0 items-start gap-3">
                {lab.logo ? (
                  <img
                    src={assetUrl(lab.logo)}
                    alt={lab.name}
                    className="mt-0.5 h-10 w-10 shrink-0 rounded-md border border-slate-200 bg-white object-contain p-1 dark:border-slate-800 dark:bg-slate-950"
                    loading="lazy"
                  />
                ) : (
                  <div className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-md border border-slate-200 bg-slate-50 text-xs font-semibold text-slate-500 dark:border-slate-800 dark:bg-slate-950">
                    {lab.name.slice(0, 2).toUpperCase()}
                  </div>
                )}
                <div className="min-w-0">
                  <h2 className="truncate text-base font-semibold text-slate-950 dark:text-white">
                    {lab.name}
                  </h2>
                  <p className="mt-1 truncate font-mono text-xs text-slate-500">
                    {lab.id}
                  </p>
                </div>
              </div>
              {lab.href ? (
                <a
                  href={lab.href}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-slate-200 dark:border-slate-800"
                  aria-label={lab.name}
                >
                  <ExternalLink className="h-4 w-4" />
                </a>
              ) : null}
            </div>
            <p className="mt-3 line-clamp-3 min-h-[4.5rem] text-sm leading-6 text-slate-600 dark:text-slate-300">
              {lab.description || "-"}
            </p>
            <div className="mt-4 grid grid-cols-3 gap-2 rounded-md bg-slate-50 p-3 text-sm dark:bg-slate-950">
              <div>
                <p className="text-xs text-slate-500">
                  {t(locale, "modelCount")}
                </p>
                <p className="mt-1 font-semibold">
                  {compactNumber(lab.modelCount)}
                </p>
              </div>
              <div>
                <p className="text-xs text-slate-500">
                  {t(locale, "providerCount")}
                </p>
                <p className="mt-1 font-semibold">
                  {compactNumber(lab.providerCount)}
                </p>
              </div>
              <div>
                <p className="text-xs text-slate-500">
                  {t(locale, "averageInputPrice")}
                </p>
                <p className="mt-1 truncate font-semibold">
                  {price(lab.averageInputPrice)}
                </p>
              </div>
            </div>
            <div className="mt-3 grid grid-cols-2 gap-2 rounded-md bg-slate-50 p-3 text-sm dark:bg-slate-950">
              <div>
                <p className="text-xs text-slate-500">
                  {t(locale, "benchmark")}
                </p>
                <p className="mt-1 font-semibold">
                  {dash(lab.averageBenchmarkScore?.toFixed(2))}
                </p>
              </div>
              <div>
                <p className="text-xs text-slate-500">
                  {t(locale, "updatedAt")}
                </p>
                <p className="mt-1 truncate font-semibold">
                  {date(lab.updatedAt ?? lab.releaseDate)}
                </p>
              </div>
            </div>
            <div className="mt-3 grid gap-2">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                {t(locale, "latestModels")}
              </p>
              {lab.models.slice(0, 4).map((model) => (
                <div
                  key={model.id}
                  className="rounded-md bg-slate-50 px-3 py-2 text-sm dark:bg-slate-950"
                >
                  <div className="flex items-center justify-between gap-3">
                    <span className="truncate font-medium text-slate-950 dark:text-white">
                      {model.name}
                    </span>
                    <span className="shrink-0 text-xs text-slate-500">
                      {date(model.releaseDate)}
                    </span>
                  </div>
                  <div className="mt-1 flex flex-wrap gap-2 text-xs text-slate-500">
                    <span>
                      {model.benchmarkCount} {t(locale, "benchmarks")}
                    </span>
                    <span>
                      {model.providerCount} {t(locale, "providers")}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </article>
        ))}
      </section>
    </div>
  );
}
