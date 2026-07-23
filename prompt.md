# models.dev Explorer —— 企业级模型目录平台

> 本文档共五个部分：**总纲**（目标/铁律/协议/优先级）→ **数据层**（Phase 0-2）→ **服务层**（Phase 3 API + Admin Console）→ **前端层**（Phase 4-5 + SEO）→ **交付与工程规范**（Phase 6-8 + 仓库规范）。按顺序逐部分推进，每个 Phase 有明确 DoD，通过后才能进入下一个。

---

# 第一部分：总纲

## 一、项目定位与目标

你是一个由 Staff 级工程师组成的虚拟团队（后端架构 / 前端 / 数据架构 / 产品设计 / DevOps / Tech Lead）。任务是设计并实现一个**可长期维护、可扩展、具有生产级质量**的 AI 模型目录平台（Model Explorer），数据来自 models.dev 公开数据。

- **对标产品**：models.dev、OpenRouter Models、OpenAI/Anthropic 模型页。
- **目标**：在数据组织、搜索体验、信息展示、工程架构上明显优于 models.dev 原站。
- **验收标准**：这不是 Demo，不是作业。一年后有人接手这个仓库，能否在不重构的前提下新增数据源、新增页面、修 bug。

## 二、执行铁律（优先级最高，任何阶段不得违反）

1. **先设计后编码**：每个 Phase 先输出设计说明（为什么这样设计、备选方案、取舍原因、对扩展性的影响），经过阶段自检后再写代码。
2. **禁止基于假设编码数据结构**：所有 Schema 必须以 Phase 0 实际抓取到的真实数据为准。禁止虚构字段、虚构 benchmark 数值、虚构 Lab 信息。数据缺失就标记缺失，不许编造填充。
3. **禁止简单 merge JSON**：必须先设计统一数据模型（Normalized Schema），再设计 Merge Pipeline，最后实现 Import。
4. **每个 Phase 必须可独立运行和验证**，通过本 Phase 的 DoD 后才能进入下一 Phase。
5. **TypeScript 严格模式**，公共类型放 shared package，遵循 SOLID/DRY/KISS，可维护性优先于完成速度。
6. **如实报告**：测试失败、功能未完成、数据关联不上，必须如实写出，禁止在总结中粉饰。
7. **可使用 Agent/Subagent 并行拆解任务**：允许并鼓励拆解子任务并行执行（如 Phase 0 三个数据源并行探测、Phase 4 三个前端页面并行开发、Phase 7 后端/前端/数据三路自验证并行）。规则：
   - 有依赖关系的任务（如 Phase 1 依赖 Phase 0 结论）不得并行；
   - 每个 Subagent 任务需清晰独立、可自行完成；
   - 汇总后仍需主 Agent 复核一致性（Schema 命名、Merge 规则冲突），不能直接拼接；
   - Subagent 消耗的 token 计入所属 Phase 总消耗，写入 `TIMELOG.md`（见第三章）。

## 三、评测协议：分支命名与开发计时

本 prompt 会交给不同 AI 模型执行，用于横向评测，以下规则与执行铁律同级。

### 3.1 分支命名（开发前第一步）

写任何代码/文档之前，先以**当前执行本任务的 AI 模型的准确模型名称**创建并切换到新分支：

```bash
git checkout -b <当前AI模型名称>
# 示例：claude-fable-5 / gpt-5 / gemini-2.5-pro
```

- kebab-case，必须是真实版本号，禁止只写厂商名或编造版本号。
- **禁止直接在 main/master 提交**；评测期间不合并回主分支。

### 3.2 开发计时与模型消耗统计

- 创建分支后立即在根目录建 `TIMELOG.md`，记录**开发开始时间**（ISO 8601 含时区）与模型标识。
- 每个 Phase 开始/完成时追加一行：开始/结束时间、耗时、**该 Phase 消耗的 token 数**（Input/Output/Total）。token 以真实用量为准；无法获取精确值时允许估算，但必须标注"估算"（如 `~12k(估算)`），不得伪装成精确值。
- 全部完成后记录**结束时间**，计算**总耗时**与**总 token 消耗**。

格式示例：

```markdown
# TIMELOG
- Model: claude-fable-5
- Branch: claude-fable-5
- Started: 2026-07-22T21:30:00+08:00

| Phase | Start | End | Duration | Input Tokens | Output Tokens | Total Tokens | 备注 |
|---|---|---|---|---|---|---|---|
| Phase 0 数据源探测 | 21:30 | 21:52 | 22m | 8,200 | 3,100 | 11,300 | |

- Finished: 2026-07-23T02:10:00+08:00
- **Total Duration: 4h 40m**
- **Total Tokens: Input 96,500 / Output 41,200 / Total 137,700**（估算值占比说明）
```

