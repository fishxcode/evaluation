/**
 * Bundle the compiled serverless handler for Vercel.
 * 为 Vercel 打包已编译的 serverless handler。
 *
 * Why: Vercel's file tracer does not recreate pnpm workspace symlinks
 * (node_modules/@models-dev/*), so the workspace packages fail to resolve at
 * runtime. We inline ONLY @models-dev/* into a single file and keep all other
 * node_modules external (hoisted layout makes them resolvable at runtime).
 * 为何：Vercel 文件追踪不重建 pnpm 工作区符号链接，导致 @models-dev/* 运行时
 * 解析失败。此脚本仅内联 @models-dev/*，其余 node_modules 保持 external
 * （hoisted 布局使其运行时可解析）。
 *
 * Input:  apps/api/dist/vercel.js  (tsc-compiled, decorator metadata preserved)
 * Output: apps/api/dist/vercel.bundle.mjs  (imported by api/index.ts)
 */
import { build } from 'esbuild';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, '../..');

/**
 * esbuild plugin: mark every bare import external EXCEPT @models-dev/* so only
 * the workspace packages get inlined. Relative imports bundle normally.
 * 插件：除 @models-dev/* 外，所有裸导入标记 external；仅工作区包被内联。
 */
const externalizeNodeModules = {
  name: 'externalize-node-modules',
  setup(b) {
    b.onResolve({ filter: /.*/ }, (args) => {
      // entry + relative/absolute paths → let esbuild bundle them
      if (args.kind === 'entry-point') return null;
      if (args.path.startsWith('.') || args.path.startsWith('/')) return null;
      // inline workspace packages
      if (args.path.startsWith('@models-dev/')) return null;
      // everything else (node builtins + third-party) stays external
      return { path: args.path, external: true };
    });
  },
};

await build({
  entryPoints: [resolve(root, 'apps/api/dist/vercel.js')],
  outfile: resolve(root, 'apps/api/dist/vercel.bundle.mjs'),
  bundle: true,
  platform: 'node',
  format: 'esm',
  target: 'node20',
  // Keep decorator metadata that tsc already emitted (we bundle compiled JS, not TS)
  // 保留 tsc 已生成的装饰器元数据（打包的是已编译 JS，非 TS）
  plugins: [externalizeNodeModules],
  logLevel: 'info',
});

// eslint-disable-next-line no-console
console.log('esbuild: bundled apps/api/dist/vercel.bundle.mjs (workspace pkgs inlined)');
