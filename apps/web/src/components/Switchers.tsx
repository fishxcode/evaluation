/**
 * Theme + Language switchers (10.1). Language switch navigates to the
 * equivalent path under the other prefix, preserving context (SPA nav, no full
 * reload). Theme switch cycles Light/Dark/System, independent of language.
 * 主题 + 语言切换器。语言切换跳到另一前缀下的等价路径并保留上下文（SPA 导航，
 * 不整页刷新）；主题在 Light/Dark/System 循环，与语言独立。
 */
import { useNavigate, useRouterState } from '@tanstack/react-router';
import { useTheme, type ThemeMode } from '../lib/theme.js';
import { useLang, useT } from '../i18n/index.js';
import type { Lang } from '../i18n/translations.js';

export function ThemeSwitcher() {
  const { mode, setMode } = useTheme();
  const t = useT();
  const modes: ThemeMode[] = ['light', 'dark', 'system'];
  const labels: Record<ThemeMode, string> = {
    light: t('theme.light'), dark: t('theme.dark'), system: t('theme.system'),
  };
  return (
    <select
      value={mode}
      onChange={e => setMode(e.target.value as ThemeMode)}
      className="bg-surface border border-border rounded-md px-2 py-1 text-sm"
      aria-label="Theme"
    >
      {modes.map(m => <option key={m} value={m}>{labels[m]}</option>)}
    </select>
  );
}

export function LangSwitcher() {
  const lang = useLang();
  const navigate = useNavigate();
  const pathname = useRouterState({ select: s => s.location.pathname });
  const search = useRouterState({ select: s => s.location.searchStr });

  const switchTo = (target: Lang): void => {
    if (target === lang) return;
    // Replace the leading /en or /zh prefix, keep the rest + query (context).
    // 替换开头的 /en 或 /zh 前缀，保留其余路径 + 查询（上下文）。
    const rest = pathname.replace(/^\/(en|zh)/, '');
    void navigate({ to: `/${target}${rest || ''}${search}` as string });
  };

  return (
    <div className="flex items-center gap-1 text-sm">
      {(['en', 'zh'] as Lang[]).map(l => (
        <button
          key={l}
          onClick={() => switchTo(l)}
          className={`px-2 py-1 rounded-md ${l === lang ? 'bg-accent text-white' : 'hover:bg-surface'}`}
        >
          {l === 'en' ? 'EN' : '中'}
        </button>
      ))}
    </div>
  );
}