- 时间必须真实记录，禁止事后编造；总耗时与总 token 消耗需写入 Phase 8 Review。

## 四、优先级分级

- **P0（必须交付）**：数据管线、统一 Schema、REST API（含分页契约、`/status`）、Swagger 在线调试、Model Explorer / Model Detail / Pricing Compare 三页面、Docker 部署、i18n（en/zh）、Dark/Light、响应式。
- **P1（P0 达标后交付）**：Dashboard、Benchmark Compare、Labs 页、⌘K 全局搜索、热更新、增量更新、SEO 套件、访问计数、Admin Console。
- **P2（可选加分，不足时砍掉并在 Review 说明）**：PWA、收藏、拼音搜索、无限滚动（作为分页的可选升级）、Vercel 部署。

宁可 P0 做到 95 分 + P2 全砍，也不要 20 个功能全是 60 分。
---

# 第二部分：数据层（Phase 0-2）

## 五、Phase 0：数据源探测（最先执行）

在设计任何 Schema 之前，先实际抓取并分析三个数据源：

| 来源 | URL | 预期内容 |
|---|---|---|
| API | `https://models.dev/api.json` | Provider、Pricing（input/cached input/output/reasoning）、模型 API 信息 |
| Catalog | `https://models.dev/catalog.json` | Context window、capabilities、modalities、benchmarks、release date、weights、license、architecture（不含价格） |
| Labs | `https://models.dev/labs` | Lab 名称、Logo、官网、简介、旗下模型（HTML 页面，需抓取解析） |

**步骤**：

1. 逐个请求，记录真实响应结构、字段清单、数据量级、数据类型样例（存入 `data/raw/`，写 `docs/data-source-analysis.md`）。
2. 若某 URL 不存在/结构不符/无法稳定解析：不要硬编，改为 (a) 在 models.dev 官网或其开源 TOML 仓库中找等价数据入口；(b) 在文档中记录差异；(c) 基于真实可得数据调整 Schema 设计并说明调整了什么。
3. 输出各来源间的**关联键分析**：模型如何跨来源对齐（id/slug/名称），冲突和缺失在哪里——这是 Merge Strategy 的输入。

**DoD**：`data/raw/` 有真实数据快照；分析文档说清每个来源有什么、缺什么、怎么关联。

## 六、Phase 1：统一数据模型与 Merge 策略

基于 Phase 0 真实数据设计统一 Schema（方向示例，字段以真实数据为准增删）：

```ts
interface Model {
  id: string            // 全局唯一，规则需文档化
  slug: string
  name: string
  family?: string
  lab: LabRef
  aliases: string[]
  releaseDate?: string  // ISO 8601
  contextWindow?: { input?: number; output?: number }
  modalities: { input: Modality[]; output: Modality[] }
  capabilities: Capability[]
  architecture?: string
  license?: string
  openWeights: boolean
  benchmarks: BenchmarkResult[]   // { benchmark, score, metric, source, date }
  offerings: ProviderOffering[]   // 同一模型多 Provider，各带 pricing
  sources: SourceRef[]            // 每条数据来自哪个来源、何时抓取
  overrides?: FieldOverride[]     // 人工覆盖记录，见 9.2.4
}
```

**必须文档化的设计决策**：

- **Merge Strategy**：字段级来源优先级（如价格以 api.json 为准，benchmark 以 catalog 为准）；多 Provider 如何聚合为 offerings；重命名/alias 归一规则。
- **Conflict Resolution**：字段冲突裁决规则 + 冲突记录（写入 metadata，可供 API 查询）。
- **人工覆盖（Manual Override）优先级**：覆盖值如何存储（`overrides[]`）、如何与 `sources[]` 共存、如何保证下次自动 Merge 不覆盖回去、如何影响 Validation。**这是为 9.2.4 Admin Console 人工覆盖功能预留的数据层设计，必须在此阶段一并定稿**，不要等到做 Admin Console 时再补。
- **缺失处理**：价格为空、benchmark 缺失、Lab 信息不全时显示 "—"，不显示 0 或编造值。
- **Validation**：Zod schema 校验全部合并输出，失败记录进隔离区（quarantine）并计数，不污染主数据集。
- **可扩展性**：数据源用 Adapter/Plugin 模式——每个来源实现统一 `SourceAdapter` 接口（fetch → parse → normalize），接入 OpenRouter/OpenAI/Anthropic/Azure/HuggingFace 时**只新增 adapter 文件，零改业务代码**。文档中用"假如明天接入 OpenRouter"走一遍流程自证。

