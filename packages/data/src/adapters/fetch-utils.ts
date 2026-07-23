/**
 * Shared fetch utilities: HTTP with ETag/hash incremental support.
 * 共用抓取工具：带 ETag/hash 增量支持的 HTTP 请求。
 */
import { createHash } from 'crypto';

/**
 * Compute SHA-256 hex hash of a string payload.
 * 计算字符串载荷的 SHA-256 十六进制哈希。
 */
export function hashContent(content: string): string {
  return createHash('sha256').update(content, 'utf8').digest('hex');
}

/**
 * Normalize a source string to undefined when blank. Source data (api.json)
 * uses empty strings for absent dates; per 铁律 2 absent means undefined, not
 * an invalid value that should be quarantined.
 * 将空白来源字符串归一化为 undefined。来源数据用空字符串表示缺失日期；
 * 按铁律 2，缺失即 undefined，而非应被隔离的非法值。
 */
export function blankToUndef(value: string | undefined | null): string | undefined {
  if (value == null) return undefined;
  const trimmed = value.trim();
  return trimmed === '' ? undefined : trimmed;
}

/**
 * Fetch a URL, returning raw text + etag + hash + duration.
 *
 * Incremental strategy (per prompt: "基于 etag/hash 判断来源是否变化"):
 *   1. If-None-Match with prevEtag → server may answer 304 (api/catalog do).
 *   2. Content-hash fallback: if the fetched body hashes to prevHash, skip.
 *      This covers sources WITHOUT ETag support (labs HTML has no ETag).
 * 增量策略（按 prompt「基于 etag/hash 判断」）：
 *   1. 用 prevEtag 发 If-None-Match，服务端可能返回 304（api/catalog 支持）。
 *   2. 内容哈希兜底：抓回的正文哈希等于 prevHash 则跳过。用于无 ETag 的来源
 *      （labs HTML 无 ETag）。
 */
export async function fetchText(
  url: string,
  prevEtag?: string,
  prevHash?: string,
): Promise<{
  text: string;
  etag?: string;
  hash: string;
  durationMs: number;
  skipped: boolean;
}> {
  const start = Date.now();
  const headers: Record<string, string> = {
    'Accept-Encoding': 'gzip',
  };
  if (prevEtag) {
    headers['If-None-Match'] = prevEtag;
  }

  const res = await fetch(url, { headers });
  const durationMs = Date.now() - start;

  if (res.status === 304) {
    // Server confirmed unchanged via ETag — incremental skip / 服务端经 ETag 确认未变
    return { text: '', etag: prevEtag, hash: prevHash ?? '', durationMs, skipped: true };
  }

  if (!res.ok) {
    throw new Error(`HTTP ${res.status} ${res.statusText} fetching ${url}`);
  }

  const text = await res.text();
  const etag = res.headers.get('etag') ?? undefined;
  const hash = hashContent(text);

  // Content-hash fallback for sources without ETag / 无 ETag 来源的内容哈希兜底
  if (prevHash && hash === prevHash) {
    return { text: '', etag, hash, durationMs, skipped: true };
  }

  return { text, etag, hash, durationMs, skipped: false };
}
