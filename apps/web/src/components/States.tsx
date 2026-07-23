/**
 * Four-state UI components (10.1): Loading (skeleton), Empty, Error.
 * 四态 UI 组件：加载（骨架）、空、错误。
 */
import { useT } from '../i18n/index.js';

/** Skeleton grid for loading state / 加载态骨架网格 */
export function SkeletonGrid({ count = 12 }: { count?: number }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="skeleton h-32 rounded-lg" />
      ))}
    </div>
  );
}

/** Empty state / 空态 */
export function EmptyState({ message }: { message?: string }) {
  const t = useT();
  return (
    <div className="flex flex-col items-center justify-center py-20 text-muted">
      <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="mb-3 opacity-50">
        <circle cx="11" cy="11" r="8" /><path d="m21 21-4.3-4.3" />
      </svg>
      <p>{message ?? t('common.empty')}</p>
    </div>
  );
}

/** Error state with retry / 错误态含重试 */
export function ErrorState({ error, onRetry }: { error: unknown; onRetry?: () => void }) {
  const t = useT();
  const msg = error instanceof Error ? error.message : t('common.error');
  return (
    <div className="flex flex-col items-center justify-center py-20">
      <p className="text-red-500 mb-3">{msg}</p>
      {onRetry && (
        <button onClick={onRetry} className="px-4 py-2 rounded-md bg-accent text-white text-sm hover:opacity-90">
          {t('common.retry')}
        </button>
      )}
    </div>
  );
}