**DoD**：Schema + Merge 规则文档（含人工覆盖章节）完成；Zod 定义完成并有单元测试覆盖关键归一化逻辑。

## 七、Phase 2：数据管线

```
Downloader → Raw Cache → Parser → Normalizer → Merge → Validation → Versioning → Hot Reload → REST API
```

目录：

```
data/
  raw/          # 原始快照（带时间戳/etag）
  merged/
    models.json
    metadata.json   # 更新时间、数据版本、内容 hash、etag、各来源状态、下载耗时
```

**要求**：

- 全量更新 + 增量更新（基于 etag/hash 判断来源是否变化，未变则跳过）。
- 更新失败自动回滚到上一版本（保留至少 N 个历史版本，原子替换）——这套 Versioning 机制同时服务于 9.2.1 Admin Console 的"回滚到历史版本"功能，设计时一并考虑。
- 内容 hash 校验；管线各阶段结构化日志。
- 热刷新：API 进程监听 merged 数据变化（文件 watch 或版本号轮询），**无需重启**服务最新数据。
- 管线可通过 CLI 独立运行（`pnpm data:refresh`），也可被 `POST /refresh`（8.1）或 `POST /admin/pipeline/refresh`（8.2）触发。

**DoD**：CLI 跑通全流程产出 merged 数据；注入坏数据能触发校验隔离与回滚；重复运行且来源未变时走增量跳过。
---

# 第三部分：服务层（Phase 3 API + Admin Console）

## 八、Phase 3：NestJS REST API

技术要求：NestJS + Zod validation + DTO + Swagger(OpenAPI) + 类型安全（与 shared types 共用）。

### 8.1 公开端点

全部支持分页/过滤/排序，统一响应包络 `{ data, meta, error }`：

```
GET  /models          GET /models/:id
GET  /labs            GET /labs/:id
GET  /providers       GET /benchmarks
GET  /pricing         GET /stats
GET  /metadata        GET /filters      # 返回各筛选维度可用值域，前端 Filters 由此驱动
GET  /search          # 全文+模糊+alias
GET  /status          # 健康检查：服务存活/数据版本/上次更新时间/各来源状态；无需鉴权，供容器探活使用
POST /refresh         # 触发数据管线，需简单鉴权（token）
```

**分页契约（全部列表类端点统一遵守）**：

- 参数：`page`（从 1 开始，默认 1）、`pageSize`（默认 20）。
- **`pageSize` 上限强制为 100**，Zod schema 在 DTO 层校验；超限或非法值返回 `400`（如 `pageSize must be between 1 and 100`），**不允许静默截断**（不能把 `pageSize=99999` 悄悄改成 100 后仍返回 200）。
- 响应 `meta` 固定包含 `{ page, pageSize, total, totalPages }`，各端点字段名一致。
- 校验规则放入 `packages/shared`（如 `paginationQuerySchema`），所有列表端点复用，禁止各 Controller 各写一套。

### 8.2 后台管理端点

见第九章 Admin Console，需独立登录鉴权，不与上方 token 方案混用：

```
POST /admin/login                    GET  /admin/pipeline/runs
POST /admin/pipeline/refresh         GET  /admin/pipeline/runs/:runId
POST /admin/pipeline/rollback/:versionId
GET  /admin/quarantine               GET  /admin/quarantine/:recordId
GET  /admin/sources/health
GET  /admin/models/:id/overrides     PUT /admin/models/:id/overrides   DELETE /admin/models/:id/overrides/:field
GET  /admin/audit-logs
GET  /admin/usage/stats
```

### 8.3 安全与工程

Rate limit、CORS、Helmet、输入校验（含 `pageSize` 上限校验，防止大页容量拖垮内存/数据库）、统一错误处理（错误码表文档化）、统一 Logger、ETag/HTTP 缓存头、Gzip/Brotli。`/admin/*` 全部端点需登录态校验，不与公开只读端点共用简单 token 方案。

### 8.4 Swagger 文档要求（含在线调试）

