import { Controller, Get, Header, Inject } from "@nestjs/common";
import { ApiExcludeEndpoint } from "@nestjs/swagger";
import type { Model } from "@models-dev/shared";
import { DatasetService } from "./dataset.service";

const LOCALES = ["en", "zh"] as const;

function siteOrigin() {
  return (process.env.PUBLIC_SITE_URL ?? "http://localhost:3000").replace(
    /\/$/,
    "",
  );
}

function escapeXml(value: string | number | undefined) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

function modelUrl(locale: string, model: Model) {
  return `${siteOrigin()}/${locale}/models/${encodeURIComponent(model.id)}`;
}

function modelTimestamp(model: Model) {
  return model.lastUpdated ?? model.releaseDate ?? new Date(0).toISOString();
}

/** Generate crawler-facing discovery documents from the live dataset.
 * 基于当前数据集生成面向爬虫的可发现性文档。 */
@Controller()
export class SeoController {
  constructor(
    @Inject(DatasetService) private readonly dataset: DatasetService,
  ) {}

  @Get("robots.txt")
  @ApiExcludeEndpoint()
  @Header("Content-Type", "text/plain; charset=utf-8")
  robots() {
    return [
      "User-agent: *",
      "Allow: /",
      "Disallow: /admin",
      `Sitemap: ${siteOrigin()}/sitemap.xml`,
      `RSS: ${siteOrigin()}/rss.xml`,
      "",
    ].join("\n");
  }

  @Get("sitemap.xml")
  @ApiExcludeEndpoint()
  @Header("Content-Type", "application/xml; charset=utf-8")
  sitemap() {
    const dataset = this.dataset.getDataset();
    const staticPages = [
      "models",
      "pricing",
      "dashboard",
      "labs",
      "benchmarks",
    ];
    const urlEntries = LOCALES.flatMap((locale) => [
      ...staticPages.map((page) => ({
        loc: `${siteOrigin()}/${locale}/${page}`,
        lastmod: dataset.metadata.fetchedAt,
      })),
      ...dataset.models.map((model) => ({
        loc: modelUrl(locale, model),
        lastmod: modelTimestamp(model),
      })),
    ]);
    const urls = urlEntries
      .map((entry) => {
        return [
          "  <url>",
          `    <loc>${escapeXml(entry.loc)}</loc>`,
          `    <lastmod>${escapeXml(entry.lastmod)}</lastmod>`,
          "  </url>",
        ].join("\n");
      })
      .join("\n");

    return [
      '<?xml version="1.0" encoding="UTF-8"?>',
      '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
      urls,
      "</urlset>",
      "",
    ].join("\n");
  }

  @Get("rss.xml")
  @ApiExcludeEndpoint()
  @Header("Content-Type", "application/rss+xml; charset=utf-8")
  rss() {
    const models = [...this.dataset.getDataset().models]
      .sort((a, b) => modelTimestamp(b).localeCompare(modelTimestamp(a)))
      .slice(0, 50);
    const items = models
      .map((model) => {
        const link = modelUrl("en", model);
        return [
          "    <item>",
          `      <title>${escapeXml(model.name)}</title>`,
          `      <link>${escapeXml(link)}</link>`,
          `      <guid>${escapeXml(link)}</guid>`,
          `      <pubDate>${escapeXml(new Date(modelTimestamp(model)).toUTCString())}</pubDate>`,
          `      <description>${escapeXml(model.description)}</description>`,
          "    </item>",
        ].join("\n");
      })
      .join("\n");

    return [
      '<?xml version="1.0" encoding="UTF-8"?>',
      '<rss version="2.0">',
      "  <channel>",
      "    <title>Models.dev Explorer Updates</title>",
      `    <link>${escapeXml(siteOrigin())}</link>`,
      "    <description>Recently released or updated AI models.</description>",
      items,
      "  </channel>",
      "</rss>",
      "",
    ].join("\n");
  }

  @Get("og-image.svg")
  @ApiExcludeEndpoint()
  @Header("Content-Type", "image/svg+xml; charset=utf-8")
  ogImage() {
    return [
      '<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">',
      '<rect width="1200" height="630" fill="#020617"/>',
      '<rect x="72" y="72" width="1056" height="486" rx="24" fill="#0f172a" stroke="#334155"/>',
      '<text x="120" y="210" fill="#e2e8f0" font-family="Inter, Arial, sans-serif" font-size="64" font-weight="700">Models.dev Explorer</text>',
      '<text x="120" y="300" fill="#38bdf8" font-family="Inter, Arial, sans-serif" font-size="34">Search, compare, and monitor AI model catalogs</text>',
      '<text x="120" y="392" fill="#94a3b8" font-family="Inter, Arial, sans-serif" font-size="28">Live merged data from API, catalog, and labs sources</text>',
      "</svg>",
      "",
    ].join("\n");
  }
}
