/**
 * Vercel function entry. Re-exports the pre-compiled NestJS serverless handler
 * from apps/api/dist (compiled by tsc during build, so decorator metadata is
 * preserved — Vercel's esbuild would otherwise strip it).
 * Vercel 函数入口。从 apps/api/dist 重导出预编译的 NestJS serverless 处理器
 * （构建期由 tsc 编译，保留装饰器元数据——否则 Vercel 的 esbuild 会剥离）。
 */
// @ts-ignore — resolved at deploy time from the esbuild bundle (workspace pkgs
// inlined; see apps/api/esbuild.vercel.mjs). This avoids pnpm workspace symlink
// resolution failures in Vercel's serverless bundle.
// 从 esbuild 打包产物解析（工作区包已内联），规避 Vercel serverless 中 pnpm
// 工作区符号链接解析失败。
export { default } from '../apps/api/dist/vercel.bundle.mjs';