- 挂载路径固定为 `/api/docs`（README 中写明），部署后直接可访问。
- 必须支持**在线调试**（Try it out）：每个端点可在页面内填参数、发真实请求、看真实响应。分页/过滤/排序参数需给示例值。
- `POST /refresh`、`/admin/*` 等需鉴权端点，Swagger UI 需支持页面内填 token（`@ApiBearerAuth` 或等价 Authorize 按钮）。
- 全部 DTO 与响应体有完整 Schema（含示例），保证调试表单字段与真实接口一致。

**DoD**：Swagger 可在线调试（含需鉴权端点）；所有端点真实数据可访问；分页/过滤/排序有 e2e 测试（含 `pageSize` 超过 100 返回 400 的用例）；`POST /refresh` 后不重启即可读到新数据；`GET /status` 可用于容器健康检查（`HEALTHCHECK` 直连）。

## 九、后台数据管理页面（Admin Console，P1）

这是**会修改数据、触发操作**的管理面，给维护者/运维用，非公开产品页面。路由挂在 `/admin`（前端）+ `/admin/*`（后端，见 8.2），**默认不出现在公开导航、不出现在 sitemap，`robots.txt` 显式 disallow**（见十一）。

### 9.1 鉴权（与公开只读端点区分对待，铁律级要求）

- 不得复用 `POST /refresh` 的简单 token 方案。至少实现用户名密码登录 + JWT/session，密码用 bcrypt/argon2 加盐哈希，禁止明文或简单哈希。
- 登录态需过期与刷新机制；`/admin/*` 全部端点在网关层统一校验，不允许某端点漏加守卫。
- 初始管理员账号通过环境变量注入（`ADMIN_USERNAME`/`ADMIN_PASSWORD_HASH`），不硬编码。

### 9.2 功能模块

1. **数据管线控制台**：手动触发全量/增量 refresh；查看历史运行记录（时间、触发方式、耗时、各来源状态、成功/失败、变更摘要）；回滚到历史版本（复用 Phase 2 的 Versioning，回滚前展示字段 diff）。
2. **数据质量 / 隔离区（Quarantine）**：展示 Zod 校验打回的记录（字段、原始值、失败原因）；Merge 阶段字段冲突记录（哪个字段、几个来源、最终裁决）；缺失字段统计。
3. **数据源健康监控**：每个 Adapter（api.json/catalog.json/labs，未来 OpenRouter 等）最近抓取的 etag/hash、耗时、成功/失败、连续失败次数。
4. **人工覆盖（Manual Override）**：对某模型指定字段手动改写（如修正抓错的 Lab 简介）。规则见六章"人工覆盖优先级"；支持撤销恢复来源值；每次覆盖记录操作人/时间/字段/原值/新值。
5. **操作审计日志**：记录谁在什么时间做了什么操作（登录、refresh、回滚、覆盖增删），只读展示，不可篡改。
6. **用量与访问统计**：API 调用量（按端点聚合）、页面 PV（复用十一章计数器数据）、热门模型/搜索词排行。

### 9.3 设计要求

- UI 可比公开页面朴素（表格+表单为主），但四态（Loading/Empty/Error/Skeleton）与错误提示仍需完整——运维故障时最依赖这个页面。
- 破坏性操作（回滚、删除覆盖字段）前端必须二次确认。
- **Dark/Light 模式与 i18n（en/zh 双语，见 10.1）均需覆盖到 Admin Console**：登录页、管线控制台、隔离区、审计日志等界面文案均需双语，暗色下需可读，不能只做公开页面而漏掉后台。

**DoD**：非管理员访问 `/admin` 页面与 API 均被拒绝；可演示"抓取出错 → 隔离区可见 → 人工覆盖修正 → 下次 refresh 覆盖值不丢"闭环；审计日志能追溯任意一次数据改动；Admin Console 全部界面 en/zh 双语完整、Dark/Light 两态可读。
---

# 第四部分：前端层（Phase 4-5 + SEO）

## 十、Phase 4：React 前端（P0 页面）

技术栈：React + TanStack Router/Query/Table（Virtual 按需）+ TailwindCSS + shadcn/ui(Radix)。

### 10.1 全局体验要求

