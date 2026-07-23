import { defineConfig } from 'vitest/config';
import swc from 'unplugin-swc';

/**
 * Vitest config for the API. Uses SWC (not esbuild) so that
 * emitDecoratorMetadata is honored — NestJS DI relies on it.
 * API 的 Vitest 配置。用 SWC 而非 esbuild，以保留 emitDecoratorMetadata——
 * NestJS 依赖注入需要它。
 */
export default defineConfig({
  plugins: [
    swc.vite({
      module: { type: 'es6' },
      jsc: {
        target: 'es2022',
        transform: { legacyDecorator: true, decoratorMetadata: true },
        parser: { syntax: 'typescript', decorators: true },
      },
    }),
  ],
  test: {
    globals: true,
    environment: 'node',
    include: ['test/**/*.e2e.test.ts', 'src/**/*.test.ts'],
    testTimeout: 30_000,
  },
});
