/**
 * Theme provider — Light/Dark/System with localStorage persistence (10.1).
 * Manual choice persists and is NOT overridden by system changes. System mode
 * follows prefers-color-scheme live.
 * 主题 Provider——Light/Dark/System，localStorage 持久化。手动选择持久且不被系统
 * 变化覆盖；System 模式实时跟随 prefers-color-scheme。
 */
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';

export type ThemeMode = 'light' | 'dark' | 'system';
interface ThemeCtx {
  mode: ThemeMode;
  setMode: (m: ThemeMode) => void;
}
const Ctx = createContext<ThemeCtx>({ mode: 'system', setMode: () => {} });

function apply(mode: ThemeMode): void {
  const systemDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
  const dark = mode === 'dark' || (mode === 'system' && systemDark);
  document.documentElement.classList.toggle('dark', dark);
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [mode, setModeState] = useState<ThemeMode>(() => {
    const stored = localStorage.getItem('theme');
    return stored === 'light' || stored === 'dark' ? stored : 'system';
  });

  const setMode = (m: ThemeMode): void => {
    setModeState(m);
    if (m === 'system') localStorage.removeItem('theme');
    else localStorage.setItem('theme', m);
    apply(m);
  };

  useEffect(() => {
    apply(mode);
    // Only react to system changes when in 'system' mode / 仅 system 模式下响应系统变化
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const handler = (): void => { if (mode === 'system') apply('system'); };
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, [mode]);

  return <Ctx.Provider value={{ mode, setMode }}>{children}</Ctx.Provider>;
}

export function useTheme(): ThemeCtx {
  return useContext(Ctx);
}
