/**
 * SeoController (11) — robots.txt, sitemap.xml (dynamic, en/zh), RSS feed
 * (recent model updates), and the page-view counter endpoints.
 * SeoController——robots.txt、动态双语 sitemap.xml、RSS（最近模型更新）、访问计数端点。
 *
 * All are dynamic (reflect current merged data), not build-time static (11).
 * 全部动态生成（反映当前 merged 数据），非构建期静态。
 */
import { Controller, Get, Post, Header, Req } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiExcludeEndpoint } from '@nestjs/swagger';
import type { Request } from 'express';
import { DatasetService } from '../data/dataset.service.js';
import { PageViewsService } from '../data/pageviews.service.js';

/** Escape XML special chars / 转义 XML 特殊字符 */
function xmlEscape(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

/** Derive site base URL from the request / 从请求推导站点基础 URL */
function baseUrl(req: Request): string {
  const proto = (req.headers['x-forwarded-proto'] as string) ?? req.protocol ?? 'https';
  const host = req.headers.host ?? 'localhost:3000';
  return `${proto}://${host}`;
}

@ApiTags('seo')
@Controller()
export class SeoController {
  constructor(
    private readonly dataset: DatasetService,
    private readonly pageviews: PageViewsService,
  ) {}

  /**
   * robots.txt — allow public pages, disallow /admin (9/11), declare sitemap.
   * robots.txt——允许公开页，禁止 /admin，声明 sitemap。
   */
  @Get('robots.txt')
  @ApiExcludeEndpoint()
  @Header('Content-Type', 'text/plain')
  robots(@Req() req: Request): string {
    const base = baseUrl(req);
    return [
      'User-agent: *',
      'Allow: /',
      'Disallow: /admin',
      'Disallow: /api/',
      '',
      `Sitemap: ${base}/sitemap.xml`,
      '',
    ].join('\n');
  }

  /**
   * sitemap.xml — dynamic, covers en/zh for Explorer + each Model Detail + Labs.
   * Reflects current model list (hreflang alternates for i18n).
   * sitemap.xml——动态，覆盖 Explorer + 每个模型详情 + Labs 的 en/zh，含 hreflang。
   */
  @Get('sitemap.xml')
  @ApiExcludeEndpoint()
  @Header('Content-Type', 'application/xml')
  sitemap(@Req() req: Request): string {
    const base = baseUrl(req);
    const models = this.dataset.getModels();
    const labs = this.dataset.getLabs();
    const langs = ['en', 'zh'];

    const urls: string[] = [];
    const add = (path: string, lastmod?: string): void => {
      const alternates = langs
        .map(l => `    <xhtml:link rel="alternate" hreflang="${l}" href="${base}/${l}${path}"/>`)
        .join('\n');
      for (const l of langs) {
        urls.push(
          `  <url>\n    <loc>${base}/${l}${path}</loc>${lastmod ? `\n    <lastmod>${lastmod.slice(0, 10)}</lastmod>` : ''}\n${alternates}\n  </url>`,
        );
      }
    };

    add('/models');
    add('/pricing');
    add('/labs');
    add('/dashboard');
    for (const m of models) {
      add(`/models/${m.lab.id}/${m.slug}`, m.lastUpdated ?? m.releaseDate);
    }
    for (const lab of labs) {
      add(`/labs`, lab.updated); // labs list; detail filtering handled client-side
    }

    return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">\n${urls.join('\n')}\n</urlset>\n`;
  }

  /**
   * RSS feed — recent model updates (by lastUpdated desc), reflects merged data.
   * RSS——最近模型更新（按 lastUpdated 降序），反映 merged 数据。
   */
  @Get('rss.xml')
  @ApiExcludeEndpoint()
  @Header('Content-Type', 'application/rss+xml')
  rss(@Req() req: Request): string {
    const base = baseUrl(req);
    const recent = [...this.dataset.getModels()]
      .sort((a, b) => (b.lastUpdated ?? b.releaseDate ?? '').localeCompare(a.lastUpdated ?? a.releaseDate ?? ''))
      .slice(0, 50);

    const items = recent.map(m => {
      const link = `${base}/en/models/${m.lab.id}/${m.slug}`;
      const date = m.lastUpdated ?? m.releaseDate;
      return `    <item>\n      <title>${xmlEscape(m.name)} (${xmlEscape(m.lab.name)})</title>\n      <link>${link}</link>\n      <guid>${link}</guid>${date ? `\n      <pubDate>${new Date(date).toUTCString()}</pubDate>` : ''}\n      <description>${xmlEscape(m.description ?? '')}</description>\n    </item>`;
    }).join('\n');

    return `<?xml version="1.0" encoding="UTF-8"?>\n<rss version="2.0"><channel>\n    <title>models.dev Explorer — Model Updates</title>\n    <link>${base}</link>\n    <description>Recently added or updated AI models</description>\n${items}\n</channel></rss>\n`;
  }

  /**
   * Record + return the page-view count (11). Called once on SPA load.
   * 记录并返回访问计数。SPA 加载时调用一次。
   */
  @Post('pageview')
  @ApiOperation({ summary: 'Record a page view, return total / 记录访问并返回总数' })
  pageview(@Req() req: Request): { total: number } {
    const ip = (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() ?? req.ip ?? 'unknown';
    const ua = (req.headers['user-agent'] as string) ?? 'unknown';
    return { total: this.pageviews.record(ip, ua) };
  }

  @Get('pageview')
  @ApiOperation({ summary: 'Get current page-view total / 获取访问总数' })
  pageviewTotal(): { total: number } {
    return { total: this.pageviews.getTotal() };
  }
}
