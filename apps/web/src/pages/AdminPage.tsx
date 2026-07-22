import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "@tanstack/react-router";
import {
  AlertTriangle,
  DatabaseZap,
  Lock,
  RotateCcw,
  Save,
  Trash2,
} from "lucide-react";
import { FormEvent, ReactNode, useEffect, useState } from "react";
import { adminLogin, adminRequest } from "../lib/api";
import { date } from "../lib/format";
import { normalizeLocale, type Locale } from "../lib/i18n";
import { useSeo } from "../lib/seo";
import { EmptyState, ErrorState, LoadingState } from "../components/StateBlock";

const TOKEN_KEY = "models-dev-admin-token";
const ADMIN_LOCALE_KEY = "models-dev-admin-locale";

const adminCopy = {
  en: {
    title: "Admin Console",
    loginHelp: "Use the configured admin account.",
    username: "Username",
    password: "Password",
    signIn: "Sign in",
    signOut: "Sign out",
    hiddenNotice: "Not listed in public navigation or sitemap.",
    loading: "Loading admin console",
    requestFailed: "Admin request failed",
    pipeline: "Pipeline",
    refresh: "Refresh",
    fullRefresh: "Full",
    rollbackConfirm: "Rollback to",
    sourceHealth: "Source Health",
    quarantine: "Quarantine And Conflicts",
    noQuarantine: "No quarantine records or conflicts",
    manualOverride: "Manual Override",
    saveOverride: "Save override",
    delete: "Delete",
    deleteConfirm: "Delete override",
    usage: "Usage",
    apiCalls: "API calls",
    pageViews: "Page views",
    auditLogs: "Audit Logs",
  },
  zh: {
    title: "管理控制台",
    loginHelp: "使用环境变量配置的管理员账号登录。",
    username: "用户名",
    password: "密码",
    signIn: "登录",
    signOut: "退出登录",
    hiddenNotice: "不会出现在公开导航或 sitemap 中。",
    loading: "正在加载管理控制台",
    requestFailed: "后台请求失败",
    pipeline: "数据管线",
    refresh: "增量刷新",
    fullRefresh: "全量刷新",
    rollbackConfirm: "回滚到",
    sourceHealth: "数据源健康",
    quarantine: "隔离区与冲突",
    noQuarantine: "暂无隔离记录或冲突",
    manualOverride: "人工覆盖",
    saveOverride: "保存覆盖",
    delete: "删除",
    deleteConfirm: "删除覆盖",
    usage: "用量统计",
    apiCalls: "API 调用",
    pageViews: "页面访问",
    auditLogs: "审计日志",
  },
} satisfies Record<Locale, Record<string, string>>;

function readAdminLocale(): Locale {
  const stored = window.localStorage.getItem(ADMIN_LOCALE_KEY) ?? undefined;
  return normalizeLocale(stored ?? navigator.language);
}

function a(locale: Locale, key: keyof typeof adminCopy.en) {
  return adminCopy[locale][key];
}

interface PipelineRunsPayload {
  runs: Array<{
    id: string;
    actor: string;
    status: string;
    startedAt: string;
    endedAt?: string;
    force: boolean;
    contentHash?: string;
    error?: string;
  }>;
  versions: Array<{
    versionId: string;
    version?: string;
    contentHash?: string;
    fetchedAt?: string;
  }>;
}

interface QuarantinePayload {
  quarantine: Array<{ id: string; reason: string; issues: string[] }>;
  conflicts: Array<{
    modelId: string;
    field: string;
    source: string;
    note: string;
  }>;
}

interface UsagePayload {
  api: {
    total: number;
    byEndpoint: Record<string, number>;
    topSearchTerms: Record<string, number>;
    updatedAt: string;
  };
  pages: {
    pageViews: number;
    byPath: Record<string, number>;
    updatedAt: string;
  };
}

function Panel({
  title,
  children,
  action,
}: {
  title: string;
  children: ReactNode;
  action?: ReactNode;
}) {
  return (
    <section className="min-w-0 rounded-lg border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <div className="mb-4 flex items-center justify-between gap-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
          {title}
        </h2>
        {action}
      </div>
      {children}
    </section>
  );
}

