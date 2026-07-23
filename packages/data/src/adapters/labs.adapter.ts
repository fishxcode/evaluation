/**
 * Labs adapter — extracts the embedded search-index JSON from /labs/ HTML.
 * Labs adapter——从 /labs/ HTML 中提取内嵌的 search-index JSON。
 *
 * Source: https://models.dev/labs/ (307 → HTML with <script id="search-index">)
 * The search-index contains 24 lab entries + 263 model entries + 169 providers.
 * We consume ONLY lab entries here (lab registry: name/logo/description).
 * search-index 含 24 lab + 263 model + 169 provider；此处仅取 lab 条目。
 *
 * WHY HTML scraping: models.dev exposes no standalone labs.json endpoint
 * (labs.json/api/labs all 302-redirect). The embedded search-index is the
 * only structured lab source. Documented in docs/data-source-analysis.md §4.
 * 为何抓 HTML：models.dev 无独立 labs.json 端点，内嵌 search-index 是唯一结构化 Lab 来源。
 */
import type {
  SourceAdapter,
  RawSnapshot,
  ParsedContribution,
  SourceSnapshotMeta,
  LabContribution,
} from './types.js';
import { fetchText, hashContent } from './fetch-utils.js';

const LABS_URL = 'https://models.dev/labs/';

interface RawSearchEntry {
  type: 'lab' | 'model' | 'provider';
  id: string;
  title: string;
  logo?: string;
  description?: string;
  modelCount?: number;
  providerCount?: number;
  releaseDate?: string;
  updated?: string;
}

/**
 * Extract and parse the search-index JSON from the labs HTML.
 * 从 labs HTML 中提取并解析 search-index JSON。
 * @throws if the search-index script tag is missing / 缺少 script 标签时抛出
 */
function extractSearchIndex(html: string): RawSearchEntry[] {
  // Match <script id="search-index" type="application/json">...</script>
  const match = html.match(
    /<script id="search-index"[^>]*>([\s\S]*?)<\/script>/,
  );
  if (!match || !match[1]) {
    throw new Error('search-index script not found in labs HTML');
  }
  return JSON.parse(match[1].trim()) as RawSearchEntry[];
}

export const labsAdapter: SourceAdapter = {
  kind: 'labs',
  name: 'models.dev labs (search-index)',

  async fetch(prev?: SourceSnapshotMeta): Promise<RawSnapshot> {
    const fetchedAt = new Date().toISOString();
    try {
      // labs uses 307 redirect to /labs/ — fetch already handles the final URL
      const { text, etag, durationMs, skipped } = await fetchText(LABS_URL, prev?.etag);
      if (skipped) {
        return { kind: 'labs', raw: null, etag: prev?.etag, hash: prev?.hash ?? '', fetchedAt, durationMs, skipped: true };
      }
      // Extract only the search-index to store a compact, stable snapshot.
      // 仅提取 search-index，存储紧凑稳定的快照。
      const entries = extractSearchIndex(text);
      const labs = entries.filter(e => e.type === 'lab');
      const snapshotJson = JSON.stringify(labs);
      return {
        kind: 'labs',
        raw: labs,
        etag,
        // hash the extracted labs (not full HTML) so incremental compares content
        // 对提取后的 labs 做 hash（而非整页 HTML），使增量比较内容而非样式
        hash: hashContent(snapshotJson),
        fetchedAt,
        durationMs,
        skipped: false,
      };
    } catch (err) {
      return { kind: 'labs', raw: null, hash: '', fetchedAt, durationMs: 0, skipped: false, error: String(err) };
    }
  },

  parse(snapshot: RawSnapshot): ParsedContribution {
    if (snapshot.skipped || snapshot.error || !snapshot.raw) {
      return { models: [], labs: [], providers: [] };
    }
    const rawLabs = snapshot.raw as RawSearchEntry[];
    const labs: LabContribution[] = rawLabs.map(l => ({
      id: l.id,
      name: l.title,
      logo: l.logo,
      description: l.description,
      modelCount: l.modelCount,
      providerCount: l.providerCount,
      releaseDate: l.releaseDate,
      updated: l.updated,
      // NOTE: founded/website absent in source — never fabricated (铁律 2)
      // 注意：founded/website 来源缺失——绝不编造
    }));
    return { models: [], labs, providers: [] };
  },
};
