/**
 * Vercel function entry. Re-exports the pre-compiled NestJS serverless handler
 * from apps/api/dist (compiled by tsc during build, so decorator metadata is
 * preserved — Vercel's esbuild would otherwise strip it).
 * Vercel 函数入口。从 apps/api/dist 重导出预编译的 NestJS serverless 处理器
 * （构建期由 tsc 编译，保留装饰器元数据——否则 Vercel 的 esbuild 会剥离）。
 */
// @ts-ignore — resolved at deploy time from the tsc-built output (dist)
export { default } from '../apps/api/dist/vercel.js';