function AdminLogin({
  locale,
  onLogin,
}: {
  locale: Locale;
  onLogin(token: string): void;
}) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const login = useMutation({
    mutationFn: () => adminLogin(username, password),
    onSuccess: (response) => {
      window.localStorage.setItem(TOKEN_KEY, response.data.token);
      onLogin(response.data.token);
    },
  });

  return (
    <div className="mx-auto mt-20 max-w-md rounded-lg border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <div className="mb-5 flex items-center gap-2">
        <span className="flex h-9 w-9 items-center justify-center rounded-md bg-slate-950 text-white dark:bg-white dark:text-slate-950">
          <Lock className="h-4 w-4" />
        </span>
        <div>
          <h1 className="text-lg font-semibold text-slate-950 dark:text-white">
            {a(locale, "title")}
          </h1>
          <p className="text-sm text-slate-500">{a(locale, "loginHelp")}</p>
        </div>
      </div>
      <form
        className="grid gap-3"
        onSubmit={(event) => {
          event.preventDefault();
          login.mutate();
        }}
      >
        <input
          value={username}
          onChange={(event) => setUsername(event.target.value)}
          placeholder={a(locale, "username")}
          className="h-11 rounded-md border border-slate-200 bg-white px-3 text-sm dark:border-slate-800 dark:bg-slate-950"
        />
        <input
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          placeholder={a(locale, "password")}
          type="password"
          className="h-11 rounded-md border border-slate-200 bg-white px-3 text-sm dark:border-slate-800 dark:bg-slate-950"
        />
        {login.isError ? (
          <p className="text-sm text-red-600">{login.error.message}</p>
        ) : null}
        <button
          type="submit"
          className="h-11 rounded-md bg-slate-950 px-4 text-sm font-semibold text-white disabled:opacity-50 dark:bg-white dark:text-slate-950"
          disabled={login.isPending}
        >
          {a(locale, "signIn")}
        </button>
      </form>
    </div>
  );
}

/** Admin console page for pipeline, data quality, overrides, audit, and usage.
 * 用于管线、数据质量、覆盖、审计与用量的后台管理页面。 */