- **Mobile First 真适配**：Phone/Tablet/Desktop 三档，导航→Drawer、表格→卡片化、Filters→底部抽屉，不是简单缩放。
- **Dark / Light 双模式**：默认跟随系统（`prefers-color-scheme`），提供手动切换入口（Light/Dark/System 三态，全局导航可见）。手动选择需持久化（`localStorage`），刷新/重新访问后保留，不被系统变化覆盖。覆盖范围：公开页面、图表配色、Swagger 入口、**Admin Console**（第九章）。切换避免明显闪烁（FOUC，可用 SSR 注入初始 class 或提前读 localStorage，文档说明选型）。
- **国际化（i18n）切换**：支持 en/zh，URL 前缀 `/en` `/zh` 为唯一真源（不用 cookie/localStorage 决定语言，避免同一 URL 客户端渲染不同内容，影响 SEO）。
  - 全局导航提供语言切换器，跳转对应语言前缀等价路径（如 `/zh/models/gpt-5` ↔ `/en/models/gpt-5`），保留页面上下文（筛选/分页/slug），SPA 内路由跳转不整页刷新。
  - 首次访问无语言前缀时，按 `Accept-Language` 请求头（浏览器根据系统语言自动发出）自动 302 到匹配前缀（中文系统跳 `/zh`，否则 `/en`）；此后站内切换以 URL 为准，不再被浏览器语言覆盖。
  - 翻译覆盖全部文案、错误提示、四态、Toast，**包括 Admin Console**（登录页、管线控制台、隔离区、审计日志）。Swagger UI 由 OpenAPI 生成，保持英文不做双语（工具生成内容例外，文档说明）。全站不允许英中混杂的半成品翻译。
  - 语言切换与 Dark/Light 切换互不影响，状态独立持久化。
- **四态设计**：Skeleton/Loading/Empty/Error 每页完整设计，禁止白屏或裸 spinner。
- **视觉风格**：现代、克制、科技感，对标 Linear/Vercel/Stripe Dashboard，动画适量不浮夸。
- **API Docs 入口**：全局导航提供「API Docs」入口，链接 Swagger UI（`/api/docs`，见 8.4）。同域可 `<iframe>` 嵌入或新标签跳转；跨域改新标签跳转并标注后端地址来源。

### 10.2 页面一：Model Explorer

左侧 Filters + 右侧结果；Grid/List/Compact 三视图；搜索、筛选、排序、分页。Filters 覆盖 Lab/Provider/Capability/Context Window/Modalities/Open Weight/Release Date/License/Architecture/Price/Benchmark；筛选状态同步 URL（可分享）。排序支持发布日期/价格/Context/Benchmark/名称，规则见 10.5。分页规则见 10.6。

每行/卡片带勾选框，支持**多选对比**：勾选后底部浮动对比栏（已选 tag、数量、"对比"按钮），限制 2-6 个（超出提示，不静默失败）；点击跳转 Benchmark Compare（十二）并预填。List/Compact 视图勾选框常驻，Grid 视图 hover/长按显现。

### 10.3 页面二：Model Detail

Overview、Pricing（多 Provider 对比）、Capabilities、Benchmarks、Architecture、Weights、Providers、Timeline、Related Models、Raw JSON、Source Links。缺失字段显示 "—"。页面内"加入对比"按钮，与 10.2 共用对比选择状态（全局 store 或 URL query），跳转 Benchmark Compare。

### 10.4 页面三：Pricing Compare

按 Provider/Model/Lab 维度比较 input/cached/output/reasoning 价格；支持排序、搜索、固定列、导出 CSV、复制。排序规则见 10.5，分页/虚拟滚动规则见 10.6。同样支持多选对比入口（复用 10.2 逻辑）。

### 10.5 表格排序规范（Explorer / Pricing Compare 通用）

- 表头可点击排序，单列三态循环：升序 → 降序 → 取消，仅一列生效（不支持多列组合排序）。
- 排序状态（字段+方向）同步 URL query（如 `?sort=price&order=asc`），与筛选/分页状态共用同一套 URL 状态管理，保证可分享、可回退。
- 表头有明确排序方向图标，当前排序列高亮；移动端卡片化视图下排序改为顶部下拉选择器（无表头可点击）。

### 10.6 分页规范（Explorer / Pricing Compare 通用）

- Explorer 默认使用**数字翻页器**（底部分页控件），可选页大小 20/50/100（对应 8.1 分页契约上限）；无限滚动作为 P2 可选升级，若实现则替代翻页器而非共存。
- 翻页状态同步 URL（`?page=2`），与排序/筛选共用 URL 状态管理。
- **筛选或排序条件变化时，分页重置到第一页**，避免用户停留在不存在的页码上。
- Pricing Compare 的 Provider offerings 数量级通常可控（几十到几百行），采用**虚拟滚动代替分页**（TanStack Virtual）以获得更好的连续浏览体验，需在文档中说明该取舍。

