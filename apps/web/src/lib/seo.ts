import { useEffect } from "react";
import type { Locale } from "./i18n";

export interface SeoInput {
  locale: Locale;
  title: string;
  description: string;
  path: string;
}

function ensureMeta(selector: string, create: () => HTMLMetaElement) {
  const existing = document.head.querySelector(
    selector,
  ) as HTMLMetaElement | null;
  if (existing) return existing;
  const element = create();
  document.head.appendChild(element);
  return element;
}

function ensureLink(selector: string, create: () => HTMLLinkElement) {
  const existing = document.head.querySelector(
    selector,
  ) as HTMLLinkElement | null;
  if (existing) return existing;
  const element = create();
  document.head.appendChild(element);
  return element;
}

function alternatePath(path: string, locale: Locale) {
  const parts = path.split("/");
  if (parts[1] === "en" || parts[1] === "zh") {
    parts[1] = locale;
    return parts.join("/") || `/${locale}/models`;
  }
  return `/${locale}/models`;
}

/** Keep document metadata aligned with the current route and locale.
 * 保持文档元信息与当前路由和语言一致。 */
export function useSeo(input: SeoInput) {
  useEffect(() => {
    const canonical = `${window.location.origin}${input.path}`;
    document.documentElement.lang = input.locale;
    document.title = input.title;

    ensureMeta('meta[name="description"]', () => {
      const meta = document.createElement("meta");
      meta.name = "description";
      return meta;
    }).content = input.description;

    ensureMeta('meta[property="og:title"]', () => {
      const meta = document.createElement("meta");
      meta.setAttribute("property", "og:title");
      return meta;
    }).content = input.title;

    ensureMeta('meta[property="og:description"]', () => {
      const meta = document.createElement("meta");
      meta.setAttribute("property", "og:description");
      return meta;
    }).content = input.description;

    ensureMeta('meta[property="og:url"]', () => {
      const meta = document.createElement("meta");
      meta.setAttribute("property", "og:url");
      return meta;
    }).content = canonical;

    ensureMeta('meta[property="og:type"]', () => {
      const meta = document.createElement("meta");
      meta.setAttribute("property", "og:type");
      return meta;
    }).content = "website";

    ensureMeta('meta[property="og:image"]', () => {
      const meta = document.createElement("meta");
      meta.setAttribute("property", "og:image");
      return meta;
    }).content = `${window.location.origin}/og-image.svg`;

    ensureMeta('meta[name="twitter:card"]', () => {
      const meta = document.createElement("meta");
      meta.name = "twitter:card";
      return meta;
    }).content = "summary_large_image";

    ensureMeta('meta[name="twitter:title"]', () => {
      const meta = document.createElement("meta");
      meta.name = "twitter:title";
      return meta;
    }).content = input.title;

    ensureMeta('meta[name="twitter:description"]', () => {
      const meta = document.createElement("meta");
      meta.name = "twitter:description";
      return meta;
    }).content = input.description;

    ensureMeta('meta[name="twitter:image"]', () => {
      const meta = document.createElement("meta");
      meta.name = "twitter:image";
      return meta;
    }).content = `${window.location.origin}/og-image.svg`;

    ensureLink('link[rel="canonical"]', () => {
      const link = document.createElement("link");
      link.rel = "canonical";
      return link;
    }).href = canonical;

    ensureLink('link[rel="alternate"][hreflang="en"]', () => {
      const link = document.createElement("link");
      link.rel = "alternate";
      link.hreflang = "en";
      return link;
    }).href = `${window.location.origin}${alternatePath(input.path, "en")}`;

    ensureLink('link[rel="alternate"][hreflang="zh"]', () => {
      const link = document.createElement("link");
      link.rel = "alternate";
      link.hreflang = "zh";
      return link;
    }).href = `${window.location.origin}${alternatePath(input.path, "zh")}`;
  }, [input.description, input.locale, input.path, input.title]);
}
