import { defineConfig } from 'vitest/config';

/**
 * Root vitest config — runs the pure unit tests (shared/data) with esbuild.
 * The API's tests depend on decorator metadata and run via their own SWC-based
 * config (`pnpm --filter @models-dev/api test`), so they are excluded here.
 * 根 vitest 配置——用 esbuild 跑纯单测（shared/data）。API 测试依赖装饰器元数据，
 * 经其自身 SWC 配置运行，故此处排除。
 */
export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['packages/**/src/**/*.test.ts'],
    exclude: ['**/node_modules/**', '**/dist/**', 'apps/**'],
  },
});