**DoD**：三个页面在 375px/768px/1280px 三档宽度下可用；i18n、Dark/Light、四态全部可演示；筛选/排序/分页结果与 API 一致；表头排序三态循环、分页/虚拟滚动均可通过 URL 复现；多选对比可正确预填跳转 Benchmark Compare；可点击进入并使用 Swagger 在线调试。

## 十一、SEO 与站点可发现性 + 访问计数（P1）

优先级：Meta/robots.txt/sitemap.xml/RSS/访问计数均属 P1（非可选，时间不足可简化实现但需在 Review 说明）。

- **Meta 标签**：每页独立 `<title>`、`meta description`、Open Graph（`og:title`/`og:description`/`og:image`/`og:url`）、Twitter Card。Model Detail 页 meta 基于真实数据动态生成，不全站复用同一套静态 meta。i18n 页配 `hreflang` 互链。
- **robots.txt**：站点根路径，允许爬取公开页面；`/admin` 相关路径显式 disallow（对应第九章隔离要求）；声明 sitemap 地址。
- **sitemap.xml**：动态生成（说明选择理由），覆盖 Explorer/每个 Model Detail/Labs 等页面的 en/zh 双语 URL；随数据更新反映最新模型列表，不是构建时写死的静态快照。
- **RSS Feed**：「模型更新」RSS（`/rss.xml` 或 `/feed`），条目为最近新增/更新模型，基于 merged 数据生成，随热更新同步刷新。
- **网站访问次数（底部计数器）**：前端页脚展示总访问次数。后端持久化计数器（扩展 `/stats` 新增 `pageViews` 字段或新增轻量端点），按会话/IP+UA 基础去重，进程重启/热更新后不丢失。该数据同时供 9.2.6「用量与访问统计」复用。

**DoD**：抓取工具能验证 meta/OG 标签随页面变化；robots.txt/sitemap.xml/RSS 均可访问且与当前数据一致；页脚访问计数多次刷新和重启后持续累加不重置。

## 十二、Phase 5：P1 功能

- **Dashboard**：总模型数、Labs 数、Provider 数、最新模型、最近更新、平均价格、数据更新时间；配 Charts/Timeline（图表库自选，说明理由）。
- **Benchmark Compare**：多模型对比，Radar/Bar/Heatmap/Scatter/Table；benchmark 覆盖以真实数据为准。不同模型覆盖不一致时的展示策略需设计（缺测 ≠ 0 分）。对比模型来源两条路径：(a) 从 10.2/10.4 勾选跳转预填；(b) 页面内独立搜索框直接添加/移除，不要求必须从其他页面带入口。已选模型持久化到 URL query（如 `?compare=model-a,model-b`）。
- **Labs 页**：Logo、简介、官网、模型数、发布时间线、旗下模型、平均价格/平均 benchmark；Timeline/Grid/Card 展示。
- **全局搜索**：⌘K Command Palette，模糊搜索+alias 命中，键盘可完整操作。

**DoD**：每个功能有真实数据截图级可演示状态；图表移动端不溢出。
---

# 第五部分：交付与工程规范（Phase 6-8 + 仓库规范）

## 十三、Phase 6：部署

单环境部署（评测/自用场景，不引入 staging/production 区分，文档说明取舍；后续需多环境只需复制 compose/CI 配置改环境变量，无需改代码）。

### 13.1 环境变量清单

根目录提供 `.env.example`，列出全部运行所需变量：

| 变量 | 说明 | 是否必填 |
|---|---|---|
| `PORT` | API 监听端口 | 是 |
| `NODE_ENV` | `production`/`development` | 是 |
| `REFRESH_TOKEN` | `POST /refresh`（8.1）鉴权 token | 是 |
| `ADMIN_USERNAME` | Admin Console 初始账号（9.1） | 是 |
| `ADMIN_PASSWORD_HASH` | 初始密码哈希（9.1） | 是 |
| `JWT_SECRET` | Admin Console 登录态签发密钥 | 是 |
| `DATA_DIR` | `data/` 挂载路径 | 否，默认 `./data` |
| `REFRESH_CRON` | 定时刷新 cron 表达式 | 否 |

真实 `.env` 禁止提交仓库（`.gitignore` 覆盖）；README 说明如何基于 `.env.example` 生成本地 `.env`。

### 13.2 CI（构建与校验）

GitHub Actions（或等价 CI，说明选型理由），push/PR 时自动执行：

```
Checkout → 安装依赖(pnpm) → Lint → 类型检查(tsc) → 单元测试 → e2e 测试 → Docker 镜像构建校验
```

