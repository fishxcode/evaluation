import {
  CallHandler,
  ExecutionContext,
  Inject,
  Injectable,
  NestInterceptor,
} from "@nestjs/common";
import { Observable, tap } from "rxjs";
import { ApiUsageService } from "./api-usage.service.js";

function routeKey(request: {
  method?: string;
  route?: { path?: string };
  path?: string;
  query?: Record<string, unknown>;
}) {
  return `${request.method ?? "GET"} ${request.route?.path ?? request.path ?? "/"}`;
}

/** Count successful API requests for the admin usage panel.
 * 为 Admin 用量面板统计成功 API 请求。 */
@Injectable()
export class ApiUsageInterceptor implements NestInterceptor {
  constructor(
    @Inject(ApiUsageService) private readonly usage: ApiUsageService,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const request = context.switchToHttp().getRequest<{
      method?: string;
      route?: { path?: string };
      path?: string;
      query?: Record<string, unknown>;
    }>();
    return next.handle().pipe(
      tap(() => {
        const searchTerm =
          typeof request.query?.q === "string" && request.path === "/search"
            ? request.query.q
            : undefined;
        this.usage.record(routeKey(request), searchTerm);
      }),
    );
  }
}
