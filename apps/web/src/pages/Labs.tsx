/**
 * Labs page (12) — grid of labs; click filters Explorer by lab.
 * 实验室页——Lab 网格；点击按 lab 过滤 Explorer。
 */
import { useQuery } from '@tanstack/react-query';
import { Link } from '@tanstack/react-router';
import { api } from '../lib/api.js';
import { useT, useLang } from '../i18n/index.js';
import { SkeletonGrid, EmptyState, ErrorState } from '../components/States.js';

export function LabsPage() {
  const t = useT();
  const lang = useLang();
  const { data, isLoading, error, refetch } = useQuery({ queryKey: ['labs'], queryFn: () => api.labs({ pageSize: 100 }) });

  if (isLoading) return <SkeletonGrid />;
  if (error) return <ErrorState error={error} onRetry={refetch} />;
  if (!data?.data.length) return <EmptyState />;

  return (
    <div>
      <h1 className="text-lg font-semibold mb-4">{t('labs.title')}</h1>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {data.data.map(lab => (
          <Link
            key={lab.id}
            to={`/${lang}/models`}
            search={{ lab: lab.id } as never}
            className="border border-border rounded-lg bg-surface p-4 hover:border-accent transition-colors"
          >
            <h3 className="font-medium mb-1">{lab.name}</h3>
            {lab.description && <p className="text-sm text-muted line-clamp-2 mb-2">{lab.description}</p>}
            <span className="text-xs text-muted">{lab.modelCount} {t('labs.models')}</span>
          </Link>
        ))}
      </div>
    </div>
  );
}
