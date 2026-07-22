import { Link, useLocation, useParams } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import {
  Filter,
  Grid2X2,
  List,
  Rows3,
  SlidersHorizontal,
  X,
} from "lucide-react";
import { useMemo, useState } from "react";
import type { ReactNode } from "react";
import clsx from "clsx";
import { getFilters, getStats, listModels } from "../lib/api";
import {
  compareLimit,
  parseCompareIds,
  stringifyCompareIds,
  toggleCompareId,
} from "../lib/compare";
import { compactNumber, date, price } from "../lib/format";
import { normalizeLocale, t } from "../lib/i18n";
import { useUrlState, type UrlStateCodec } from "../lib/url-state";
import { useSeo } from "../lib/seo";
import type { Model } from "../lib/types";
import { Badge } from "../components/Badge";
import { EmptyState, ErrorState, LoadingState } from "../components/StateBlock";

type ViewMode = "grid" | "list" | "compact";

interface ExplorerState {
  q: string;
  lab: string;
  provider: string;
  capability: string;
  modality: string;
  openWeights: string;
  license: string;
  architecture: string;
  releaseYear: string;
  contextBand: string;
  priceBand: string;
  benchmark: string;
  sort: string;
  order: "asc" | "desc";
  view: ViewMode;
  page: number;
  pageSize: number;
  compare: string;
}

const defaultState: ExplorerState = {
  q: "",
  lab: "",
  provider: "",
  capability: "",
  modality: "",
  openWeights: "",
  license: "",
  architecture: "",
  releaseYear: "",
  contextBand: "",
  priceBand: "",
  benchmark: "",
  sort: "name",
  order: "asc",
  view: "list",
  page: 1,
  pageSize: 20,
  compare: "",
};

const explorerCodec: UrlStateCodec<ExplorerState> = {
  read(search) {
    const view = search.get("view");
    const order = search.get("order");
    return {
      ...defaultState,
      q: search.get("q") ?? "",
      lab: search.get("lab") ?? "",
      provider: search.get("provider") ?? "",
      capability: search.get("capability") ?? "",
      modality: search.get("modality") ?? "",
      openWeights: search.get("openWeights") ?? "",
      license: search.get("license") ?? "",
      architecture: search.get("architecture") ?? "",
      releaseYear: search.get("releaseYear") ?? "",
      contextBand: search.get("contextBand") ?? "",
      priceBand: search.get("priceBand") ?? "",
      benchmark: search.get("benchmark") ?? "",
      sort:
        search.get("sort") === "none"
          ? ""
          : (search.get("sort") ?? defaultState.sort),
      order: order === "desc" ? "desc" : "asc",
      view: view === "grid" || view === "compact" ? view : "list",
      page: Number(search.get("page") ?? defaultState.page),
      pageSize: Number(search.get("pageSize") ?? defaultState.pageSize),
      compare: stringifyCompareIds(parseCompareIds(search.get("compare"))),
    };
  },
  write(value) {
    const params = new URLSearchParams();
    for (const [key, fieldValue] of Object.entries(value)) {
      if (key === "sort" && fieldValue === "") params.set("sort", "none");
      if (
        fieldValue !== "" &&
        fieldValue !== defaultState[key as keyof ExplorerState]
      )
        params.set(key, String(fieldValue));
    }
    return params;
  },
};

function useLocale() {
  const params = useParams({ strict: false }) as { locale?: string };
  return normalizeLocale(params.locale);
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="grid gap-1 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
      {label}
      {children}
    </label>
  );
}

