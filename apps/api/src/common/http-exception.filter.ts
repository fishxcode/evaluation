/**
 * AllExceptionsFilter — normalizes every error into the { data:null, error }
 * envelope with a documented error code (8.3 "统一错误处理，错误码表文档化").
 * AllExceptionsFilter——将所有错误归一化为 { data:null, error } 包络，带文档化错误码。
 *
 * Error code table (docs/api-error-codes.md):
 *   VALIDATION_ERROR (400) | UNAUTHORIZED (401) | FORBIDDEN (403)
 *   NOT_FOUND (404) | RATE_LIMITED (429) | INTERNAL (500)
 */
import { ExceptionFilter, Catch, ArgumentsHost, HttpException, Logger, HttpStatus } from '@nestjs/common';
import type { Response } from 'express';
import type { ApiResponse } from '@models-dev/shared';

const STATUS_TO_CODE: Record<number, string> = {
  400: 'VALIDATION_ERROR',
  401: 'UNAUTHORIZED',
  403: 'FORBIDDEN',
  404: 'NOT_FOUND',
  429: 'RATE_LIMITED',
  500: 'INTERNAL',
};

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const res = ctx.getResponse<Response>();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let code = 'INTERNAL';
    let message = 'Internal server error';
    let details: unknown;

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      code = STATUS_TO_CODE[status] ?? 'ERROR';
      const resp = exception.getResponse();
      if (typeof resp === 'string') {
        message = resp;
      } else if (typeof resp === 'object' && resp !== null) {
        const r = resp as Record<string, unknown>;
        // preserve structured errors from ZodValidationPipe / 保留来自校验管道的结构化错误
        code = (r['code'] as string) ?? code;
        message = (r['message'] as string) ?? message;
        details = r['details'];
      }
    } else if (exception instanceof Error) {
      message = exception.message;
      this.logger.error(exception.stack ?? exception.message);
    }

    const body: ApiResponse<null> = { data: null, error: { code, message, details } };
    res.status(status).json(body);
  }
}
