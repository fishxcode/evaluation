# Phase 1 Schema 与 Merge 策略

## 设计

归一化数据模型把 canonical model 身份与 provider-specific offering 分离。

- `Model` 是 provider 无关实体；有 catalog 记录时使用 catalog canonical id。
- `ProviderOffering` 保存 provider id、provider model id、pricing、provider API override、status 与 source ref。
- `Lab` 是独立维度，由 Labs HTML 增强，并通过 `Model.lab` 引用。
- `Provider` 来源于 API/Catalog provider 记录，可对应多个 offerings。

这种设计避免简单扁平 JSON merge 导致重复模型元数据和 provider pricing 相互覆盖。

## 来源优先级

- 身份：catalog 优先。
- Pricing：仅 API。
- Benchmarks、weights、license、links：仅 catalog。
- Provider 传输元数据：API/Catalog provider 根字段，offering 级 provider override 会保留。
- Lab 描述、logo、数量：Labs HTML；缺失时使用 catalog id 前缀兜底。

## 冲突处理

字段级冲突记录在 `metadata.conflicts`。

- API 与 catalog 在 canonical 字段冲突时，model-level 字段由 catalog 胜出。
- Provider offering 字段不会覆盖 canonical 字段；仅 external model fallback 例外。
- 名称匹配不唯一时不做 join，记录后保留为 external。
- 无效 normalized records 进入 `metadata.quarantine`，并从 `models` 排除。

## 缺失值

源字段缺失时保持 `undefined` 或语义上的空数组。

- 未知价格：没有 `pricing` object。
- 缺失 benchmark：`benchmarks` 为空数组。
- 缺失 Lab description：没有 `description`。
- 缺失 source link：没有 `url`。

展示层必须把缺失字段渲染为 dash，不能把未知值转为 `0`。

## 校验

所有 normalized dataset 都用 shared Zod schema 校验。data package 会校验每个合并后的 model，并把失败项移入 quarantine，同时记录失败 path 与 message。

## Adapter 扩展性

每个来源实现相同 adapter 边界：

```ts
interface SourceAdapter<TParsed> {
  readonly id: string;
  fetch(): Promise<RawSnapshot>;
  parse(snapshot: RawSnapshot): TParsed;
}
```

未来接入 OpenRouter 时，应新增一个 adapter 文件，输出 provider/offering records 与 source refs。Merge code 接收归一化 adapter 输出，不需要 provider-specific 分支。

## 取舍

- 使用 catalog canonical id 作为 global id，因为它已经 provider 无关且包含 lab 前缀。
- 未匹配 API offerings 保留为 external records，保证 pricing 覆盖范围可见，同时维护 join 完整性。
- Labs 优先解析嵌入式 search index，而不是视觉表格，因为它是页面中的结构化 JSON。
