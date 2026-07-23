/**
 * Benchmark Compare (12) — compares 2–6 models via URL ?compare=a,b. Table of
 * benchmark scores; missing benchmark shows "未测/not tested" (not 0).
 * 基准对比——经 URL ?compare=a,b 对比 2–6 模型。基准分表格；缺测显示"未测"（非 0）。
 */
import { useQueries } from '@tanstack/react-query';
import { useSearch } from '@tanstack/react-router';
import { api } from '../lib/api.js';
import { useT, useLang } from '../i18n/index.js';
import { EmptyState } from '../components/States.js';

export function ComparePage() {
  const t = useT();
  const lang = useLang();
  const search = useSearch({ from: `/${lang}/compare` as never }) as { compare?: string };
  const ids = (search.compare ?? '').split(',').filter(Boolean);

  const results = useQueries({
    queries: ids.map(id => ({ queryKey: ['model', id], queryFn: () => api.model(id) })),
  });

  const models = results.map(r => r.data).filter((m): m is NonNullable<typeof m> => !!m);
  if (ids.length < 2) return <EmptyState message={t('compare.empty')} />;

  // Union of all benchmark names across selected models / 所有模型基准名并集
  const benchNames = [...new Set(models.flatMap(m => m.benchmarks.map(b => b.name)))];
  const notTested = lang === 'zh' ? '未测' : 'n/t';

  return (
    <div className="space-y-4">
      <h1 className="text-lg font-semibold">{t('compare.title')}</h1>
      <div className="overflow-x-auto border border-border rounded-lg">
        <table className="w-full text-sm">
          <thead className="bg-surface">
            <tr className="text-left border-b border-border">
              <th className="py-2 px-3">Benchmark</th>
              {models.map(m => <th key={m.id} className="py-2 px-3">{m.name}</th>)}
            </tr>
          </thead>
          <tbody>
            <tr className="border-b border-border/40">
              <td className="py-2 px-3 text-muted">{t('detail.context')}</td>
              {models.map(m => <td key={m.id} className="py-2 px-3">{m.limit?.context ? `${(m.limit.context / 1000).toFixed(0)}k` : '—'}</td>)}
            </tr>
            <tr className="border-b border-border/40">
              <td className="py-2 px-3 text-muted">{t('pricing.input')}</td>
              {models.map(m => {
                const ps = m.offerings.map(o => o.pricing?.input).filter((p): p is number => p != null);
                return <td key={m.id} className="py-2 px-3">{ps.length ? `$${Math.min(...ps)}` : '—'}</td>;
              })}
            </tr>
            {benchNames.map(bn => (
              <tr key={bn} className="border-b border-border/40">
                <td className="py-2 px-3 text-muted">{bn}</td>
                {models.map(m => {
                  const b = m.benchmarks.find(x => x.name === bn);
                  return <td key={m.id} className="py-2 px-3">{b ? b.score : <span className="text-muted italic">{notTested}</span>}</td>;
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
