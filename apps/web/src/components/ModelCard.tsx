/**
 * ModelCard + CompareBar — shared model display with a compare checkbox.
 * ModelCard + CompareBar——带对比勾选框的模型展示。
 */
import { Link } from '@tanstack/react-router';
import type { Model } from '@models-dev/shared';
import { useLang, useT } from '../i18n/index.js';
import { useCompare } from '../lib/compare.js';

const dash = '—';

/** Minimum input price across offerings / 各 offering 最低输入价 */
function minPrice(m: Model): string {
  const ps = m.offerings.map(o => o.pricing?.input).filter((p): p is number => typeof p === 'number');
  return ps.length ? `$${Math.min(...ps)}` : dash;
}

export function ModelCard({ model }: { model: Model }) {
  const lang = useLang();
  const { has, toggle } = useCompare();
  const selected = has(model.id);

  return (
    <div className="relative group border border-border rounded-lg bg-surface p-4 hover:border-accent transition-colors">
      <label className="absolute top-3 right-3 opacity-0 group-hover:opacity-100 has-[:checked]:opacity-100 transition-opacity">
        <input
          type="checkbox"
          checked={selected}
          onChange={() => { const r = toggle(model.id); if (!r.ok) alert('Max 6 models / 最多 6 个'); }}
          className="w-4 h-4 accent-[rgb(var(--accent))]"
          aria-label="Add to compare"
        />
      </label>
      <Link to={`/${lang}/models/$lab/$slug`} params={{ lab: model.lab.id, slug: model.slug }} className="block">
        <div className="flex items-center gap-2 mb-1">
          <span className="text-xs text-muted">{model.lab.name}</span>
          {model.openWeights && <span className="text-[10px] px-1.5 py-0.5 rounded bg-accent/10 text-accent">open</span>}
        </div>
        <h3 className="font-medium text-fg mb-2 pr-6">{model.name}</h3>
        <div className="flex flex-wrap gap-1 mb-2">
          {model.capabilities.slice(0, 4).map(c => (
            <span key={c} className="text-[10px] px-1.5 py-0.5 rounded bg-border/50 text-muted">{c}</span>
          ))}
        </div>
        <div className="flex justify-between text-xs text-muted">
          <span>ctx {model.limit?.context ? (model.limit.context / 1000).toFixed(0) + 'k' : dash}</span>
          <span>{minPrice(model)}</span>
        </div>
      </Link>
    </div>
  );
}

/** Floating compare bar (10.2) / 底部浮动对比栏 */
export function CompareBar() {
  const { ids, clear, max } = useCompare();
  const lang = useLang();
  const t = useT();
  if (ids.length === 0) return null;
  return (
    <div className="fixed bottom-0 inset-x-0 z-30 border-t border-border bg-surface/95 backdrop-blur px-4 py-3">
      <div className="max-w-7xl mx-auto flex items-center justify-between gap-4">
        <span className="text-sm text-muted">
          {ids.length}/{max} {t('compare.selected')}
        </span>
        <div className="flex items-center gap-2">
          <button onClick={clear} className="px-3 py-1.5 text-sm text-muted hover:text-fg">{t('compare.clear')}</button>
          <Link
            to={`/${lang}/compare`}
            search={{ compare: ids.join(',') }}
            className={`px-4 py-1.5 rounded-md text-sm text-white ${ids.length >= 2 ? 'bg-accent hover:opacity-90' : 'bg-muted cursor-not-allowed pointer-events-none'}`}
          >
            {t('compare.go')}
          </Link>
        </div>
      </div>
    </div>
  );
}
