import { useNavigate, useParams } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Search, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import clsx from "clsx";
import { listLabs, searchModels } from "../lib/api";
import { normalizeLocale, t } from "../lib/i18n";

interface CommandPaletteProps {
  open: boolean;
  onOpenChange(open: boolean): void;
}

function useLocale() {
  const params = useParams({ strict: false }) as { locale?: string };
  return normalizeLocale(params.locale);
}

/** Global keyboard-search palette for models and labs.
 * 用于模型与 Lab 的全局键盘搜索面板。 */
export function CommandPalette({ open, onOpenChange }: CommandPaletteProps) {
  const locale = useLocale();
  const navigate = useNavigate();
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);
  const modelsQuery = useQuery({
    queryKey: ["command-search", query],
    queryFn: () => searchModels(query),
    enabled: open && query.length > 0,
  });
  const labsQuery = useQuery({
    queryKey: ["labs"],
    queryFn: listLabs,
    enabled: open,
  });

  const results = useMemo(() => {
    const normalized = query.toLowerCase();
    const modelRows = (modelsQuery.data?.data ?? [])
      .slice(0, 8)
      .map((item) => ({
        key: `model:${item.id}`,
        title: item.title,
        subtitle: item.id,
        type: "model" as const,
        modelId: item.id,
      }));
    const labRows = (labsQuery.data?.data ?? [])
      .filter(
        (lab) =>
          normalized &&
          (lab.name.toLowerCase().includes(normalized) ||
            lab.id.toLowerCase().includes(normalized)),
      )
      .slice(0, 5)
      .map((lab) => ({
        key: `lab:${lab.id}`,
        title: lab.name,
        subtitle: lab.id,
        type: "lab" as const,
      }));
    return [...modelRows, ...labRows];
  }, [labsQuery.data?.data, modelsQuery.data?.data, query]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        onOpenChange(!open);
      }
      if (!open) return;
      if (event.key === "Escape") onOpenChange(false);
      if (event.key === "ArrowDown") {
        event.preventDefault();
        setActiveIndex((index) => Math.min(results.length - 1, index + 1));
      }
      if (event.key === "ArrowUp") {
        event.preventDefault();
        setActiveIndex((index) => Math.max(0, index - 1));
      }
      if (event.key === "Enter" && results[activeIndex]) {
        event.preventDefault();
        const selected = results[activeIndex]!;
        onOpenChange(false);
        if (selected.type === "model")
          void navigate({
            to: "/$locale/models/$modelId",
            params: { locale, modelId: selected.modelId },
          });
        else void navigate({ to: "/$locale/labs", params: { locale } });
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [activeIndex, locale, navigate, onOpenChange, open, results]);

  useEffect(() => {
    if (open) {
      setQuery("");
      setActiveIndex(0);
    }
  }, [open]);

  useEffect(() => setActiveIndex(0), [query]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[80] bg-slate-950/50 p-3 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
    >
      <div className="mx-auto mt-16 max-w-2xl overflow-hidden rounded-lg border border-slate-200 bg-white shadow-panel dark:border-slate-800 dark:bg-slate-900">
        <div className="flex items-center gap-2 border-b border-slate-200 px-3 dark:border-slate-800">
          <Search className="h-4 w-4 text-slate-500" />
          <input
            autoFocus
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={`${t(locale, "search")} models, labs`}
            className="h-12 min-w-0 flex-1 bg-transparent text-sm outline-none"
          />
          <button
            type="button"
            className="flex h-9 w-9 items-center justify-center rounded-md hover:bg-slate-100 dark:hover:bg-slate-800"
            onClick={() => onOpenChange(false)}
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="max-h-[420px] overflow-y-auto p-2">
          {!query ? (
            <p className="px-3 py-8 text-center text-sm text-slate-500">
              Type to search models by id, name, or alias.
            </p>
          ) : null}
          {query && !results.length ? (
            <p className="px-3 py-8 text-center text-sm text-slate-500">
              {t(locale, "empty")}
            </p>
          ) : null}
          {results.map((item, index) => (
            <button
              key={item.key}
              type="button"
              className={clsx(
                "grid w-full gap-1 rounded-md px-3 py-2 text-left text-sm",
                activeIndex === index
                  ? "bg-slate-100 dark:bg-slate-800"
                  : "hover:bg-slate-50 dark:hover:bg-slate-800/70",
              )}
              onMouseEnter={() => setActiveIndex(index)}
              onClick={() => {
                onOpenChange(false);
                if (item.type === "model")
                  void navigate({
                    to: "/$locale/models/$modelId",
                    params: { locale, modelId: item.modelId },
                  });
                else void navigate({ to: "/$locale/labs", params: { locale } });
              }}
            >
              <span className="font-semibold text-slate-950 dark:text-white">
                {item.title}
              </span>
              <span className="truncate font-mono text-xs text-slate-500">
                {item.subtitle}
              </span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
