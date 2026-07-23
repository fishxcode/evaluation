/**
 * useMeta (11) — sets document <title>, meta description, and Open Graph /
 * Twitter Card tags per page. Model Detail passes dynamic values so meta is
 * not a single static set across the app.
 * useMeta——按页设置 <title>、meta description、OG/Twitter Card。模型详情页传入
 * 动态值，避免全站复用同一套静态 meta。
 */
import { useEffect } from 'react';

interface MetaOptions {
  title: string;
  description?: string;
  /** og:type, default 'website' / OG 类型 */
  type?: string;
}

/** Set or create a <meta> tag by name or property / 按 name/property 设置 meta */
function setMeta(attr: 'name' | 'property', key: string, content: string): void {
  let el = document.head.querySelector<HTMLMetaElement>(`meta[${attr}="${key}"]`);
  if (!el) {
    el = document.createElement('meta');
    el.setAttribute(attr, key);
    document.head.appendChild(el);
  }
  el.setAttribute('content', content);
}

/**
 * Apply page metadata. Call once per page with the page's real values.
 * 应用页面元数据。每页用其真实值调用一次。
 */
export function useMeta({ title, description, type = 'website' }: MetaOptions): void {
  useEffect(() => {
    const fullTitle = `${title} · models.dev Explorer`;
    document.title = fullTitle;
    const desc = description ?? 'Enterprise AI model directory — explore, compare, and price AI models.';
    const url = window.location.href;

    setMeta('name', 'description', desc);
    setMeta('property', 'og:title', fullTitle);
    setMeta('property', 'og:description', desc);
    setMeta('property', 'og:type', type);
    setMeta('property', 'og:url', url);
    setMeta('name', 'twitter:card', 'summary');
    setMeta('name', 'twitter:title', fullTitle);
    setMeta('name', 'twitter:description', desc);
  }, [title, description, type]);
}