function SelectField({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: string[];
  onChange(value: string): void;
}) {
  const locale = useLocale();
  return (
    <Field label={label}>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="h-10 rounded-md border border-slate-200 bg-white px-3 text-sm normal-case text-slate-900 outline-none focus:border-sky-500 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-100"
      >
        <option value="">{t(locale, "all")}</option>
        {options.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
    </Field>
  );
}

function FilterPanel({
  state,
  setState,
  filters,
}: {
  state: ExplorerState;
  setState: (
    next: ExplorerState | ((current: ExplorerState) => ExplorerState),
  ) => void;
  filters: {
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
  };
}) {
  const locale = useLocale();
  const setField = (key: keyof ExplorerState, value: string) =>
    setState((current) => ({ ...current, [key]: value, page: 1 }));
  return (
    <div className="grid gap-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm font-semibold text-slate-900 dark:text-white">
          <SlidersHorizontal className="h-4 w-4" />
          {t(locale, "filters")}
        </div>
        <button
          type="button"
          className="h-8 rounded-md px-2 text-xs font-medium text-slate-500 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
          onClick={() => setState(defaultState)}
        >
          {t(locale, "reset")}
        </button>
      </div>
      <SelectField
        label={t(locale, "lab")}
        value={state.lab}
        options={filters.labs}
        onChange={(value) => setField("lab", value)}
      />
      <SelectField
        label={t(locale, "provider")}
        value={state.provider}
        options={filters.providers}
        onChange={(value) => setField("provider", value)}
      />
      <SelectField
        label={t(locale, "capability")}
        value={state.capability}
        options={filters.capabilities}
        onChange={(value) => setField("capability", value)}
      />
      <SelectField
        label={t(locale, "modality")}
        value={state.modality}
        options={filters.modalities}
        onChange={(value) => setField("modality", value)}
      />
      <Field label={t(locale, "openWeights")}>
        <select
          value={state.openWeights}
          onChange={(event) => setField("openWeights", event.target.value)}
          className="h-10 rounded-md border border-slate-200 bg-white px-3 text-sm normal-case text-slate-900 outline-none focus:border-sky-500 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-100"
        >
          <option value="">{t(locale, "all")}</option>
          <option value="true">{t(locale, "yes")}</option>
          <option value="false">{t(locale, "no")}</option>
        </select>
      </Field>
      {filters.licenses.length ? (
        <SelectField
          label={t(locale, "license")}
          value={state.license}
          options={filters.licenses}
          onChange={(value) => setField("license", value)}
        />
      ) : null}
      {filters.architectures.length ? (
        <SelectField
          label={t(locale, "architecture")}
          value={state.architecture}
          options={filters.architectures}
          onChange={(value) => setField("architecture", value)}
        />
      ) : null}
      {filters.releaseYears.length ? (
        <SelectField
          label={t(locale, "releaseDate")}
          value={state.releaseYear}
          options={filters.releaseYears}
          onChange={(value) => setField("releaseYear", value)}
        />
      ) : null}
      {filters.contextBands.length ? (
        <SelectField
          label={t(locale, "contextBand")}
          value={state.contextBand}
          options={filters.contextBands}
          onChange={(value) => setField("contextBand", value)}
        />
      ) : null}
      {filters.priceBands.length ? (
        <SelectField
          label={t(locale, "priceBand")}
          value={state.priceBand}
          options={filters.priceBands}
          onChange={(value) => setField("priceBand", value)}
        />
      ) : null}
      {filters.benchmarks.length ? (
        <SelectField
          label={t(locale, "benchmark")}
          value={state.benchmark}
          options={filters.benchmarks}
          onChange={(value) => setField("benchmark", value)}
        />
      ) : null}
      <Field label={t(locale, "pageSize")}>
        <select
          value={state.pageSize}
          onChange={(event) =>
            setState((current) => ({
              ...current,
              page: 1,
              pageSize: Number(event.target.value),
            }))
          }
          className="h-10 rounded-md border border-slate-200 bg-white px-3 text-sm normal-case text-slate-900 outline-none focus:border-sky-500 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-100"
        >
          {[20, 50, 100].map((size) => (
            <option key={size} value={size}>
              {size}
            </option>
          ))}
        </select>
      </Field>
    </div>
  );
}

function ModelMeta({ model, locale }: { model: Model; locale: "en" | "zh" }) {
  const minInput = model.offerings
    .map((offering) => offering.pricing?.input)
    .filter((value): value is number => value !== undefined)
    .sort((a, b) => a - b)[0];
  return (
    <div className="flex flex-wrap gap-2">
      <Badge tone="blue">{model.lab.name}</Badge>
      {model.openWeights ? (
        <Badge tone="green">{t(locale, "openWeights")}</Badge>
      ) : null}
      {model.capabilities.reasoning ? (
        <Badge tone="amber">{t(locale, "reasoning")}</Badge>
      ) : null}
      <Badge>{compactNumber(model.contextWindow?.total)}</Badge>
      <Badge>{price(minInput)}</Badge>
    </div>
  );
}

function ModelCard({
  model,
  locale,
  compact = false,
  selected,
  onToggleCompare,
}: {
  model: Model;
  locale: "en" | "zh";
  compact?: boolean;
  selected: boolean;
  onToggleCompare(modelId: string): void;
}) {
  return (
    <article
      className={clsx(
        "min-w-0 overflow-hidden rounded-lg border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900",
        compact && "p-3",
      )}
    >
      <div className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-start gap-3">
        <input
          type="checkbox"
          checked={selected}
          onChange={() => onToggleCompare(model.id)}
          aria-label={`${t(locale, "addToCompare")} ${model.name}`}
          className="mt-1 h-4 w-4 shrink-0 rounded border-slate-300"
        />
        <div className="min-w-0">
          <Link
            to="/$locale/models/$modelId"
            params={{ locale, modelId: model.id }}
            className="block truncate text-sm font-semibold text-slate-950 dark:text-white"
          >
            {model.name}
          </Link>
          <p className="mt-1 truncate font-mono text-xs text-slate-500">
            {model.id}
          </p>
        </div>
        <span className="shrink-0 text-xs text-slate-500">
          {date(model.releaseDate)}
        </span>
      </div>
      {!compact ? (
        <p className="mt-3 line-clamp-2 text-sm text-slate-600 dark:text-slate-300">
          {model.description}
        </p>
      ) : null}
      <div className="mt-3">
        <ModelMeta model={model} locale={locale} />
      </div>
      {!compact ? (
        <dl className="mt-3 grid grid-cols-2 gap-2 text-xs text-slate-500">
          <div>
            <dt className="font-semibold uppercase">{t(locale, "family")}</dt>
            <dd className="truncate">{model.family ?? "-"}</dd>
          </div>
          <div>
            <dt className="font-semibold uppercase">
              {t(locale, "updatedAt")}
            </dt>
            <dd>{date(model.lastUpdated)}</dd>
          </div>
        </dl>
      ) : null}
    </article>
  );
}

function ModelResults({
  models,
  view,
  locale,
  compareIds,
  onToggleCompare,
  sort,
  order,
  onSort,
}: {
  models: Model[];
  view: ViewMode;
  locale: "en" | "zh";
  compareIds: string[];
  onToggleCompare(modelId: string): void;
  sort: string;
  order: "asc" | "desc";
  onSort(key: string): void;
}) {
  if (view === "grid") {
    return (
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {models.map((model) => (
          <ModelCard
            key={model.id}
            model={model}
            locale={locale}
            selected={compareIds.includes(model.id)}
            onToggleCompare={onToggleCompare}
          />
        ))}
      </div>
    );
  }

  if (view === "compact") {
    return (
      <div className="grid gap-2">
        {models.map((model) => (
          <ModelCard
            key={model.id}
            model={model}
            locale={locale}
            compact
            selected={compareIds.includes(model.id)}
            onToggleCompare={onToggleCompare}
          />
        ))}
      </div>
    );
  }

  return (
    <>
      <div className="grid gap-2 md:hidden">
        {models.map((model) => (
          <ModelCard
            key={model.id}
            model={model}
            locale={locale}
            selected={compareIds.includes(model.id)}
            onToggleCompare={onToggleCompare}
          />
        ))}
      </div>
      <div className="hidden overflow-hidden rounded-lg border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900 md:block">
        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase text-slate-500 dark:bg-slate-900 dark:text-slate-400">
              <tr>
                <th className="px-4 py-3">{t(locale, "compare")}</th>
                <th className="px-4 py-3">
                  <button
                    type="button"
                    className="inline-flex items-center gap-1 font-semibold"
                    onClick={() => onSort("name")}
                  >
                    {t(locale, "name")}
                    <span>
                      {sort === "name" ? (order === "asc" ? "↑" : "↓") : ""}
                    </span>
                  </button>
                </th>
                <th className="px-4 py-3">{t(locale, "lab")}</th>
                <th className="px-4 py-3">
                  <button
                    type="button"
                    className="inline-flex items-center gap-1 font-semibold"
                    onClick={() => onSort("context")}
                  >
                    {t(locale, "context")}
                    <span>
                      {sort === "context" ? (order === "asc" ? "↑" : "↓") : ""}
                    </span>
                  </button>
                </th>
                <th className="px-4 py-3">{t(locale, "providers")}</th>
                <th className="px-4 py-3">
                  <button
                    type="button"
                    className="inline-flex items-center gap-1 font-semibold"
                    onClick={() => onSort("price")}
                  >
                    {t(locale, "input")}
                    <span>
                      {sort === "price" ? (order === "asc" ? "↑" : "↓") : ""}
                    </span>
                  </button>
                </th>
                <th className="px-4 py-3">
                  <button
                    type="button"
                    className="inline-flex items-center gap-1 font-semibold"
                    onClick={() => onSort("releaseDate")}
                  >
                    {t(locale, "releaseDate")}
                    <span>
                      {sort === "releaseDate"
                        ? order === "asc"
                          ? "↑"
                          : "↓"
                        : ""}
                    </span>
                  </button>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {models.map((model) => {
                const minInput = model.offerings
                  .map((offering) => offering.pricing?.input)
                  .filter((value): value is number => value !== undefined)
                  .sort((a, b) => a - b)[0];
                return (
                  <tr
                    key={model.id}
                    className="hover:bg-slate-50 dark:hover:bg-slate-800/60"
                  >
                    <td className="px-4 py-3">
                      <input
                        type="checkbox"
                        checked={compareIds.includes(model.id)}
                        onChange={() => onToggleCompare(model.id)}
                        aria-label={`${t(locale, "addToCompare")} ${model.name}`}
                        className="h-4 w-4 rounded border-slate-300"
                      />
                    </td>
                    <td className="max-w-md px-4 py-3">
                      <Link
                        to="/$locale/models/$modelId"
                        params={{ locale, modelId: model.id }}
                        className="font-semibold text-slate-950 dark:text-white"
                      >
                        {model.name}
                      </Link>
                      <p className="mt-1 truncate text-xs text-slate-500">
                        {model.description}
                      </p>
                    </td>
                    <td className="px-4 py-3">{model.lab.name}</td>
                    <td className="px-4 py-3">
                      {compactNumber(model.contextWindow?.total)}
                    </td>
                    <td className="px-4 py-3">{model.offerings.length}</td>
                    <td className="px-4 py-3">{price(minInput)}</td>
                    <td className="px-4 py-3">{date(model.releaseDate)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}

export function ExplorerPage() {
  const locale = useLocale();
  const location = useLocation();
  const [state, setState] = useUrlState(explorerCodec);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const modelParams = useMemo(() => {
    const { compare: _compare, ...rest } = state;
    return {
      ...rest,
      sort: state.sort || undefined,
      page: state.page || 1,
      pageSize: state.pageSize || 20,
    };
  }, [state]);
  const modelsQuery = useQuery({
    queryKey: ["models", modelParams],
    queryFn: () => listModels(modelParams),
  });
  const filtersQuery = useQuery({ queryKey: ["filters"], queryFn: getFilters });
  const statsQuery = useQuery({ queryKey: ["stats"], queryFn: getStats });

  const filters = filtersQuery.data?.data ?? {
    labs: [],
    providers: [],
    capabilities: [],
    modalities: [],
    licenses: [],
    architectures: [],
    releaseYears: [],
    contextBands: [],
    priceBands: [],
    benchmarks: [],
  };
  const models = modelsQuery.data?.data ?? [];
  const total = Number(modelsQuery.data?.meta.total ?? 0);
  const pageCount = Number(
    modelsQuery.data?.meta.totalPages ?? modelsQuery.data?.meta.pageCount ?? 1,
  );
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
      if (current.sort !== key)
        return { ...current, sort: key, order: "asc", page: 1 };
      if (current.order === "asc")
        return { ...current, order: "desc", page: 1 };
      return { ...current, sort: "", order: "asc", page: 1 };
    });
  };

  useSeo({
    locale,
    title:
      locale === "zh"
        ? "AI 模型探索器 | Models.dev Explorer"
        : "AI Model Explorer | Models.dev Explorer",
    description:
      locale === "zh"
        ? "基于实时 models.dev 数据搜索、筛选、排序并比较 AI 模型。"
        : "Search, filter, sort, and compare AI models using the live models.dev dataset.",
    path: location.pathname,
  });

  return (
    <div className="grid gap-4 lg:grid-cols-[280px_1fr]">
      <aside className="hidden rounded-lg border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900 lg:block">
        <FilterPanel state={state} setState={setState} filters={filters} />
      </aside>

      {filtersOpen ? (
        <div className="fixed inset-0 z-50 bg-slate-950/45 p-3 lg:hidden">
          <div className="ml-auto h-full max-w-sm overflow-y-auto rounded-lg bg-white p-4 shadow-panel dark:bg-slate-900">
            <button
              className="mb-3 ml-auto flex h-9 w-9 items-center justify-center rounded-md hover:bg-slate-100 dark:hover:bg-slate-800"
              type="button"
              onClick={() => setFiltersOpen(false)}
            >
              <X className="h-4 w-4" />
            </button>
            <FilterPanel state={state} setState={setState} filters={filters} />
          </div>
        </div>
      ) : null}

      <section className="min-w-0">
        <div className="mb-4 grid gap-3 rounded-lg border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div className="grid gap-1">
              <h1 className="text-xl font-semibold text-slate-950 dark:text-white">
                {t(locale, "explorer")}
              </h1>
              <p className="text-sm text-slate-500">
                {compactNumber(statsQuery.data?.data.modelCount)} models ·{" "}
                {compactNumber(statsQuery.data?.data.providerCount)} providers
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <button
                className="inline-flex h-10 items-center gap-2 rounded-md border border-slate-200 px-3 text-sm font-medium dark:border-slate-800 lg:hidden"
                type="button"
                onClick={() => setFiltersOpen(true)}
              >
                <Filter className="h-4 w-4" />
                {t(locale, "filters")}
              </button>
              <button
                className={clsx(
                  "h-10 w-10 rounded-md border",
                  state.view === "list"
                    ? "border-slate-900 bg-slate-900 text-white dark:border-white dark:bg-white dark:text-slate-950"
                    : "border-slate-200 dark:border-slate-800",
                )}
                type="button"
                onClick={() =>
                  setState((current) => ({ ...current, view: "list" }))
                }
              >
                <List className="mx-auto h-4 w-4" />
              </button>
              <button
                className={clsx(
                  "h-10 w-10 rounded-md border",
                  state.view === "grid"
                    ? "border-slate-900 bg-slate-900 text-white dark:border-white dark:bg-white dark:text-slate-950"
                    : "border-slate-200 dark:border-slate-800",
                )}
                type="button"
                onClick={() =>
                  setState((current) => ({ ...current, view: "grid" }))
                }
              >
                <Grid2X2 className="mx-auto h-4 w-4" />
              </button>
              <button
                className={clsx(
                  "h-10 w-10 rounded-md border",
                  state.view === "compact"
                    ? "border-slate-900 bg-slate-900 text-white dark:border-white dark:bg-white dark:text-slate-950"
                    : "border-slate-200 dark:border-slate-800",
                )}
                type="button"
                onClick={() =>
                  setState((current) => ({ ...current, view: "compact" }))
                }
              >
                <Rows3 className="mx-auto h-4 w-4" />
              </button>
            </div>
          </div>
          <div className="grid gap-2 md:grid-cols-[1fr_180px_150px]">
            <input
              value={state.q}
              onChange={(event) =>
                setState((current) => ({
                  ...current,
                  q: event.target.value,
                  page: 1,
                }))
              }
              placeholder={t(locale, "search")}
              className="h-11 rounded-md border border-slate-200 bg-white px-3 text-sm outline-none focus:border-sky-500 dark:border-slate-800 dark:bg-slate-950"
            />
            <select
              aria-label={t(locale, "sort")}
              className="h-11 rounded-md border border-slate-200 bg-white px-3 text-sm dark:border-slate-800 dark:bg-slate-950"
              value={state.sort}
              onChange={(event) =>
                setState((current) => ({
                  ...current,
                  sort: event.target.value,
                  page: 1,
                }))
              }
            >
              {[
                ["", t(locale, "defaultSort")],
                ["name", t(locale, "name")],
                ["releaseDate", t(locale, "releaseDate")],
                ["context", t(locale, "context")],
                ["price", t(locale, "price")],
                ["benchmark", t(locale, "benchmark")],
              ].map(([option, label]) => (
                <option key={option} value={option}>
                  {label}
                </option>
              ))}
            </select>
            <select
              aria-label={t(locale, "order")}
              className="h-11 rounded-md border border-slate-200 bg-white px-3 text-sm dark:border-slate-800 dark:bg-slate-950"
              value={state.order}
              onChange={(event) =>
                setState((current) => ({
                  ...current,
                  order: event.target.value === "desc" ? "desc" : "asc",
                  page: 1,
                }))
              }
            >
              <option value="asc">{t(locale, "asc")}</option>
              <option value="desc">{t(locale, "desc")}</option>
            </select>
          </div>
        </div>

        {modelsQuery.isLoading ? (
          <LoadingState label={t(locale, "loading")} />
        ) : null}
        {modelsQuery.isError ? (
          <ErrorState
            label={t(locale, "error")}
            message={modelsQuery.error.message}
          />
        ) : null}
        {!modelsQuery.isLoading && !modelsQuery.isError && !models.length ? (
          <EmptyState label={t(locale, "empty")} />
        ) : null}
        {!modelsQuery.isLoading && !modelsQuery.isError && models.length ? (
          <ModelResults
            models={models}
            view={state.view}
            locale={locale}
            compareIds={compareIds}
            onToggleCompare={toggleCompare}
            sort={state.sort}
            order={state.order}
            onSort={cycleSort}
          />
        ) : null}

        <div className="mt-4 flex items-center justify-between text-sm text-slate-500">
          <span>{total} total</span>
          <div className="flex items-center gap-2">
            <button
              className="h-9 rounded-md border border-slate-200 px-3 disabled:opacity-40 dark:border-slate-800"
              type="button"
              disabled={state.page <= 1}
              onClick={() =>
                setState((current) => ({ ...current, page: current.page - 1 }))
              }
            >
              {t(locale, "prev")}
            </button>
            <span>
              {state.page} / {pageCount}
            </span>
            <button
              className="h-9 rounded-md border border-slate-200 px-3 disabled:opacity-40 dark:border-slate-800"
              type="button"
              disabled={state.page >= pageCount}
              onClick={() =>
                setState((current) => ({ ...current, page: current.page + 1 }))
              }
            >
              {t(locale, "next")}
            </button>
          </div>
        </div>
      </section>
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
