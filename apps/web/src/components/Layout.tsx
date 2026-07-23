/**
 * App shell — top nav with links, theme + language switchers, API Docs entry,
 * and a footer with the page-view counter. Mobile: nav collapses to a drawer.
 * 应用外壳——顶部导航、主题+语言切换、API Docs 入口，页脚含访问计数。
 * 移动端：导航折叠为抽屉。
 */
import { useState, type ReactNode } from 'react';
import { Link } from '@tanstack/react-router';
import { useT, useLang } from '../i18n/index.js';
import { ThemeSwitcher, LangSwitcher } from './Switchers.js';

const API_DOCS_URL = (import.meta.env.VITE_API_BASE ?? '') + '/api/docs';

export function Layout({ children }: { children: ReactNode }) {
  const t = useT();
  const lang = useLang();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const base = `/${lang}`;

  const navLinks = [
    { to: `${base}/models`, label: t('nav.explorer') },
    { to: `${base}/pricing`, label: t('nav.pricing') },
    { to: `${base}/labs`, label: t('nav.labs') },
    { to: `${base}/compare`, label: t('nav.compare') },
    { to: `${base}/dashboard`, label: t('nav.dashboard') },
  ];

  return (
    <div className="min-h-full flex flex-col">
      <header className="sticky top-0 z-20 border-b border-border bg-bg/80 backdrop-blur">
        <div className="max-w-7xl mx-auto px-4 h-14 flex items-center justify-between gap-4">
          <div className="flex items-center gap-6">
            <Link to={`${base}/models`} className="font-semibold text-fg whitespace-nowrap">
              models.dev
            </Link>
            <nav className="hidden md:flex items-center gap-1">
              {navLinks.map(l => (
                <Link
                  key={l.to}
                  to={l.to}
                  className="px-3 py-1.5 rounded-md text-sm text-muted hover:text-fg hover:bg-surface"
                  activeProps={{ className: 'px-3 py-1.5 rounded-md text-sm text-fg bg-surface' }}
                >
                  {l.label}
                </Link>
              ))}
              <a href={API_DOCS_URL} target="_blank" rel="noreferrer" className="px-3 py-1.5 rounded-md text-sm text-muted hover:text-fg hover:bg-surface">
                {t('nav.apiDocs')} ↗
              </a>
            </nav>
          </div>
          <div className="flex items-center gap-2">
            <LangSwitcher />
            <ThemeSwitcher />
            <button className="md:hidden p-2" onClick={() => setDrawerOpen(!drawerOpen)} aria-label="Menu">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 12h18M3 6h18M3 18h18" /></svg>
            </button>
          </div>
        </div>
        {/* Mobile drawer / 移动端抽屉 */}
        {drawerOpen && (
          <nav className="md:hidden border-t border-border bg-surface px-4 py-2 flex flex-col">
            {navLinks.map(l => (
              <Link key={l.to} to={l.to} onClick={() => setDrawerOpen(false)} className="py-2 text-sm text-fg">
                {l.label}
              </Link>
            ))}
            <a href={API_DOCS_URL} target="_blank" rel="noreferrer" className="py-2 text-sm text-fg">{t('nav.apiDocs')} ↗</a>
          </nav>
        )}
      </header>

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 py-6">{children}</main>

      <Footer />
    </div>
  );
}

function Footer() {
  return (
    <footer className="border-t border-border py-6 text-center text-xs text-muted">
      <p>models.dev Explorer · Data from models.dev</p>
    </footer>
  );
}
