/**
 * Compare selection state (10.2) — shared across Explorer/Detail/Pricing. Limits
 * to 2–6 models; exceeding shows a message (not silent failure). Persisted to
 * URL query on the Compare page via router.
 * 对比选择状态——Explorer/Detail/Pricing 共享。限制 2–6 个；超限提示（非静默失败）。
 */
import { createContext, useContext, useState, type ReactNode } from 'react';

const MAX = 6;

interface CompareCtx {
  ids: string[];
  has: (id: string) => boolean;
  toggle: (id: string) => { ok: boolean; reason?: 'max' };
  clear: () => void;
  max: number;
}
const Ctx = createContext<CompareCtx>({ ids: [], has: () => false, toggle: () => ({ ok: true }), clear: () => {}, max: MAX });

export function CompareProvider({ children }: { children: ReactNode }) {
  const [ids, setIds] = useState<string[]>([]);

  const has = (id: string): boolean => ids.includes(id);
  const toggle = (id: string): { ok: boolean; reason?: 'max' } => {
    if (ids.includes(id)) {
      setIds(ids.filter(x => x !== id));
      return { ok: true };
    }
    if (ids.length >= MAX) return { ok: false, reason: 'max' };
    setIds([...ids, id]);
    return { ok: true };
  };
  const clear = (): void => setIds([]);

  return <Ctx.Provider value={{ ids, has, toggle, clear, max: MAX }}>{children}</Ctx.Provider>;
}

export function useCompare(): CompareCtx {
  return useContext(Ctx);
}
