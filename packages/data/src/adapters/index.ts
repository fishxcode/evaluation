/**
 * Adapter registry. To add a new source (e.g. OpenRouter), implement the
 * SourceAdapter interface and add it here — nothing else changes.
 * Adapter 注册表。新增来源（如 OpenRouter）只需实现 SourceAdapter 接口并加到这里，
 * 其余代码零改动。
 */
import type { SourceAdapter } from './types.js';
import { apiAdapter } from './api.adapter.js';
import { catalogAdapter } from './catalog.adapter.js';
import { labsAdapter } from './labs.adapter.js';

/**
 * Ordered list of active adapters. Order does not affect merge precedence
 * (that's defined in merger.ts), only fetch scheduling.
 * 启用的 adapter 有序列表。顺序不影响 merge 优先级（那在 merger.ts 定义），仅影响抓取调度。
 */
export const adapters: SourceAdapter[] = [apiAdapter, catalogAdapter, labsAdapter];

export * from './types.js';
export { apiAdapter, catalogAdapter, labsAdapter };
