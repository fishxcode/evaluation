/**
 * Validator — runs every merged model through the Zod schema. Failures go to
 * quarantine (9.2.2) and are excluded from the main dataset.
 * Validator——用 Zod schema 校验每个合并后的模型。失败者进入隔离区，
 * 不进入主数据集。
 */
import { modelSchema, type Model } from '@models-dev/shared';

/**
 * A quarantined record: the raw model plus why it failed.
 * 隔离记录：原始模型 + 失败原因。
 */
export interface QuarantineRecord {
  /** Model id (or best-effort id) / 模型 id */
  id: string;
  /** The raw (invalid) model object / 原始（非法）模型对象 */
  raw: unknown;
  /** Zod issues / Zod 校验问题 */
  issues: Array<{ path: string; message: string }>;
}

export interface ValidationResult {
  valid: Model[];
  quarantined: QuarantineRecord[];
}

/**
 * Validate a list of candidate models. Valid ones pass; invalid ones are
 * quarantined with their issues. The main dataset therefore only ever
 * contains schema-valid records (docs/schema-and-merge.md §7).
 * 校验候选模型列表。合法通过；非法进入隔离区并附问题。
 */
export function validate(candidates: Model[]): ValidationResult {
  const valid: Model[] = [];
  const quarantined: QuarantineRecord[] = [];

  for (const candidate of candidates) {
    const result = modelSchema.safeParse(candidate);
    if (result.success) {
      valid.push(result.data);
    } else {
      quarantined.push({
        id: (candidate as { id?: string }).id ?? 'unknown',
        raw: candidate,
        issues: result.error.issues.map(i => ({
          path: i.path.join('.'),
          message: i.message,
        })),
      });
    }
  }

  return { valid, quarantined };
}