export function AdminPage() {
  const location = useLocation();
  const queryClient = useQueryClient();
  const [token, setToken] = useState(
    () => window.localStorage.getItem(TOKEN_KEY) ?? "",
  );
  const [locale, setLocale] = useState<Locale>(readAdminLocale);
  const [modelId, setModelId] = useState("openai/gpt-4o");
  const [field, setField] = useState("description");
  const [value, setValue] = useState("");

  useEffect(() => {
    window.localStorage.setItem(ADMIN_LOCALE_KEY, locale);
  }, [locale]);

  useSeo({
    locale,
    title: `${a(locale, "title")} | Models.dev Explorer`,
    description:
      locale === "zh"
        ? "用于数据刷新、数据源健康、隔离区、人工覆盖、审计日志与用量统计的后台控制台。"
        : "Operational console for data refreshes, source health, quarantine, manual overrides, audit logs, and usage statistics.",
    path: location.pathname,
  });

  const authHeaders = token ? { authorization: `Bearer ${token}` } : {};
  const runsQuery = useQuery({
    queryKey: ["admin", "runs", token],
    queryFn: () =>
      adminRequest<PipelineRunsPayload>("/admin/pipeline/runs", token),
    enabled: Boolean(token),
  });
  const quarantineQuery = useQuery({
    queryKey: ["admin", "quarantine", token],
    queryFn: () => adminRequest<QuarantinePayload>("/admin/quarantine", token),
    enabled: Boolean(token),
  });
  const healthQuery = useQuery({
    queryKey: ["admin", "health", token],
    queryFn: () =>
      adminRequest<
        Record<
          string,
          { status: string; hash?: string; durationMs?: number; bytes?: number }
        >
      >("/admin/sources/health", token),
    enabled: Boolean(token),
  });
  const auditQuery = useQuery({
    queryKey: ["admin", "audit", token],
    queryFn: () =>
      adminRequest<
        Array<{
          id: string;
          actor: string;
          action: string;
          target?: string;
          at: string;
        }>
      >("/admin/audit-logs", token),
    enabled: Boolean(token),
  });
  const usageQuery = useQuery({
    queryKey: ["admin", "usage", token],
    queryFn: () => adminRequest<UsagePayload>("/admin/usage/stats", token),
    enabled: Boolean(token),
  });

  const refreshMutation = useMutation({
    mutationFn: (force: boolean) =>
      adminRequest("/admin/pipeline/refresh", token, {
        method: "POST",
        headers: authHeaders,
        body: JSON.stringify({ force }),
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["admin"] }),
  });
  const overrideMutation = useMutation({
    mutationFn: (event: FormEvent) => {
      event.preventDefault();
      return adminRequest(
        `/admin/models/${encodeURIComponent(modelId)}/overrides`,
        token,
        {
          method: "PUT",
          headers: authHeaders,
          body: JSON.stringify({ field, value }),
        },
      );
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["admin"] }),
  });

  if (!token) return <AdminLogin locale={locale} onLogin={setToken} />;
  if (runsQuery.isLoading || quarantineQuery.isLoading || healthQuery.isLoading)
    return <LoadingState label={a(locale, "loading")} />;
  if (runsQuery.isError)
    return (
      <ErrorState
        label={a(locale, "requestFailed")}
        message={runsQuery.error.message}
      />
    );

  return (
    <div className="grid gap-4">
      <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-xl font-semibold text-slate-950 dark:text-white">
              {a(locale, "title")}
            </h1>
            <p className="mt-1 text-sm text-slate-500">
              {a(locale, "hiddenNotice")}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <div className="inline-flex h-10 rounded-md border border-slate-200 p-0.5 dark:border-slate-800">
              {(["en", "zh"] as const).map((item) => (
                <button
                  key={item}
                  type="button"
                  className={`h-9 rounded-sm px-3 text-sm font-medium ${locale === item ? "bg-slate-900 text-white dark:bg-white dark:text-slate-950" : "text-slate-500 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"}`}
                  onClick={() => setLocale(item)}
                >
                  {item.toUpperCase()}
                </button>
              ))}
            </div>
            <button
              type="button"
              className="h-10 rounded-md border border-slate-200 px-3 text-sm font-medium dark:border-slate-800"
              onClick={() => {
                window.localStorage.removeItem(TOKEN_KEY);
                setToken("");
              }}
            >
              {a(locale, "signOut")}
            </button>
          </div>
        </div>
      </section>

      <div className="grid gap-4 xl:grid-cols-2">
        <Panel
          title={a(locale, "pipeline")}
          action={
            <div className="flex gap-2">
              <button
                type="button"
                className="inline-flex h-9 items-center gap-2 rounded-md border border-slate-200 px-3 text-sm dark:border-slate-800"
                onClick={() => refreshMutation.mutate(false)}
                disabled={refreshMutation.isPending}
              >
                <DatabaseZap className="h-4 w-4" />
                {a(locale, "refresh")}
              </button>
              <button
                type="button"
                className="inline-flex h-9 items-center gap-2 rounded-md bg-slate-950 px-3 text-sm text-white dark:bg-white dark:text-slate-950"
                onClick={() => refreshMutation.mutate(true)}
                disabled={refreshMutation.isPending}
              >
                {a(locale, "fullRefresh")}
              </button>
            </div>
          }
        >
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {(runsQuery.data?.data.runs ?? []).slice(0, 8).map((run) => (
                  <tr key={run.id}>
                    <td className="py-2 pr-3 font-mono text-xs">
                      {run.id.slice(0, 8)}
                    </td>
                    <td className="py-2 pr-3">{run.status}</td>
                    <td className="py-2 pr-3">{date(run.startedAt)}</td>
                    <td className="py-2 pr-3">{run.actor}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="mt-3 grid gap-2">
            {(runsQuery.data?.data.versions ?? [])
              .slice(0, 3)
              .map((version) => (
                <button
                  key={version.versionId}
                  type="button"
                  className="inline-flex items-center justify-between gap-3 rounded-md border border-slate-200 px-3 py-2 text-left text-sm dark:border-slate-800"
                  onClick={() => {
                    if (
                      window.confirm(
                        `${a(locale, "rollbackConfirm")} ${version.versionId}?`,
                      )
                    ) {
                      void adminRequest(
                        `/admin/pipeline/rollback/${encodeURIComponent(version.versionId)}`,
                        token,
                        { method: "POST", headers: authHeaders },
                      ).then(() =>
                        queryClient.invalidateQueries({ queryKey: ["admin"] }),
                      );
                    }
                  }}
                >
                  <span className="truncate">{version.versionId}</span>
                  <RotateCcw className="h-4 w-4" />
                </button>
              ))}
          </div>
        </Panel>

        <Panel title={a(locale, "sourceHealth")}>
          <div className="grid gap-2">
            {Object.entries(healthQuery.data?.data ?? {}).map(
              ([source, health]) => (
                <div
                  key={source}
                  className="rounded-md bg-slate-50 p-3 text-sm dark:bg-slate-950"
                >
                  <div className="flex justify-between gap-3">
                    <span className="font-semibold">{source}</span>
                    <span>{health.status}</span>
                  </div>
                  <p className="mt-1 truncate font-mono text-xs text-slate-500">
                    {health.hash}
                  </p>
                </div>
              ),
            )}
          </div>
        </Panel>
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <Panel title={a(locale, "quarantine")}>
          {!(
            quarantineQuery.data?.data.quarantine.length ||
            quarantineQuery.data?.data.conflicts.length
          ) ? (
            <EmptyState label={a(locale, "noQuarantine")} />
          ) : null}
          <div className="grid gap-2">
            {(quarantineQuery.data?.data.quarantine ?? [])
              .slice(0, 5)
              .map((record) => (
                <div
                  key={record.id}
                  className="rounded-md bg-red-50 p-3 text-sm text-red-900 dark:bg-red-950/40 dark:text-red-200"
                >
                  <div className="flex items-center gap-2 font-semibold">
                    <AlertTriangle className="h-4 w-4" />
                    {record.id}
                  </div>
                  <p className="mt-1">{record.reason}</p>
                </div>
              ))}
            {(quarantineQuery.data?.data.conflicts ?? [])
              .slice(0, 5)
              .map((conflict) => (
                <div
                  key={`${conflict.modelId}-${conflict.field}`}
                  className="rounded-md bg-amber-50 p-3 text-sm text-amber-900 dark:bg-amber-950/40 dark:text-amber-200"
                >
                  <p className="font-semibold">
                    {conflict.modelId} · {conflict.field}
                  </p>
                  <p className="mt-1">{conflict.note}</p>
                </div>
              ))}
          </div>
        </Panel>

        <Panel title={a(locale, "manualOverride")}>
          <form
            className="grid gap-3"
            onSubmit={(event) => overrideMutation.mutate(event)}
          >
            <input
              value={modelId}
              onChange={(event) => setModelId(event.target.value)}
              className="h-10 rounded-md border border-slate-200 bg-white px-3 text-sm dark:border-slate-800 dark:bg-slate-950"
            />
            <select
              value={field}
              onChange={(event) => setField(event.target.value)}
              className="h-10 rounded-md border border-slate-200 bg-white px-3 text-sm dark:border-slate-800 dark:bg-slate-950"
            >
              {[
                "description",
                "family",
                "license",
                "openWeights",
                "architecture",
                "capabilities.reasoning",
                "capabilities.toolCall",
              ].map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>
            <textarea
              value={value}
              onChange={(event) => setValue(event.target.value)}
              rows={4}
              className="rounded-md border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-800 dark:bg-slate-950"
            />
            <div className="flex gap-2">
              <button
                type="submit"
                className="inline-flex h-10 items-center gap-2 rounded-md bg-slate-950 px-3 text-sm font-semibold text-white dark:bg-white dark:text-slate-950"
              >
                <Save className="h-4 w-4" />
                {a(locale, "saveOverride")}
              </button>
              <button
                type="button"
                className="inline-flex h-10 items-center gap-2 rounded-md border border-red-200 px-3 text-sm font-semibold text-red-700 dark:border-red-900 dark:text-red-300"
                onClick={() => {
                  const message =
                    locale === "zh"
                      ? `${a(locale, "deleteConfirm")} ${modelId} 的 ${field}?`
                      : `${a(locale, "deleteConfirm")} ${field} for ${modelId}?`;
                  if (window.confirm(message)) {
                    void adminRequest(
                      `/admin/models/${encodeURIComponent(modelId)}/overrides/${encodeURIComponent(field)}`,
                      token,
                      { method: "DELETE", headers: authHeaders },
                    ).then(() =>
                      queryClient.invalidateQueries({ queryKey: ["admin"] }),
                    );
                  }
                }}
              >
                <Trash2 className="h-4 w-4" />
                {a(locale, "delete")}
              </button>
            </div>
            {overrideMutation.isError ? (
              <p className="text-sm text-red-600">
                {overrideMutation.error.message}
              </p>
            ) : null}
          </form>
        </Panel>
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <Panel title={a(locale, "usage")}>
          <div className="grid gap-2 text-sm">
            <div className="flex justify-between rounded-md bg-slate-50 p-3 dark:bg-slate-950">
              <span>{a(locale, "apiCalls")}</span>
              <span className="font-semibold">
                {usageQuery.data?.data.api.total ?? 0}
              </span>
            </div>
            <div className="flex justify-between rounded-md bg-slate-50 p-3 dark:bg-slate-950">
              <span>{a(locale, "pageViews")}</span>
              <span className="font-semibold">
                {usageQuery.data?.data.pages.pageViews ?? 0}
              </span>
            </div>
          </div>
        </Panel>

        <Panel title={a(locale, "auditLogs")}>
          <div className="grid max-h-80 gap-2 overflow-y-auto">
            {(auditQuery.data?.data ?? []).map((entry) => (
              <div
                key={entry.id}
                className="rounded-md bg-slate-50 p-3 text-sm dark:bg-slate-950"
              >
                <div className="flex justify-between gap-3">
                  <span className="font-semibold">{entry.action}</span>
                  <span className="text-xs text-slate-500">
                    {date(entry.at)}
                  </span>
                </div>
                <p className="mt-1 truncate text-xs text-slate-500">
                  {entry.actor} · {entry.target ?? "-"}
                </p>
              </div>
            ))}
          </div>
        </Panel>
      </div>
    </div>
  );
}
