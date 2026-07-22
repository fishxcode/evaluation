import crypto from "node:crypto";
import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from "@nestjs/common";
import { Observable, map } from "rxjs";

function hashBody(body: unknown) {
  return crypto.createHash("sha256").update(JSON.stringify(body)).digest("hex");
}

/** Add deterministic HTTP cache headers to every JSON response.
 * 为每个 JSON 响应添加确定性的 HTTP 缓存头。 */
@Injectable()
export class CacheHeaderInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    return next.handle().pipe(
      map((body) => {
        const response = context.switchToHttp().getResponse();
        response.setHeader("ETag", `"${hashBody(body)}"`);
        response.setHeader("Cache-Control", "public, max-age=60");
        return body;
      }),
    );
  }
}
