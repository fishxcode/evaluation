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
    this.dataDir = process.env.DATA_DIR ? process.env.DATA_DIR : join(process.cwd(), 'data');
    this.mergedDir = join(this.dataDir, 'merged');
  }

  onModuleInit(): void {
    this.load();
    this.startWatching();
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
