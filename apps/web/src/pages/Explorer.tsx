/**
 * Model Explorer (10.2) — left Filters + right results. Filters/sort/page sync
 * to URL query (shareable). Grid view. Multi-select compare via ModelCard.
 * 模型浏览——左筛选 + 右结果。筛选/排序/分页同步 URL（可分享）。网格视图。
 */
import { useQuery } from '@tanstack/react-query';
import { useNavigate, useSearch } from '@tanstack/react-router';
import { api } from '../lib/api.js';
import { useT, useLang } from '../i18n/index.js';
import { SkeletonGrid, EmptyState, ErrorState } from '../components/States.js';
import { ModelCard } from '../components/ModelCard.js';

export interface ExplorerSearch {
  page?: number;
  pageSize?: number;
  q?: string;
  lab?: string;
  provider?: string;
  capability?: string;
  openWeights?: boolean;
  sort?: string;
  order?: string;
}

export function ExplorerPage() {
  const t = useT();
  const lang = useLang();
  const search = useSearch({ from: `/${lang}/models` as never }) as ExplorerSearch;
  const navigate = useNavigate();

  const page = search.page ?? 1;
  const pageSize = search.pageSize ?? 20;

  const update = (patch: Partial<ExplorerSearch>): void => {
    // Reset to page 1 when filters/sort change (10.6) / 筛选或排序变化重置到第一页
    const resetPage = 'q' in patch || 'lab' in patch || 'capability' in patch || 'openWeights' in patch || 'sort' in patch || 'order' in patch;
    void navigate({
      to: `/${lang}/models`,
      search: { ...search, ...patch, ...(resetPage ? { page: 1 } : {}) } as never,
    });
  };

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['models', search],
    queryFn: () => api.models({ ...search, page, pageSize }),
  });
  const { data: facets } = useQuery({ queryKey: ['filters'], queryFn: () => api.filters() });

  return (
    <div className="flex flex-col lg:flex-row gap-6">
      {/* Filters sidebar / 筛选侧栏 */}
      <aside className="lg:w-56 shrink-0 space-y-4">
        <h2 className="font-medium text-sm">{t('explorer.filters')}</h2>
        <input
          type="search"
          placeholder={t('common.search')}
          defaultValue={search.q ?? ''}
          onChange={e => update({ q: e.target.value || undefined })}
          className="w-full bg-surface border border-border rounded-md px-3 py-1.5 text-sm"
        />
        <FilterSelect label={t('filter.lab')} value={search.lab} options={facets?.labs.map(l => ({ value: l.id, label: `${l.name} (${l.count})` })) ?? []} onChange={v => update({ lab: v })} allLabel={t('common.all')} />
        <FilterSelect label={t('filter.capability')} value={search.capability} options={facets?.capabilities.map(c => ({ value: c.value, label: `${c.value} (${c.count})` })) ?? []} onChange={v => update({ capability: v })} allLabel={t('common.all')} />
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={search.openWeights ?? false} onChange={e => update({ openWeights: e.target.checked || undefined })} className="accent-[rgb(var(--accent))]" />
          {t('filter.openWeights')}
        </label>
      </aside>

      {/* Results / 结果 */}
      <section className="flex-1 min-w-0">
        <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
          <h1 className="text-lg font-semibold">{t('explorer.title')}</h1>
          <div className="flex items-center gap-2 text-sm">
            <span className="text-muted">{data?.meta.total ?? 0} {t('explorer.results')}</span>
            <select value={search.sort ?? ''} onChange={e => update({ sort: e.target.value || undefined })} className="bg-surface border border-border rounded-md px-2 py-1">
              <option value="">{t('explorer.sort')}</option>
              <option value="name">{t('sort.name')}</option>
              <option value="releaseDate">{t('sort.releaseDate')}</option>
              <option value="price">{t('sort.price')}</option>
              <option value="context">{t('sort.context')}</option>
              <option value="benchmark">{t('sort.benchmark')}</option>
            </select>
            <select value={search.order ?? 'asc'} onChange={e => update({ order: e.target.value })} className="bg-surface border border-border rounded-md px-2 py-1">
              <option value="asc">↑</option>
              <option value="desc">↓</option>
            </select>
          </div>
        </div>

        {isLoading ? <SkeletonGrid /> :
          error ? <ErrorState error={error} onRetry={refetch} /> :
          !data?.data.length ? <EmptyState /> :
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 pb-4">
              {data.data.map(m => <ModelCard key={m.id} model={m} />)}
            </div>
            <Pagination page={page} pageSize={pageSize} total={data.meta.total} totalPages={data.meta.totalPages} onPage={p => update({ page: p })} onPageSize={ps => update({ pageSize: ps, page: 1 })} />
          </>
        }
      </section>
    </div>
  );
}

function FilterSelect({ label, value, options, onChange, allLabel }: {
  label: string; value?: string; options: { value: string; label: string }[]; onChange: (v: string | undefined) => void; allLabel: string;
}) {
  return (
    <div>
      <label className="block text-xs text-muted mb-1">{label}</label>
      <select value={value ?? ''} onChange={e => onChange(e.target.value || undefined)} className="w-full bg-surface border border-border rounded-md px-2 py-1.5 text-sm">
        <option value="">{allLabel}</option>
        {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    </div>
  );
}

function Pagination({ page, pageSize, total, totalPages, onPage, onPageSize }: {
  page: number; pageSize: number; total: number; totalPages: number; onPage: (p: number) => void; onPageSize: (ps: number) => void;
}) {
  return (
    <div className="flex items-center justify-between flex-wrap gap-2 pb-20">
      <select value={pageSize} onChange={e => onPageSize(Number(e.target.value))} className="bg-surface border border-border rounded-md px-2 py-1 text-sm">
        {[20, 50, 100].map(s => <option key={s} value={s}>{s} / page</option>)}
      </select>
      <div className="flex items-center gap-2 text-sm">
        <button disabled={page <= 1} onClick={() => onPage(page - 1)} className="px-3 py-1 rounded-md border border-border disabled:opacity-40">←</button>
        <span className="text-muted">{page} / {totalPages}</span>
        <button disabled={page >= totalPages} onClick={() => onPage(page + 1)} className="px-3 py-1 rounded-md border border-border disabled:opacity-40">→</button>
      </div>
      <span className="text-xs text-muted">{total} total</span>
    </div>
  );
}
