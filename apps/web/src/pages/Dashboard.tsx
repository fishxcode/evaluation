/**
 * Dashboard (12) — headline stats + latest models + data version.
 * 仪表盘——概要统计 + 最新模型 + 数据版本。
 */
import { useQuery } from '@tanstack/react-query';
import { Link } from '@tanstack/react-router';
import { api } from '../lib/api.js';
import { useT, useLang } from '../i18n/index.js';
import { SkeletonGrid, ErrorState } from '../components/States.js';

export function DashboardPage() {
  const t = useT();
  const lang = useLang();
  const { data, isLoading, error, refetch } = useQuery({ queryKey: ['stats'], queryFn: () => api.stats() });

  if (isLoading) return <SkeletonGrid count={4} />;
  if (error || !data) return <ErrorState error={error} onRetry={refetch} />;

  const stats = [
    { label: t('dashboard.models'), value: data.modelCount },
    { label: t('dashboard.labs'), value: data.labCount },
    { label: t('dashboard.providers'), value: data.providerCount },
    { label: t('dashboard.avgPrice'), value: `$${data.avgInputPrice}` },
  ];

  return (
    <div className="space-y-6">
      <h1 className="text-lg font-semibold">{t('dashboard.title')}</h1>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map(s => (
          <div key={s.label} className="border border-border rounded-lg bg-surface p-4">
            <div className="text-xs text-muted">{s.label}</div>
            <div className="text-2xl font-semibold mt-1">{s.value}</div>
          </div>
        ))}
      </div>

      <section>
        <h2 className="font-medium mb-3">{t('dashboard.latest')}</h2>
        <div className="space-y-2">
          {data.latestModels.map(m => {
            const [lab, ...rest] = m.id.split('/');
            return (
              <Link key={m.id} to={`/${lang}/models/$lab/$slug`} params={{ lab: lab!, slug: rest.join('/') }} className="flex justify-between border border-border rounded-md bg-surface px-4 py-2 hover:border-accent">
                <span>{m.name}</span>
                <span className="text-sm text-muted">{m.releaseDate ?? '—'}</span>
              </Link>
            );
          })}
        </div>
      </section>

      <p className="text-xs text-muted">{t('dashboard.updated')}: {data.lastUpdated ?? '—'} · v{data.dataVersion ?? '—'}</p>
    </div>
  );
}