任一步骤失败即 CI 失败，不允许合并/部署。镜像打 tag（git short sha + `latest`）；是否推送镜像仓库按需选择（评测场景可只做构建校验，不强制推送）。

### 13.3 Docker 部署（P0）

- 多阶段构建，最终单容器同时服务 API 与前端静态资源（Nest ServeStatic 或容器内反代，二选一说明理由）。
- Dockerfile + docker-compose.yml；数据目录挂 volume 持久化；容器内定时刷新（`REFRESH_CRON`，说明实现方案）。
- `HEALTHCHECK` 对接 `GET /status`（8.1）。

### 13.4 部署 Runbook（从零到可访问）

`docs/deployment.md` 中给出可直接照抄执行的命令序列：

```bash
# 1. 准备环境变量
cp .env.example .env && vim .env

# 2. 构建镜像
docker compose build

# 3. 启动（首次启动自动拉取三个数据源并跑首次 merge）
docker compose up -d

# 4. 验证部署成功
curl http://localhost:$PORT/status
curl http://localhost:$PORT/api/docs

# 5. 查看日志（排障用）
docker compose logs -f api
```

### 13.5 部署回滚（区别于数据回滚）

与 9.2.1 的**数据版本回滚**是两个不同层面，不要混淆：

- **数据回滚**：`merged/` 版本出问题，在 Admin Console 回滚到上一数据版本，服务不重启。
- **部署回滚**：镜像/代码本身有问题（启动失败、接口 500），回退到上一个可用镜像版本重新 `docker compose up`。Runbook 需说明如何标记"上一个可用版本"及回滚命令示例。

### 13.6 Vercel（P2，可选）

如做，说明 NestJS 在 Serverless 下的适配方式、数据更新用 Vercel Cron、持久化用外部存储/构建期快照的取舍。如不做，Review 中给出方案文档即可。

**DoD**：`docker compose up` 一条命令从零启动并可访问全部页面；CI 自动跑通 lint/类型检查/测试/镜像构建；Runbook 命令可直接照抄执行；能演示一次部署回滚与一次数据回滚并说明区别。

## 十四、Phase 7：测试与自验证

- 单元测试：normalizer、merge、conflict resolution 为重点。
- e2e：API 主要端点，含 `/admin/*` 鉴权拦截。
- 以下每项均需写明**验证方法（怎么测）+ 通过条件（什么算过）**，禁止只写"已验证 i18n"这类无法复核的结论；发现的问题与解决方案如实记录（铁律 6）。

### 14.1 Backend

| 检查项 | 验证方法 | 通过条件 |
|---|---|---|
| 端点可访问 | 对 8.1/8.2 全部端点发真实请求 | 均返回预期状态码，无 500 |
| 数据 merge 正确 | 抽查 5 个知名模型，逐字段对比原始值与 merged 结果 | 与 Merge Strategy（第六章）裁决规则一致 |
| 热更新生效 | 触发 `POST /refresh`，不重启请求 `GET /models` | 数据版本变化，内容为最新 merge 结果 |
| `/status` 可用 | 请求 `GET /status` | 200，字段与实际情况一致 |
| 增量更新跳过 | 来源未变时重复触发 refresh | 显示跳过（未重新下载） |
| 失败回滚 | 注入破坏 Schema 的假数据触发 refresh | 校验失败，数据版本回退，服务不受影响 |
| 分页边界 | 请求 `pageSize=101` 与 `pageSize=0` | 均返回 400，非静默截断 |

### 14.2 Frontend

| 检查项 | 验证方法 | 通过条件 |
|---|---|---|
| 搜索 | 输入已知模型名、alias、模糊拼写 | 均能命中目标模型 |
| 筛选 | 逐个勾选 10.2 各 Filter 维度 | 结果集与 API 过滤结果一致，多条件可叠加 |
| 排序 | 点击表头，验证 10.5 三态循环 | 切换正确，URL 同步，刷新后保留 |
| 分页 | 翻页，并在筛选/排序变化后观察页码 | 翻页正确、URL 同步；筛选/排序变化后重置到第 1 页（10.6） |
| 多选对比 | 勾选 2-6 个模型并跳转 | Benchmark Compare 正确预填；超 6 个有提示不静默失败 |
| 图表 | 打开四种图表类型，切换模型集合 | 基于真实数据渲染，缺测显示"未测"非 0 分；移动端不溢出 |
| i18n | (a) 模拟中文/非中文 `Accept-Language` 访问根路径；(b) 切换语言器；(c) 对比 `/en`/`/zh` 文案 key 覆盖率，含 Admin Console | (a) 自动跳转匹配前缀；(b) URL 变化、上下文保留、不整页刷新；(c) 两语言 key 集合一致，Admin Console 无缺译 |
| Dark/Light | (a) 模拟系统 dark/light；(b) 手动切换后刷新；(c) 抽查 Admin Console 与图表暗色可读性 | (a) 跟随系统；(b) 持久化不被覆盖；(c) 对比度可读、图表不失真 |
| Mobile | 375px/768px/1280px 下走核心流程 | 无横向滚动/遮挡；导航/Filters/表格/排序均降级正确 |
| 四态 | 构造慢网络/空结果/接口报错 | 四态均有对应设计，无白屏或裸 spinner |

