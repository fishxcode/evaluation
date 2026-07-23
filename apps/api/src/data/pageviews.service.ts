/**
 * PageViewsService (11) — persistent page-view counter with basic session/IP+UA
 * dedup. Persisted to DATA_DIR/pageviews.json so it survives restart/hot-reload.
 * PageViewsService——持久化访问计数，按 会话/IP+UA 基础去重。持久化到
 * DATA_DIR/pageviews.json，重启/热重载后不丢失。
 *
 * Note: on Vercel serverless the FS is read-only except /tmp, so the counter is
 * per-instance ephemeral there; documented in docs/deployment.md. In Docker
 * (volume-mounted DATA_DIR) it persists.
 * 注：Vercel serverless 只读 FS，计数在其上按实例临时；Docker（挂载 DATA_DIR）持久。
 */
import { Injectable, Logger } from '@nestjs/common';
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { join } from 'path';
import { createHash } from 'crypto';

interface PageViewData {
  total: number;
  /** Recent visitor fingerprints for basic dedup (bounded) / 近期访客指纹（有界） */
  recent: string[];
}

@Injectable()
export class PageViewsService {
  private readonly logger = new Logger(PageViewsService.name);
  private readonly file: string;
  private data: PageViewData = { total: 0, recent: [] };
  private dirty = false;

  constructor() {
    const dir = process.env.DATA_DIR ? process.env.DATA_DIR : join(process.cwd(), 'data');
    // Prefer /tmp on read-only serverless FS / 只读 serverless 上优先 /tmp
    const targetDir = this.isWritable(dir) ? dir : '/tmp';
    this.file = join(targetDir, 'pageviews.json');
    this.load();
    // Flush periodically to reduce write frequency / 定期落盘降低写频
    setInterval(() => this.flush(), 10_000).unref?.();
  }

  private isWritable(dir: string): boolean {
    try {
      mkdirSync(dir, { recursive: true });
      return true;
    } catch {
      return false;
    }
  }

  private load(): void {
    if (existsSync(this.file)) {
      try {
        this.data = JSON.parse(readFileSync(this.file, 'utf8')) as PageViewData;
      } catch {
        this.logger.warn(`Could not parse ${this.file}, resetting counter`);
      }
    }
  }

  private flush(): void {
    if (!this.dirty) return;
    try {
      writeFileSync(this.file, JSON.stringify(this.data), 'utf8');
      this.dirty = false;
    } catch {
      // read-only FS (serverless) — keep counting in memory / 只读 FS 仅内存计数
    }
  }

  /**
   * Record a view. Dedups by hash(ip+ua) within the recent window so refreshes
   * by the same visitor don't inflate the count.
   * 记录一次访问。按 hash(ip+ua) 在近期窗口内去重，避免同一访客刷新灌水。
   */
  record(ip: string, ua: string): number {
    const fp = createHash('sha256').update(`${ip}|${ua}`).digest('hex').slice(0, 16);
    if (!this.data.recent.includes(fp)) {
      this.data.total += 1;
      this.data.recent.push(fp);
      // Bound the recent list to the last 5000 fingerprints / 有界，仅留最近 5000
      if (this.data.recent.length > 5000) this.data.recent = this.data.recent.slice(-5000);
      this.dirty = true;
    }
    return this.data.total;
  }

  getTotal(): number {
    return this.data.total;
  }
}
