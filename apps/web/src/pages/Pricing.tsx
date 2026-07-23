/**
 * Pricing Compare (10.4) — flattened offering rows across providers. Search,
 * sortable, CSV export. Uses simple pagination (dataset is large: 5751 rows).
 * 价格对比——跨 provider 展平的 offering 行。搜索、可排序、CSV 导出。
 * 数据量大（5751 行）故用分页。
 */
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api, type PricingRow } from '../lib/api.js';
import { useT } from '../i18n/index.js';
import { SkeletonGrid, EmptyState, ErrorState } from '../components/States.js';

const dash = '—';

export function PricingPage() {
  const t = useT();
  const [page, setPage] = useState(1);
  const [q, setQ] = useState('');
  const pageSize = 50;

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['pricing', page],
    queryFn: () => api.pricing({ page, pageSize }),
  });

  const rows = (data?.data ?? []).filter(r =>
    !q || r.modelName.toLowerCase().includes(q.toLowerCase()) || r.providerName.toLowerCase().includes(q.toLowerCase()),
  );

  const exportCsv = (): void => {
    const header = 'Model,Lab,Provider,Input,Output,CacheRead,Reasoning\n';
    const body = rows.map(r => [r.modelName, r.lab, r.providerName, r.input ?? '', r.output ?? '', r.cacheRead ?? '', r.reasoning ?? ''].join(',')).join('\n');
    const blob = new Blob([header + body], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = 'pricing.csv'; a.click();
    URL.revokeObjectURL(url);
  };

  const price = (n?: number): string => (n != null ? `$${n}` : dash);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h1 className="text-lg font-semibold">{t('pricing.title')}</h1>
        <div className="flex items-center gap-2">
          <input type="search" placeholder={t('common.search')} value={q} onChange={e => setQ(e.target.value)} className="bg-surface border border-border rounded-md px-3 py-1.5 text-sm" />
          <button onClick={exportCsv} className="px-3 py-1.5 rounded-md bg-accent text-white text-sm">{t('pricing.exportCsv')}</button>
        </div>
      </div>

      {isLoading ? <SkeletonGrid count={6} /> :
        error ? <ErrorState error={error} onRetry={refetch} /> :
        !rows.length ? <EmptyState /> :
        <>
          <div className="overflow-x-auto border border-border rounded-lg">
            <table className="w-full text-sm">
              <thead className="bg-surface sticky top-14">
                <tr className="text-left text-muted border-b border-border">
                  <th className="py-2 px-3">Model</th>
                  <th className="py-2 px-3">Provider</th>
                  <th className="py-2 px-3">{t('pricing.input')}</th>
                  <th className="py-2 px-3">{t('pricing.output')}</th>
                  <th className="py-2 px-3">{t('pricing.cacheRead')}</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r: PricingRow, i) => (
                  <tr key={i} className="border-b border-border/40 hover:bg-surface/50">
                    <td className="py-2 px-3">{r.modelName} <span className="text-muted text-xs">{r.lab}</span></td>
                    <td className="py-2 px-3">{r.providerName}</td>
                    <td className="py-2 px-3">{price(r.input)}</td>
                    <td className="py-2 px-3">{price(r.output)}</td>
                    <td className="py-2 px-3">{price(r.cacheRead)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="flex items-center justify-center gap-2 text-sm">
            <button disabled={page <= 1} onClick={() => setPage(page - 1)} className="px-3 py-1 rounded-md border border-border disabled:opacity-40">←</button>
            <span className="text-muted">{page} / {data?.meta.totalPages ?? 1}</span>
            <button disabled={page >= (data?.meta.totalPages ?? 1)} onClick={() => setPage(page + 1)} className="px-3 py-1 rounded-md border border-border disabled:opacity-40">→</button>
          </div>
        </>
      }
    </div>
  );
}
