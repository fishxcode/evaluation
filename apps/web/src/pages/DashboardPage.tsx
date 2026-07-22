import { Link, useLocation, useParams } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { BarChart3, Clock, Database, Eye, FlaskConical } from "lucide-react";
import { getStats, listModels } from "../lib/api";
import { compactNumber, date, price } from "../lib/format";
import { normalizeLocale, t } from "../lib/i18n";
import { useSeo } from "../lib/seo";
import { Badge } from "../components/Badge";
import { ErrorState, LoadingState } from "../components/StateBlock";

function useLocale() {
  const params = useParams({ strict: false }) as { locale?: string };
  return normalizeLocale(params.locale);
}

function Metric({
  label,
  value,
  icon: Icon,
}: {
  label: string;
  value: string;
  icon: typeof Database;
}) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <div className="mb-3 flex h-9 w-9 items-center justify-center rounded-md bg-slate-950 text-white dark:bg-white dark:text-slate-950">
        <Icon className="h-4 w-4" />
      </div>
      <p className="text-sm text-slate-500">{label}</p>
      <p className="mt-2 text-2xl font-semibold text-slate-950 dark:text-white">
        {value}
      </p>
    </div>
  );
}

/** Dataset overview dashboard page.
 * 数据集概览仪表盘页面。 */
export function DashboardPage() {
  const locale = useLocale();
  const location = useLocation();
  const statsQuery = useQuery({ queryKey: ["stats"], queryFn: getStats });
  const modelsQuery = useQuery({
    queryKey: ["models", "dashboard"],
    queryFn: () => listModels({ page: 1, pageSize: 100 }),
  });

  useSeo({
    locale,
    title:
      locale === "zh"
        ? "模型目录仪表盘 | Models.dev Explorer"
        : "Model catalog dashboard | Models.dev Explorer",
    description:
      locale === "zh"
        ? "查看模型数量、Provider、最新发布与价格趋势。"
        : "Track model counts, providers, latest releases, and pricing trends from the merged dataset.",
    path: location.pathname,
  });

  if (statsQuery.isLoading || modelsQuery.isLoading)
    return <LoadingState label={t(locale, "loading")} />;
  if (statsQuery.isError)
    return (
      <ErrorState
        label={t(locale, "error")}
        message={statsQuery.error.message}
      />
    );
  if (modelsQuery.isError)
    return (
      <ErrorState
        label={t(locale, "error")}
        message={modelsQuery.error.message}
      />
    );

  const stats = statsQuery.data?.data;
  const latest = [...(modelsQuery.data?.data ?? [])]
    .filter((model) => model.releaseDate)
    .sort((a, b) => (b.releaseDate ?? "").localeCompare(a.releaseDate ?? ""))
    .slice(0, 10);
  const byLab = new Map<string, number>();
  for (const model of modelsQuery.data?.data ?? [])
    byLab.set(model.lab.name, (byLab.get(model.lab.name) ?? 0) + 1);
  const topLabs = [...byLab.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8);
  const topCount = topLabs[0]?.[1] ?? 1;

  return (
    <div className="grid gap-4">
      <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <h1 className="text-xl font-semibold text-slate-950 dark:text-white">
          {t(locale, "dashboard")}
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          {t(locale, "updatedAt")}: {date(stats?.updatedAt)}
        </p>
      </section>

      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <Metric
          label={t(locale, "modelCount")}
          value={compactNumber(stats?.modelCount)}
          icon={Database}
        />
        <Metric
          label={t(locale, "providerCount")}
          value={compactNumber(stats?.providerCount)}
          icon={BarChart3}
        />
        <Metric
          label={t(locale, "labCount")}
          value={compactNumber(stats?.labCount)}
          icon={FlaskConical}
        />
        <Metric
          label={t(locale, "averageInputPrice")}
          value={price(stats?.averageInputPrice)}
          icon={Clock}
        />
        <Metric
          label={t(locale, "pageViews")}
          value={compactNumber(stats?.pageViews)}
          icon={Eye}
        />
      </section>

      <section className="grid gap-4 lg:grid-cols-[0.9fr_1.1fr]">
        <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-slate-500">
            {t(locale, "latestModels")}
          </h2>
          <div className="grid gap-2">
            {latest.map((model) => (
              <Link
                key={model.id}
                to="/$locale/models/$modelId"
                params={{ locale, modelId: model.id }}
                className="rounded-md bg-slate-50 p-3 text-sm dark:bg-slate-950"
              >
                <div className="flex items-start justify-between gap-3">
                  <span className="font-semibold text-slate-950 dark:text-white">
                    {model.name}
                  </span>
                  <span className="shrink-0 text-xs text-slate-500">
                    {date(model.releaseDate)}
                  </span>
                </div>
                <div className="mt-2 flex flex-wrap gap-2">
                  <Badge tone="blue">{model.lab.name}</Badge>
                  {model.capabilities.reasoning ? (
                    <Badge tone="amber">reasoning</Badge>
                  ) : null}
                </div>
              </Link>
            ))}
          </div>
        </div>

        <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-slate-500">
            {t(locale, "modelTimeline")}
          </h2>
          <div className="grid gap-3">
            {topLabs.map(([lab, count]) => (
              <div key={lab} className="grid gap-1">
                <div className="flex justify-between gap-3 text-sm">
                  <span className="truncate font-medium">{lab}</span>
                  <span className="text-slate-500">{count}</span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
                  <div
                    className="h-full rounded-full bg-sky-500"
                    style={{
                      width: `${Math.max(6, (count / topCount) * 100)}%`,
                    }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
