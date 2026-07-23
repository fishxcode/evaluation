/**
 * i18n context + hook. Language is derived from the URL prefix (/en|/zh),
 * passed down via context. useT() returns a translate function.
 * i18n 上下文 + hook。语言由 URL 前缀（/en|/zh）派生，经上下文下传。
 * useT() 返回翻译函数。
 */
import { createContext, useContext, type ReactNode } from 'react';
import { translations, type Lang, type TranslationKey } from './translations.js';

const LangContext = createContext<Lang>('en');

export function LangProvider({ lang, children }: { lang: Lang; children: ReactNode }) {
  return <LangContext.Provider value={lang}>{children}</LangContext.Provider>;
}

export function useLang(): Lang {
  return useContext(LangContext);
}

/** Returns a translate function bound to the current language / 返回绑定当前语言的翻译函数 */
export function useT(): (key: TranslationKey) => string {
  const lang = useLang();
  return (key: TranslationKey) => translations[lang][key] ?? key;
}

/**
 * Detect preferred language from the browser (Accept-Language proxy on client).
 * Chinese system → zh, otherwise en (10.1).
 * 从浏览器探测首选语言。中文系统→zh，否则 en。
 */
export function detectLang(): Lang {
  if (typeof navigator !== 'undefined' && navigator.language.toLowerCase().startsWith('zh')) return 'zh';
  return 'en';
}