### 14.3 Admin Console

| 检查项 | 验证方法 | 通过条件 |
|---|---|---|
| 鉴权拦截 | 未登录访问 `/admin` 页面与 `GET /admin/*` | 均被拒绝（跳转登录页/401/403） |
| 隔离区闭环 | 注入坏数据触发 refresh | 记录出现在隔离区，字段/原因清晰 |
| 人工覆盖闭环 | 手动覆盖字段后再触发 refresh | 覆盖值不被覆盖回去；撤销后恢复来源值 |
| 审计可追溯 | 执行登录+覆盖+回滚操作 | 三条记录均可查，含操作人/时间/类型/变更值 |
| i18n/Dark 覆盖 | 切换语言与暗色，逐页检查登录页/管线控制台/隔离区/审计日志 | 全部界面文案双语完整，暗色下可读 |

### 14.4 数据关联

| 检查项 | 验证方法 | 通过条件 |
|---|---|---|
| 三来源关联 | 抽查 10 个模型，核对是否对齐到同一 `Model.id` | 关联正确率、未关联数量与具体原因均写入报告，不能只写"基本正确" |

## 十五、Phase 8：最终 Review

输出：已完成清单、未完成清单、已知限制、后续优化建议（含被砍掉的 P2 项及方案概述）、架构图与关键设计决策汇总、`TIMELOG.md` 汇总的总耗时与总 token 消耗（第三章）。

## 十六、工程与仓库规范

### 16.1 Monorepo 结构

pnpm workspace：

```
apps/api  apps/web
packages/shared(types+zod)  packages/data(管线)  packages/ui  packages/utils
scripts/  docker/  docs/
```

VS Code 打开根目录即可开发；根 README 写清 3 条命令内启动开发环境。

### 16.2 文档国际化（强制）

`README.md`（英文）与 `README.zh-CN.md`（中文），内容等价同步维护，顶部互放语言切换链接。`docs/` 下设计文档同样双语（分文件或同文件分两节，全仓库统一一种方式）。

### 16.3 代码规范

ESLint + Prettier + Husky + lint-staged；TS strict；path alias；共享 types 单一来源（禁止前后端各写一份）。

### 16.4 注释与注解（强制）

- 所有导出的公共类型/接口/函数/类/React 组件写 **TSDoc/JSDoc**：用途、`@param`、`@returns`、`@throws`，关键模块附 `@example`。
- 复杂业务逻辑（merge 裁决、conflict resolution、normalizer 规则、增量更新判断）写**行内注释解释"为什么"**，不复述代码字面含义。
- NestJS 层用装饰器注解：Swagger 注解（`@ApiOperation`/`@ApiProperty`/`@ApiResponse`）覆盖全部 DTO 与端点，保证 OpenAPI 文档自动生成且与实现一致。
- Zod schema 非自明字段用 `.describe()` 说明来源与语义。
- 魔法数字、正则、workaround、TODO/FIXME 必须带注释说明缘由。
- **注释国际化（中英双语）**：TSDoc/JSDoc 英文在前、中文紧随其后；关键行内注释同样中英各一行；Swagger `summary`/`description` 与 Zod `.describe()` 亦双语。全仓库格式统一。
- 注释质量与双语覆盖率纳入 Phase 8 Review 自检项。

### 16.5 性能

路由懒加载、code split、大表虚拟滚动、React Query 缓存策略、HTTP 缓存/ETag、图片优化；文档中给出 SSR vs SPA 取舍说明（本项目选型及理由）。

## 十七、参考实现

可参考 `https://github.com/anomalyco/opencode/blob/dev/packages/stats/app/src/routes/model-catalog.ts` 的思路，**仅参考，禁止复制**，必须按本项目 Schema 重新设计。




