import {
  Controller,
  Get,
  Header,
  Headers,
  Inject,
  NotFoundException,
  Param,
  Redirect,
  Req,
} from "@nestjs/common";
import { ApiExcludeController } from "@nestjs/swagger";
import type { Model } from "@models-dev/shared";
import { findClientDist, readClientIndex } from "./client-dist.js";
import { DatasetService } from "./dataset.service.js";

interface SeoMeta {
  locale: "en" | "zh";
  title: string;
  description: string;
  urlPath: string;
}

function siteOrigin() {
  return (process.env.PUBLIC_SITE_URL ?? "http://localhost:3000").replace(
    /\/$/,
    "",
  );
}

function preferredLocale(acceptLanguage?: string) {
  const entries =
    acceptLanguage?.split(",").flatMap((part, index) => {
      const [tag, ...params] = part.trim().split(";");
      if (!tag) return [];
      const qParam = params.find((item) => item.trim().startsWith("q="));
      const q = qParam ? Number(qParam.trim().slice(2)) : 1;
      return [{ tag: tag.toLowerCase(), q: Number.isFinite(q) ? q : 0, index }];
    }) ?? [];
  entries.sort((a, b) => b.q - a.q || a.index - b.index);
  for (const entry of entries) {
    if (entry.tag.startsWith("zh")) return "zh";
    if (entry.tag.startsWith("en")) return "en";
  }
  return "en";
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

function escapeAttr(value: string) {
  return escapeHtml(value).replaceAll('"', "&quot;");
}

function decodeModelId(value: string | undefined) {
  if (!value) return "";
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

function alternatePath(urlPath: string, locale: "en" | "zh") {
  const parts = urlPath.split("/");
  if (parts[1] === "en" || parts[1] === "zh") {
    parts[1] = locale;
    return parts.join("/") || `/${locale}/models`;
  }
  return `/${locale}/models`;
}

function routeMeta(
  locale: "en" | "zh",
  urlPath: string,
  model?: Model,
): SeoMeta {
  if (model) {
    return {
      locale,
      title:
        locale === "zh"
          ? `${model.name} 模型详情 | Models.dev Explorer`
          : `${model.name} model details | Models.dev Explorer`,
      description: model.description,
      urlPath,
    };
  }

  const route = urlPath.split("/")[2] ?? "models";
  if (urlPath === "/admin") {
    return {
      locale,
      title: "Admin Console | Models.dev Explorer",
      description:
        "Operational console for data refreshes, source health, quarantine, manual overrides, audit logs, and usage statistics.",
      urlPath,
    };
  }
  const copy = {
    en: {
      models: [
        "AI Model Explorer | Models.dev Explorer",
        "Search, filter, sort, and compare AI models using the live models.dev dataset.",
      ],
      pricing: [
        "AI model pricing comparison | Models.dev Explorer",
        "Compare provider pricing for input, cached input, output, and reasoning tokens.",
      ],
      dashboard: [
        "Model catalog dashboard | Models.dev Explorer",
        "Track model counts, providers, latest releases, and pricing trends from the merged dataset.",
      ],
      labs: [
        "AI labs catalog | Models.dev Explorer",
        "Browse labs, providers, model counts, timelines, and source links from models.dev data.",
      ],
      benchmarks: [
        "Benchmark comparison | Models.dev Explorer",
        "Compare benchmark coverage and scores without treating missing results as zero.",
      ],
    },
    zh: {
      models: [
        "AI 模型探索器 | Models.dev Explorer",
        "基于实时 models.dev 数据搜索、筛选、排序并比较 AI 模型。",
      ],
      pricing: [
        "AI 模型价格对比 | Models.dev Explorer",
        "比较各 Provider 的输入、缓存输入、输出和推理价格。",
      ],
      dashboard: [
        "模型目录仪表盘 | Models.dev Explorer",
        "查看模型数量、Provider、最新发布与价格趋势。",
      ],
      labs: [
        "AI Lab 目录 | Models.dev Explorer",
        "浏览 Lab、Provider、模型数量、时间线与来源链接。",
      ],
      benchmarks: [
        "Benchmark 对比 | Models.dev Explorer",
        "比较 benchmark 覆盖和分数，缺测不会被当作 0 分。",
      ],
    },
  } as const;
  const [title, description] =
    copy[locale][route as keyof typeof copy.en] ?? copy[locale].models;
  return { locale, title, description, urlPath };
}

function injectSeo(html: string, meta: SeoMeta) {
  const canonical = `${siteOrigin()}${meta.urlPath}`;
  const tags = [
    `<meta name="description" content="${escapeAttr(meta.description)}" />`,
    `<link rel="canonical" href="${escapeAttr(canonical)}" />`,
    `<link rel="alternate" hreflang="en" href="${escapeAttr(`${siteOrigin()}${alternatePath(meta.urlPath, "en")}`)}" />`,
    `<link rel="alternate" hreflang="zh" href="${escapeAttr(`${siteOrigin()}${alternatePath(meta.urlPath, "zh")}`)}" />`,
    `<meta property="og:title" content="${escapeAttr(meta.title)}" />`,
    `<meta property="og:description" content="${escapeAttr(meta.description)}" />`,
    `<meta property="og:url" content="${escapeAttr(canonical)}" />`,
    '<meta property="og:type" content="website" />',
    `<meta property="og:image" content="${escapeAttr(`${siteOrigin()}/og-image.svg`)}" />`,
    '<meta name="twitter:card" content="summary_large_image" />',
    `<meta name="twitter:title" content="${escapeAttr(meta.title)}" />`,
    `<meta name="twitter:description" content="${escapeAttr(meta.description)}" />`,
    `<meta name="twitter:image" content="${escapeAttr(`${siteOrigin()}/og-image.svg`)}" />`,
  ].join("\n    ");

  return html
    .replace(/<html lang="[^"]*"/, `<html lang="${meta.locale}"`)
    .replace(/<title>.*?<\/title>/, `<title>${escapeHtml(meta.title)}</title>`)
    .replace("</head>", `    ${tags}\n  </head>`);
}

/** Serve the built React application with request-specific SEO metadata.
 * 以按请求生成的 SEO 元数据服务 React 构建产物。 */
@ApiExcludeController()
@Controller()
export class WebController {
  private readonly clientDist = findClientDist();

  constructor(
    @Inject(DatasetService) private readonly dataset: DatasetService,
  ) {}

  @Get("")
  @Redirect()
  @Header("Vary", "Accept-Language")
  root(@Headers("accept-language") acceptLanguage?: string) {
    return {
      url: `/${preferredLocale(acceptLanguage)}/models`,
      statusCode: 302,
    };
  }

  @Get([
    "admin",
    "en",
    "zh",
    "en/models",
    "zh/models",
    "en/pricing",
    "zh/pricing",
    "en/dashboard",
    "zh/dashboard",
    "en/labs",
    "zh/labs",
    "en/benchmarks",
    "zh/benchmarks",
  ])
  @Header("Content-Type", "text/html; charset=utf-8")
  renderStaticPage(@Req() request: { path?: string; url?: string }) {
    return this.render(request.path ?? request.url ?? "/en/models");
  }

  @Get(["en/models/:modelId", "zh/models/:modelId"])
  @Header("Content-Type", "text/html; charset=utf-8")
  renderModelPage(
    @Param("modelId") modelId: string,
    @Req() request: { path?: string; url?: string },
  ) {
    const id = decodeModelId(modelId);
    const model = this.dataset
      .getDataset()
      .models.find((item) => item.id === id);
    return this.render(
      request.path ?? request.url ?? `/en/models/${encodeURIComponent(id)}`,
      model,
    );
  }

  private render(urlPath: string, model?: Model) {
    if (!this.clientDist)
      throw new NotFoundException(
        "Web client build not found. Run pnpm --filter @models-dev/web build first.",
      );
    const normalizedPath = urlPath === "/" ? "/en/models" : urlPath;
    const locale =
      normalizedPath.startsWith("/zh/") || normalizedPath === "/zh"
        ? "zh"
        : "en";
    return injectSeo(
      readClientIndex(this.clientDist),
      routeMeta(locale, normalizedPath, model),
    );
  }
}
