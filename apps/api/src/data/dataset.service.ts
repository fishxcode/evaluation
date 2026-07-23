/**
 * DatasetService — loads merged data into memory and hot-reloads on change.
 * DatasetService——将 merged 数据载入内存，并在变更时热重载。
 *
 * Hot reload (Phase 2 §热刷新): watches merged/metadata.json; when the version
 * changes it reloads models/labs WITHOUT restarting the process. Chosen file-
 * watch over polling for immediacy and zero idle cost.
 * 热刷新：监听 merged/metadata.json；版本变化时不重启进程重载数据。
 * 选择文件监听而非轮询：即时且空闲零开销。
 */
import { Injectable, Logger, type OnModuleInit } from '@nestjs/common';
import { readFileSync, existsSync, watch, type FSWatcher } from 'fs';
import { join } from 'path';
import type { Model, Lab, DatasetMetadata } from '@models-dev/shared';

@Injectable()
export class DatasetService implements OnModuleInit {
  private readonly logger = new Logger(DatasetService.name);
  private readonly dataDir: string;
  private readonly mergedDir: string;
  private models: Model[] = [];
  private labs: Lab[] = [];
  private metadata: DatasetMetadata | null = null;
  private watcher: FSWatcher | null = null;
  private readonly startedAt = Date.now();

  constructor() {
    this.dataDir = DatasetService.resolveDataDir();
    this.mergedDir = join(this.dataDir, 'merged');
  }

  /**
   * Resolve the data dir robustly. On Vercel the function cwd differs from the
   * repo root, so we probe several candidate locations for merged/models.json.
   * 稳健解析 data 目录。Vercel 上函数 cwd 与仓库根不同，故探测多个候选位置。
   */
  private static resolveDataDir(): string {
    if (process.env.DATA_DIR) return process.env.DATA_DIR;
    const candidates = [
      join(process.cwd(), 'data'),
      join(process.cwd(), '../data'),
      join(process.cwd(), '../../data'),
      '/var/task/data',
    ];
    for (const c of candidates) {
      if (existsSync(join(c, 'merged', 'models.json'))) return c;
    }
    // Fallback to cwd/data (load() will warn if missing) / 回退
    return join(process.cwd(), 'data');
  }

  onModuleInit(): void {
    this.load();
    // Skip fs.watch on serverless (read-only FS, no persistent process).
    // Vercel sets VERCEL=1; also allow explicit DISABLE_WATCH.
    // serverless 上跳过 fs.watch（只读 FS、无常驻进程）。
    if (!process.env.VERCEL && process.env.DISABLE_WATCH !== '1') {
      this.startWatching();
    }
  }

  /** Load merged dataset from disk into memory / 从磁盘载入 merged 数据到内存 */
  private load(): void {
    const modelsPath = join(this.mergedDir, 'models.json');
    const labsPath = join(this.mergedDir, 'labs.json');
    const metaPath = join(this.mergedDir, 'metadata.json');
    if (!existsSync(modelsPath)) {
      this.logger.warn(`No merged data at ${modelsPath}; run 'pnpm data:refresh' first`);
      return;
    }
    this.models = JSON.parse(readFileSync(modelsPath, 'utf8')) as Model[];
    this.labs = existsSync(labsPath) ? (JSON.parse(readFileSync(labsPath, 'utf8')) as Lab[]) : [];
    this.metadata = existsSync(metaPath) ? (JSON.parse(readFileSync(metaPath, 'utf8')) as DatasetMetadata) : null;
    this.logger.log(`Loaded dataset v${this.metadata?.version ?? '?'}: ${this.models.length} models, ${this.labs.length} labs`);
  }

  /** Watch metadata.json; reload on version change (hot reload) / 监听并在版本变化时热重载 */
  private startWatching(): void {
    const metaPath = join(this.mergedDir, 'metadata.json');
    if (!existsSync(metaPath)) return;
    try {
      let debounce: NodeJS.Timeout | null = null;
      this.watcher = watch(metaPath, () => {
        if (debounce) clearTimeout(debounce);
        // debounce rapid fs events during atomic rename / 对原子 rename 的连发事件去抖
        debounce = setTimeout(() => {
          const prevVersion = this.metadata?.version;
          this.load();
          if (this.metadata?.version !== prevVersion) {
            this.logger.log(`Hot reloaded: v${prevVersion} → v${this.metadata?.version}`);
          }
        }, 200);
      });
    } catch (err) {
      this.logger.warn(`Could not watch ${metaPath}: ${String(err)}`);
    }
  }

  /** Force reload (called after POST /refresh) / 强制重载（POST /refresh 后调用） */
  reload(): void {
    this.load();
  }

  getModels(): Model[] { return this.models; }
  getLabs(): Lab[] { return this.labs; }
  getMetadata(): DatasetMetadata | null { return this.metadata; }
  getDataDir(): string { return this.dataDir; }
  getUptimeSeconds(): number { return Math.floor((Date.now() - this.startedAt) / 1000); }

  findModel(id: string): Model | undefined {
    return this.models.find(m => m.id === id);
  }
  findLab(id: string): Lab | undefined {
    return this.labs.find(l => l.id === id);
  }
}
