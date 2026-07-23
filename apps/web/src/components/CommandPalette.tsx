/**
 * ⌘K Command Palette (12) — global fuzzy model search, keyboard-operable.
 * Cmd/Ctrl+K opens; arrows navigate; Enter selects; Esc closes.
 * ⌘K 全局命令面板——模糊搜索模型，可全键盘操作。
 */
import { useEffect, useRef, useState } from 'react';
import { useNavigate } from '@tanstack/react-router';
import { useQuery } from '@tanstack/react-query';
import { api } from '../lib/api.js';
import { useLang, useT } from '../i18n/index.js';

export function CommandPalette() {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const [sel, setSel] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();
  const lang = useLang();
  const t = useT();

  // Global ⌘K / Ctrl+K toggle / 全局快捷键
  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setOpen(o => !o);
      }
      if (e.key === 'Escape') setOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 50);
    else { setQ(''); setSel(0); }
  }, [open]);

  const { data } = useQuery({
    queryKey: ['cmdk', q],
    queryFn: () => api.models({ q, pageSize: 8 }),
    enabled: open && q.length > 0,
  });
  const results = data?.data ?? [];

  const go = (idx: number): void => {
    const m = results[idx];
    if (!m) return;
    setOpen(false);
    void navigate({ to: `/${lang}/models/$lab/$slug`, params: { lab: m.lab.id, slug: m.slug } });
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-[15vh] bg-black/40" onClick={() => setOpen(false)}>
      <div className="w-full max-w-lg bg-surface border border-border rounded-lg shadow-xl overflow-hidden" onClick={e => e.stopPropagation()}>
        <input
          ref={inputRef}
          value={q}
          onChange={e => { setQ(e.target.value); setSel(0); }}
          onKeyDown={e => {
            if (e.key === 'ArrowDown') { e.preventDefault(); setSel(s => Math.min(s + 1, results.length - 1)); }
            if (e.key === 'ArrowUp') { e.preventDefault(); setSel(s => Math.max(s - 1, 0)); }
            if (e.key === 'Enter') { e.preventDefault(); go(sel); }
          }}
          placeholder={t('common.search')}
          className="w-full px-4 py-3 bg-transparent outline-none text-fg border-b border-border"
        />
        <ul className="max-h-80 overflow-y-auto">
          {results.map((m, i) => (
            <li key={m.id}>
              <button
                onMouseEnter={() => setSel(i)}
                onClick={() => go(i)}
                className={`w-full text-left px-4 py-2 flex justify-between items-center ${i === sel ? 'bg-accent/10' : ''}`}
              >
                <span className="text-fg">{m.name}</span>
                <span className="text-xs text-muted">{m.lab.name}</span>
              </button>
            </li>
          ))}
          {q && !results.length && <li className="px-4 py-3 text-sm text-muted">{t('common.empty')}</li>}
        </ul>
        <div className="px-4 py-2 text-[10px] text-muted border-t border-border flex gap-3">
          <span>↑↓ navigate</span><span>↵ open</span><span>esc close</span>
        </div>
      </div>
    </div>
  );
}
