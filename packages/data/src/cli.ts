/**
 * Data pipeline CLI — runnable standalone via `pnpm data:refresh`.
 * 数据管线 CLI——可经 `pnpm data:refresh` 独立运行。
 *
 * Usage:
 *   tsx src/cli.ts refresh [--full] [--data-dir <path>]
 */
import { resolve } from 'path';
import { refresh } from './pipeline.js';

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const cmd = args[0] ?? 'refresh';

  if (cmd !== 'refresh') {
    // eslint-disable-next-line no-console
    console.error(`Unknown command: ${cmd}. Supported: refresh`);
    process.exit(1);
  }

  const full = args.includes('--full');
  const dataDirIdx = args.indexOf('--data-dir');
  const dataDir = dataDirIdx >= 0 && args[dataDirIdx + 1]
    ? resolve(args[dataDirIdx + 1]!)
    : resolve(process.env.DATA_DIR ?? './data');

  const result = await refresh({ full, dataDir, trigger: 'cli' });

  // eslint-disable-next-line no-console
  console.log('\n=== Refresh Result ===');
  // eslint-disable-next-line no-console
  console.log(JSON.stringify({
    ok: result.ok,
    version: result.version,
    modelCount: result.modelCount,
    labCount: result.labCount,
    quarantinedCount: result.quarantinedCount,
    conflictCount: result.conflictCount,
    skipped: result.skipped,
    durationMs: result.durationMs,
    error: result.error,
  }, null, 2));

  process.exit(result.ok ? 0 : 1);
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error('Pipeline crashed:', err);
  process.exit(1);
});
