/**
 * ResponseInterceptor — wraps every successful response in the unified
 * envelope { data, meta, error } (8.1). If a handler returns { data, meta }
 * (list endpoints), meta is preserved; otherwise the payload becomes data.
 * ResponseInterceptor——将每个成功响应包进统一包络 { data, meta, error }。
 * 若 handler 返回 { data, meta }（列表端点）则保留 meta；否则整体作为 data。
 */
import { Injectable, NestInterceptor, ExecutionContext, CallHandler } from '@nestjs/common';
import type { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import type { ApiResponse, PaginationMeta } from '@models-dev/shared';

interface ListPayload {
  data: unknown;
  meta: PaginationMeta;
}

/** Type guard: does the payload already carry { data, meta }? / 是否已含 { data, meta } */
function isListPayload(p: unknown): p is ListPayload {
  return typeof p === 'object' && p !== null && 'data' in p && 'meta' in p;
}

@Injectable()
export class ResponseInterceptor implements NestInterceptor {
  intercept(_ctx: ExecutionContext, next: CallHandler): Observable<ApiResponse<unknown>> {
    return next.handle().pipe(
      map((payload): ApiResponse<unknown> => {
        if (isListPayload(payload)) {
          return { data: payload.data, meta: payload.meta };
        }
        return { data: payload ?? null };
      }),
    );
  }
}
