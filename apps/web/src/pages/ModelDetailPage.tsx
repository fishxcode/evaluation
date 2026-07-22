import { Link, useLocation, useParams } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { CheckCircle2, Copy, ExternalLink } from "lucide-react";
import type { ReactNode } from "react";
import { getModel, listModels } from "../lib/api";
import {
  parseCompareIds,
  stringifyCompareIds,
  toggleCompareId,
} from "../lib/compare";
import { compactNumber, dash, date, price } from "../lib/format";
import { normalizeLocale, t } from "../lib/i18n";
import { useSeo } from "../lib/seo";
import { Badge } from "../components/Badge";
import { EmptyState, ErrorState, LoadingState } from "../components/StateBlock";

function useRouteParams() {
  const params = useParams({ strict: false }) as {
    locale?: string;
    modelId?: string;
  };
  return {
    locale: normalizeLocale(params.locale),
    modelId: decodeURIComponent(params.modelId ?? ""),
  };
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="min-w-0 rounded-lg border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
        {title}
      </h2>
      {children}
    </section>
  );
}

export function ModelDetailPage() {
  const { locale, modelId } = useRouteParams();
  const location = useLocation();
  const query = useQuery({
    queryKey: ["model", modelId],
    queryFn: () => getModel(modelId),
    enabled: Boolean(modelId),
  });
  const model = query.data?.data;
  const relatedQuery = useQuery({
    queryKey: ["model-related", model?.id, model?.lab.id, model?.family],
    queryFn: () =>
      listModels({
        lab: model?.lab.id ?? "",
        pageSize: 24,
        sort: "releaseDate",
        order: "desc",
      }),
    enabled: Boolean(model?.lab.id),
  });

  useSeo({
    locale,
    title: model
      ? locale === "zh"
        ? `${model.name} 模型详情 | Models.dev Explorer`
        : `${model.name} model details | Models.dev Explorer`
      : locale === "zh"
        ? "模型详情 | Models.dev Explorer"
        : "Model details | Models.dev Explorer",
    description:
      model?.description ??
      (locale === "zh"
        ? "查看模型能力、价格、Benchmark、Provider 与来源。"
        : "Review model capabilities, pricing, benchmarks, providers, and sources."),
    path: location.pathname,
  });

  if (query.isLoading) return <LoadingState label={t(locale, "loading")} />;
  if (query.isError)
    return (
      <ErrorState label={t(locale, "error")} message={query.error.message} />
    );
  if (!model) return <EmptyState label={t(locale, "empty")} />;

  const capabilityRows = Object.entries(model.capabilities);
  const relatedModels = (relatedQuery.data?.data ?? [])
    .filter((item) => item.id !== model.id)
    .filter(
      (item) => item.family === model.family || item.lab.id === model.lab.id,
    )
    .slice(0, 6);
  const sourceTimeline = model.sources
    .map((source) => ({
      label: source.source,
      value: source.fetchedAt,
      note: source.note ?? source.url ?? "-",
    }))
    .sort((a, b) => b.value.localeCompare(a.value));
  const compareIds = parseCompareIds(
    window.location.search
      ? new URLSearchParams(window.location.search).get("compare")
      : null,
  );
  const toggleCompare = () => {
    const next = stringifyCompareIds(toggleCompareId(compareIds, model.id));
    window.location.href = `/${locale}/benchmarks?compare=${encodeURIComponent(next)}`;
  };

  return (
    <div className="grid gap-4">
      <div className="min-w-0 rounded-lg border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0">
            <Link
              to="/$locale/models"
              params={{ locale }}
              className="mb-3 inline-flex text-sm font-medium"
            >
              ← {t(locale, "explorer")}
            </Link>
            <h1 className="text-2xl font-semibold text-slate-950 dark:text-white">
              {model.name}
            </h1>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600 dark:text-slate-300">
              {model.description}
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              <Badge tone="blue">{model.lab.name}</Badge>
              {model.family ? <Badge>{model.family}</Badge> : null}
              {model.openWeights ? (
                <Badge tone="green">open weights</Badge>
              ) : null}
              {model.capabilities.reasoning ? (
                <Badge tone="amber">reasoning</Badge>
              ) : null}
              <button
                type="button"
                className="inline-flex h-8 items-center gap-2 rounded-md border border-slate-200 px-3 text-sm dark:border-slate-800"
                onClick={toggleCompare}
              >
                {t(locale, "addToCompare")}
                {compareIds.includes(model.id)
                  ? `(${t(locale, "selected")})`
                  : null}
              </button>
            </div>
          </div>
          <div className="grid min-w-48 gap-2 rounded-lg bg-slate-50 p-3 text-sm dark:bg-slate-950">
            <div className="flex justify-between gap-4">
              <span className="text-slate-500">{t(locale, "releaseDate")}</span>
              <span className="font-medium">{date(model.releaseDate)}</span>
            </div>
            <div className="flex justify-between gap-4">
              <span className="text-slate-500">{t(locale, "context")}</span>
              <span className="font-medium">
                {compactNumber(model.contextWindow?.total)}
              </span>
            </div>
            <div className="flex justify-between gap-4">
              <span className="text-slate-500">{t(locale, "providers")}</span>
              <span className="font-medium">{model.offerings.length}</span>
            </div>
          </div>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
        <Section title={t(locale, "overview")}>
          <div className="grid gap-3 text-sm">
            <div className="grid gap-2 md:grid-cols-2">
              <div className="rounded-md bg-slate-50 p-3 dark:bg-slate-950">
                <div className="text-xs uppercase text-slate-500">
                  {t(locale, "architecture")}
                </div>
                <div className="mt-1 font-medium">
                  {model.architecture ?? dash(model.architecture)}
                </div>
              </div>
              <div className="rounded-md bg-slate-50 p-3 dark:bg-slate-950">
                <div className="text-xs uppercase text-slate-500">
                  {t(locale, "license")}
                </div>
                <div className="mt-1 font-medium">
                  {model.license ?? dash(model.license)}
                </div>
              </div>
              <div className="rounded-md bg-slate-50 p-3 dark:bg-slate-950">
                <div className="text-xs uppercase text-slate-500">
                  {t(locale, "openWeights")}
                </div>
                <div className="mt-1 font-medium">
                  {model.openWeights ? t(locale, "yes") : t(locale, "no")}
                </div>
              </div>
              <div className="rounded-md bg-slate-50 p-3 dark:bg-slate-950">
                <div className="text-xs uppercase text-slate-500">
                  {t(locale, "aliases")}
                </div>
                <div className="mt-1 font-medium">
                  {compactNumber(model.aliases.length)}
                </div>
              </div>
            </div>
            <div className="rounded-md bg-slate-50 p-3 dark:bg-slate-950">
              <div className="text-xs uppercase text-slate-500">
                {t(locale, "aliases")}
              </div>
              <div className="mt-2 flex flex-wrap gap-2">
                {model.aliases.map((alias) => (
                  <Badge key={alias}>{alias}</Badge>
                ))}
              </div>
            </div>
          </div>
        </Section>

        <Section title={t(locale, "pricing")}>
          <div className="overflow-x-auto">
            <table className="min-w-[640px] text-left text-sm">
              <thead className="text-xs uppercase text-slate-500">
                <tr>
                  <th className="py-2 pr-3">{t(locale, "provider")}</th>
                  <th className="py-2 pr-3">{t(locale, "input")}</th>
                  <th className="py-2 pr-3">{t(locale, "cached")}</th>
                  <th className="py-2 pr-3">{t(locale, "output")}</th>
                  <th className="py-2 pr-3">{t(locale, "reasoning")}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {model.offerings.map((offering) => (
                  <tr
                    key={`${offering.provider.id}-${offering.providerModelId}`}
                  >
                    <td className="py-2 pr-3 font-medium">
                      {offering.provider.name}
                    </td>
                    <td className="py-2 pr-3">
                      {price(offering.pricing?.input)}
                    </td>
                    <td className="py-2 pr-3">
                      {price(offering.pricing?.cachedInput)}
                    </td>
                    <td className="py-2 pr-3">
                      {price(offering.pricing?.output)}
                    </td>
                    <td className="py-2 pr-3">
                      {price(offering.pricing?.reasoning)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Section>

        <Section title={t(locale, "capabilities")}>
          <div className="grid gap-2">
            {capabilityRows.map(([key, value]) => (
              <div
                key={key}
                className="flex items-center justify-between rounded-md bg-slate-50 px-3 py-2 text-sm dark:bg-slate-950"
              >
                <span>{key}</span>
                <span className="inline-flex items-center gap-1 font-medium">
                  {value ? (
                    <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                  ) : null}
                  {String(value)}
                </span>
              </div>
            ))}
          </div>
        </Section>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Section title={t(locale, "benchmark")}>
          {model.benchmarks.length ? (
            <div className="grid gap-2">
              {model.benchmarks.map((benchmark) => (
                <a
                  key={`${benchmark.benchmark}-${benchmark.score}`}
                  href={benchmark.source}
                  className="rounded-md bg-slate-50 p-3 text-sm dark:bg-slate-950"
                  target="_blank"
                  rel="noreferrer"
                >
                  <div className="flex items-center justify-between gap-3">
                    <span className="font-medium text-slate-950 dark:text-white">
                      {benchmark.benchmark}
                    </span>
                    <span>{benchmark.score}</span>
                  </div>
                  <p className="mt-1 text-xs text-slate-500">
                    {dash(benchmark.metric)} · {date(benchmark.date)}
                  </p>
                </a>
              ))}
            </div>
          ) : (
            <EmptyState label={t(locale, "empty")} />
          )}
        </Section>
        <Section title={t(locale, "timeline")}>
          <div className="grid gap-2 text-sm">
            <div className="flex justify-between rounded-md bg-slate-50 p-3 dark:bg-slate-950">
              <span>{t(locale, "releaseDate")}</span>
              <span className="font-medium">{date(model.releaseDate)}</span>
            </div>
            <div className="flex justify-between rounded-md bg-slate-50 p-3 dark:bg-slate-950">
              <span>{t(locale, "updatedAt")}</span>
              <span className="font-medium">{date(model.lastUpdated)}</span>
            </div>
            {sourceTimeline.map((item) => (
              <div
                key={`${item.label}-${item.value}`}
                className="rounded-md bg-slate-50 p-3 dark:bg-slate-950"
              >
                <div className="flex items-center justify-between gap-3">
                  <span className="font-medium">{item.label}</span>
                  <span className="text-xs text-slate-500">
                    {date(item.value)}
                  </span>
                </div>
                <p className="mt-1 truncate text-xs text-slate-500">
                  {item.note}
                </p>
              </div>
            ))}
          </div>
        </Section>
      </div>

      <Section title={t(locale, "providers")}>
        <div className="grid gap-2">
          {model.offerings.slice(0, 24).map((offering) => (
            <div
              key={`${offering.provider.id}-${offering.providerModelId}`}
              className="flex items-center justify-between gap-3 rounded-md bg-slate-50 px-3 py-2 text-sm dark:bg-slate-950"
            >
              <span className="min-w-0 truncate font-medium">
                {offering.provider.name}
              </span>
              {offering.provider.doc ? (
                <a
                  href={offering.provider.doc}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex shrink-0 items-center gap-1 text-xs"
                >
                  <ExternalLink className="h-3.5 w-3.5" />
                  docs
                </a>
              ) : null}
            </div>
          ))}
        </div>
      </Section>

      <Section title={t(locale, "related")}>
        {relatedModels.length ? (
          <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
            {relatedModels.map((item) => (
              <Link
                key={item.id}
                to="/$locale/models/$modelId"
                params={{ locale, modelId: item.id }}
                className="rounded-md border border-slate-200 bg-slate-50 p-3 text-sm dark:border-slate-800 dark:bg-slate-950"
              >
                <div className="font-medium text-slate-950 dark:text-white">
                  {item.name}
                </div>
                <p className="mt-1 truncate text-xs text-slate-500">
                  {item.id}
                </p>
                <p className="mt-2 text-xs text-slate-500">
                  {item.lab.name} · {item.family ?? dash(item.family)}
                </p>
              </Link>
            ))}
          </div>
        ) : (
          <EmptyState label={t(locale, "empty")} />
        )}
      </Section>

      <Section title={t(locale, "sources")}>
        <div className="grid gap-2">
          {model.sources.map((source, index) => (
            <a
              key={`${source.source}-${index}`}
              href={source.url}
              target="_blank"
              rel="noreferrer"
              className="grid gap-1 rounded-md border border-slate-200 px-3 py-2 text-sm dark:border-slate-800"
            >
              <div className="flex items-center gap-2">
                <span className="font-medium">{source.source}</span>
                <ExternalLink className="h-3.5 w-3.5" />
              </div>
              <div className="flex flex-wrap gap-x-3 text-xs text-slate-500">
                <span>{date(source.fetchedAt)}</span>
                <span className="truncate">{source.url ?? "-"}</span>
              </div>
            </a>
          ))}
        </div>
      </Section>

      <Section title={t(locale, "rawJson")}>
        <div className="mb-3 flex justify-end">
          <button
            type="button"
            className="inline-flex h-9 items-center gap-2 rounded-md border border-slate-200 px-3 text-sm font-medium dark:border-slate-800"
            onClick={() =>
              navigator.clipboard.writeText(JSON.stringify(model, null, 2))
            }
          >
            <Copy className="h-4 w-4" />
            {t(locale, "copy")}
          </button>
        </div>
        <pre className="max-h-[420px] overflow-auto rounded-md bg-slate-950 p-4 text-xs text-slate-100 scrollbar-thin">
          {JSON.stringify(model, null, 2)}
        </pre>
      </Section>
    </div>
  );
}
