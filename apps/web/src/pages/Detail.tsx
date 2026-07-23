/**
 * Model Detail (10.3) — Overview, Pricing (multi-provider), Capabilities,
 * Benchmarks, Weights, Providers, Raw JSON. Missing fields show "—".
 * 模型详情——概览、价格（多 provider）、能力、基准、权重、providers、原始 JSON。
 * 缺失字段显示 "—"。
 */
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useParams } from '@tanstack/react-router';
import { api } from '../lib/api.js';
import { useT, useLang } from '../i18n/index.js';
import { SkeletonGrid, ErrorState } from '../components/States.js';
import { useCompare } from '../lib/compare.js';
import { useMeta } from '../lib/meta.js';

const dash = '—';
const v = <T,>(x: T | undefined | null): T | string => (x === undefined || x === null || x === '' ? dash : x);

export function DetailPage() {
  const t = useT();
  const lang = useLang();
  const { lab, slug } = useParams({ from: `/${lang}/models/$lab/$slug` as never }) as { lab: string; slug: string };
  const id = `${lab}/${slug}`;
  const { has, toggle } = useCompare();

  const { data: model, isLoading, error, refetch } = useQuery({
    queryKey: ['model', id],
    queryFn: () => api.model(id),
  });

  useMeta({
    title: model ? `${model.name} — ${model.lab.name}` : id,
    description: model?.description,
    type: 'article',
  });

  const [showRaw, setShowRaw] = useState(false);

  if (isLoading) return <SkeletonGrid count={6} />;
  if (error || !model) return <ErrorState error={error} onRetry={refetch} />;

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <header className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <div className="text-sm text-muted mb-1">{model.lab.name}</div>
          <h1 className="text-2xl font-semibold">{model.name}</h1>
          {model.description && <p className="text-muted mt-2 max-w-2xl">{model.description}</p>}
        </div>
        <button
          onClick={() => { const r = toggle(model.id); if (!r.ok) alert(t('compare.max')); }}
          className={`px-3 py-1.5 rounded-md text-sm border ${has(model.id) ? 'bg-accent text-white border-accent' : 'border-border hover:bg-surface'}`}
        >
          {t('detail.addCompare')}
        </button>
      </header>

      {/* Overview grid / 概览网格 */}
      <section className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Stat label={t('detail.context')} value={model.limit?.context ? `${(model.limit.context / 1000).toFixed(0)}k` : dash} />
        <Stat label={t('detail.releaseDate')} value={v(model.releaseDate)} />
        <Stat label={t('detail.knowledge')} value={v(model.knowledge)} />
        <Stat label={t('detail.license')} value={v(model.license)} />
      </section>

      {/* Capabilities / 能力 */}
      <Section title={t('detail.capabilities')}>
        <div className="flex flex-wrap gap-2">
          {model.capabilities.length ? model.capabilities.map(c => (
            <span key={c} className="px-2 py-1 rounded bg-border/50 text-sm">{c}</span>
          )) : dash}
        </div>
      </Section>

      {/* Pricing table (multi-provider) / 价格表 */}
      <Section title={`${t('detail.pricing')} (${model.offerings.length} ${t('detail.providers')})`}>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr className="text-left text-muted border-b border-border">
              <th className="py-2 pr-4">{t('detail.providers')}</th>
              <th className="py-2 pr-4">{t('pricing.input')}</th>
              <th className="py-2 pr-4">{t('pricing.output')}</th>
              <th className="py-2">{t('pricing.cacheRead')}</th>
            </tr></thead>
            <tbody>
              {model.offerings.map((o, i) => (
                <tr key={i} className="border-b border-border/50">
                  <td className="py-2 pr-4">{o.providerName}</td>
                  <td className="py-2 pr-4">{o.pricing?.input != null ? `$${o.pricing.input}` : dash}</td>
                  <td className="py-2 pr-4">{o.pricing?.output != null ? `$${o.pricing.output}` : dash}</td>
                  <td className="py-2">{o.pricing?.cacheRead != null ? `$${o.pricing.cacheRead}` : dash}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Section>

      {/* Benchmarks / 基准 */}
      <Section title={t('detail.benchmarks')}>
        {model.benchmarks.length ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {model.benchmarks.map((b, i) => (
              <div key={i} className="border border-border rounded-md p-3">
                <div className="text-xs text-muted">{b.name}{b.metric ? ` · ${b.metric}` : ''}</div>
                <div className="text-lg font-medium">{b.score}</div>
              </div>
            ))}
          </div>
        ) : dash}
      </Section>

      {/* Weights / 权重 */}
      {model.weights?.length ? (
        <Section title={t('detail.weights')}>
          <div className="flex flex-wrap gap-2">
            {model.weights.map((w, i) => (
              <a key={i} href={w.url} target="_blank" rel="noreferrer" className="px-3 py-1.5 rounded-md border border-border text-sm text-accent hover:bg-surface">{w.label} ↗</a>
            ))}
          </div>
        </Section>
      ) : null}

      {/* Raw JSON / 原始 JSON */}
      <Section title={t('detail.rawJson')}>
        <button onClick={() => setShowRaw(!showRaw)} className="text-sm text-accent">{showRaw ? '−' : '+'} JSON</button>
        {showRaw && <pre className="mt-2 p-3 bg-surface border border-border rounded-md overflow-x-auto text-xs">{JSON.stringify(model, null, 2)}</pre>}
      </Section>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="border border-border rounded-md p-3 bg-surface">
      <div className="text-xs text-muted">{label}</div>
      <div className="font-medium">{value}</div>
    </div>
  );
}
function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h2 className="font-medium mb-3">{title}</h2>
      {children}
    </section>
  );
}
