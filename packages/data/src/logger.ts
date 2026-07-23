/**
 * Minimal structured logger for the pipeline. Emits JSON lines with stage,
 * level, message, and arbitrary context (§ Phase 2 "structured logs").
 * 管线用极简结构化日志。输出带 stage/level/message/上下文的 JSON 行。
 */
export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export interface LogEntry {
  ts: string;
  level: LogLevel;
  stage: string;
  message: string;
  [key: string]: unknown;
}

/** In-memory + stdout structured logger / 内存 + stdout 结构化日志 */
export class PipelineLogger {
  private readonly entries: LogEntry[] = [];

  log(level: LogLevel, stage: string, message: string, ctx: Record<string, unknown> = {}): void {
    const entry: LogEntry = { ts: new Date().toISOString(), level, stage, message, ...ctx };
    this.entries.push(entry);
    // eslint-disable-next-line no-console
    console.log(JSON.stringify(entry));
  }

  info(stage: string, message: string, ctx?: Record<string, unknown>): void {
    this.log('info', stage, message, ctx);
  }
  warn(stage: string, message: string, ctx?: Record<string, unknown>): void {
    this.log('warn', stage, message, ctx);
  }
  error(stage: string, message: string, ctx?: Record<string, unknown>): void {
    this.log('error', stage, message, ctx);
  }

  getEntries(): LogEntry[] {
    return this.entries;
  }
}
