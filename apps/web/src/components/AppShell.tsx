import { Link, Outlet, useLocation, useParams } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  BarChart3,
  BookOpen,
  Command,
  Database,
  FlaskConical,
  LayoutDashboard,
  Monitor,
  Moon,
  Search,
  Sun,
  Table2,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import clsx from "clsx";
import { CommandPalette } from "./CommandPalette";
import { apiDocsUrl, getStats, recordPageView } from "../lib/api";
import { compactNumber } from "../lib/format";
import { normalizeLocale, t, type Locale } from "../lib/i18n";
import { readTheme, writeTheme, type ThemeMode } from "../lib/theme";

function readPageSession() {
  const key = "models-dev-page-session";
  const existing = window.sessionStorage.getItem(key);
  if (existing) return existing;
  const next =
    window.crypto.randomUUID?.() ??
    `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  window.sessionStorage.setItem(key, next);
  return next;
}

function useLocale() {
  const params = useParams({ strict: false }) as { locale?: string };
  return normalizeLocale(params.locale);
}

function switchLocale(pathname: string, locale: Locale) {
  const parts = pathname.split("/");
  if (parts[1] === "en" || parts[1] === "zh") {
    parts[1] = locale;
    return parts.join("/") || `/${locale}/models`;
  }
  return `/${locale}/models`;
}

function navClass(active: boolean) {
  return clsx(
    "inline-flex h-9 items-center gap-2 rounded-md px-3 text-sm font-medium transition",
    active
      ? "bg-slate-900 text-white dark:bg-white dark:text-slate-950"
      : "text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800",
  );
}

export function AppShell() {
  const locale = useLocale();
  const location = useLocation();
  const queryClient = useQueryClient();
  const [theme, setTheme] = useState<ThemeMode>("system");
  const [commandOpen, setCommandOpen] = useState(false);
  const statsQuery = useQuery({
    queryKey: ["stats"],
    queryFn: getStats,
    staleTime: 15_000,
  });

  useEffect(() => {
    const initial = readTheme();
    setTheme(initial);
    writeTheme(initial);
  }, []);

  useEffect(() => {
    if (theme !== "system") return;
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const syncTheme = () => writeTheme("system");
    media.addEventListener("change", syncTheme);
    syncTheme();
    return () => media.removeEventListener("change", syncTheme);
  }, [theme]);

  useEffect(() => {
    const pagePath = `${window.location.pathname}${window.location.search}`;
    void recordPageView(pagePath, readPageSession())
      .then(() => queryClient.invalidateQueries({ queryKey: ["stats"] }))
      .catch(() => undefined);
  }, [location.href, queryClient]);

  const localeTarget = useMemo(
    () => switchLocale(location.pathname, locale === "en" ? "zh" : "en"),
    [locale, location.pathname],
  );

  return (
    <div className="flex min-h-screen flex-col">
      <header className="sticky top-0 z-40 border-b border-slate-200 bg-white/90 backdrop-blur dark:border-slate-800 dark:bg-slate-950/90">
        <div className="mx-auto flex h-14 max-w-7xl items-center justify-between px-3 sm:px-5">
          <Link
            to="/$locale/models"
            params={{ locale }}
            className="flex items-center gap-2 text-slate-950 dark:text-white"
          >
            <span className="flex h-8 w-8 items-center justify-center rounded-md bg-slate-950 text-white dark:bg-white dark:text-slate-950">
              <Database className="h-4 w-4" />
            </span>
            <span className="hidden text-sm font-semibold sm:inline">
              Models.dev Explorer
            </span>
          </Link>
          <nav className="flex min-w-0 flex-1 items-center gap-1 overflow-x-auto px-2">
            <Link
              to="/$locale/dashboard"
              params={{ locale }}
              className={navClass(location.pathname.includes("/dashboard"))}
            >
              <LayoutDashboard className="h-4 w-4" />
              <span className="hidden xl:inline">{t(locale, "dashboard")}</span>
            </Link>
            <Link
              to="/$locale/models"
              params={{ locale }}
              className={navClass(location.pathname.includes("/models"))}
            >
              <Search className="h-4 w-4" />
              <span className="hidden xl:inline">{t(locale, "explorer")}</span>
            </Link>
            <Link
              to="/$locale/pricing"
              params={{ locale }}
              className={navClass(location.pathname.includes("/pricing"))}
            >
              <Table2 className="h-4 w-4" />
              <span className="hidden xl:inline">{t(locale, "pricing")}</span>
            </Link>
            <Link
              to="/$locale/labs"
              params={{ locale }}
              className={navClass(location.pathname.includes("/labs"))}
            >
              <FlaskConical className="h-4 w-4" />
              <span className="hidden xl:inline">{t(locale, "labs")}</span>
            </Link>
            <Link
              to="/$locale/benchmarks"
              params={{ locale }}
              className={navClass(location.pathname.includes("/benchmarks"))}
            >
              <BarChart3 className="h-4 w-4" />
              <span className="hidden xl:inline">
                {t(locale, "benchmarks")}
              </span>
            </Link>
            <a
              href={apiDocsUrl}
              target="_blank"
              rel="noreferrer"
              className={navClass(false)}
              aria-label={t(locale, "apiDocs")}
            >
              <BookOpen className="h-4 w-4" />
              <span className="hidden lg:inline">{t(locale, "apiDocs")}</span>
            </a>
          </nav>
          <div className="flex items-center gap-1">
            <button
              type="button"
              className="inline-flex h-9 min-w-9 items-center justify-center gap-1 rounded-md px-2 text-sm font-medium text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
              onClick={() => setCommandOpen(true)}
              aria-label="Command palette"
            >
              <Command className="h-4 w-4" />
              <span className="hidden 2xl:inline">K</span>
            </button>
            <Link
              to={localeTarget}
              className="inline-flex h-9 min-w-9 items-center justify-center rounded-md px-2 text-sm font-medium text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
            >
              {locale === "en" ? "中" : "EN"}
            </Link>
            <div
              className="inline-flex h-9 items-stretch rounded-md border border-slate-200 bg-white p-0.5 dark:border-slate-800 dark:bg-slate-950"
              role="tablist"
              aria-label="Theme mode"
            >
              {[
                { value: "system" as const, icon: Monitor, label: "system" },
                { value: "light" as const, icon: Sun, label: "light" },
                { value: "dark" as const, icon: Moon, label: "dark" },
              ].map(({ value, icon: Icon, label }) => {
                const active = theme === value;
                return (
                  <button
                    key={value}
                    type="button"
                    className={clsx(
                      "inline-flex w-8 items-center justify-center rounded-sm transition",
                      active
                        ? "bg-slate-900 text-white dark:bg-white dark:text-slate-950"
                        : "text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-900",
                    )}
                    onClick={() => {
                      setTheme(value);
                      writeTheme(value);
                    }}
                    aria-label={label}
                    aria-pressed={active}
                  >
                    <Icon className="h-4 w-4" />
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </header>
      <main className="mx-auto w-full max-w-7xl flex-1 px-3 py-4 sm:px-5 lg:py-6">
        <Outlet />
      </main>
      <footer className="border-t border-slate-200 bg-white/80 py-3 text-sm text-slate-500 dark:border-slate-800 dark:bg-slate-950/80 dark:text-slate-400">
        <div className="mx-auto flex max-w-7xl flex-col gap-1 px-3 sm:flex-row sm:items-center sm:justify-between sm:px-5">
          <span>Models.dev Explorer</span>
          <span>
            {t(locale, "pageViews")}:{" "}
            {compactNumber(statsQuery.data?.data.pageViews)}
          </span>
        </div>
      </footer>
      <CommandPalette open={commandOpen} onOpenChange={setCommandOpen} />
    </div>
  );
}
