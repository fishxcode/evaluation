import { Injectable } from "@nestjs/common";
import type { Model, NormalizedDataset } from "@models-dev/shared";
import { AdminStore, type FieldOverride } from "./admin-store";

const SUPPORTED_FIELDS = new Set([
  "description",
  "family",
  "license",
  "openWeights",
  "architecture",
  "capabilities.reasoning",
  "capabilities.toolCall",
  "capabilities.structuredOutput",
  "capabilities.attachment",
  "capabilities.temperature",
  "capabilities.openWeights",
]);

function readPath(target: Record<string, unknown>, field: string) {
  return field.split(".").reduce<unknown>((current, key) => {
    if (current && typeof current === "object")
      return (current as Record<string, unknown>)[key];
    return undefined;
  }, target);
}

function writePath(
  target: Record<string, unknown>,
  field: string,
  value: unknown,
) {
  const parts = field.split(".");
  const last = parts.pop();
  if (!last) return;
  let current: Record<string, unknown> = target;
  for (const part of parts) {
    const next = current[part];
    if (!next || typeof next !== "object") current[part] = {};
    current = current[part] as Record<string, unknown>;
  }
  current[last] = value;
}

/** Store and apply manual field overrides without mutating raw source snapshots.
 * 存储并应用人工字段覆盖，不修改原始来源快照。 */
@Injectable()
export class ManualOverrideService {
  private readonly store = new AdminStore();

  /** Apply persisted overrides to a dataset clone.
   * 将持久化覆盖应用到数据集克隆。 */
  apply(dataset: NormalizedDataset): NormalizedDataset {
    const overrides = this.store.overrides();
    const next = structuredClone(dataset);
    next.models = next.models.map((model) =>
      this.applyToModel(model, overrides.models[model.id]),
    );
    return next;
  }

  /** Return overrides for one model.
   * 返回单个模型的覆盖记录。 */
  listModelOverrides(modelId: string) {
    return this.store.overrides().models[modelId] ?? {};
  }

  /** Set or replace one supported model field override.
   * 设置或替换一个受支持模型字段覆盖。 */
  setModelOverride(model: Model, field: string, value: unknown, actor: string) {
    if (!SUPPORTED_FIELDS.has(field))
      throw new Error(`Unsupported override field: ${field}`);
    const store = this.store.overrides();
    const modelOverrides = store.models[model.id] ?? {};
    const override: FieldOverride = {
      field,
      value,
      originalValue: readPath(
        model as unknown as Record<string, unknown>,
        field,
      ),
      updatedBy: actor,
      updatedAt: new Date().toISOString(),
    };
    modelOverrides[field] = override;
    store.models[model.id] = modelOverrides;
    this.store.saveOverrides(store);
    return override;
  }

  /** Delete one model field override.
   * 删除一个模型字段覆盖。 */
  deleteModelOverride(modelId: string, field: string) {
    const store = this.store.overrides();
    const modelOverrides = store.models[modelId] ?? {};
    const removed = modelOverrides[field];
    delete modelOverrides[field];
    if (Object.keys(modelOverrides).length)
      store.models[modelId] = modelOverrides;
    else delete store.models[modelId];
    this.store.saveOverrides(store);
    return removed;
  }

  private applyToModel(
    model: Model,
    overrides: Record<string, FieldOverride> | undefined,
  ): Model {
    if (!overrides) return model;
    const next = structuredClone(model) as unknown as Record<string, unknown>;
    for (const override of Object.values(overrides))
      writePath(next, override.field, override.value);
    return next as Model;
  }
}
