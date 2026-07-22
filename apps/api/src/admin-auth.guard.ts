import {
  CanActivate,
  ExecutionContext,
  Inject,
  Injectable,
} from "@nestjs/common";
import { AdminAuthService } from "./admin-auth.service.js";

export interface AdminRequest {
  adminUser?: string;
  headers: Record<string, string | string[] | undefined>;
}

function bearerToken(header: string | string[] | undefined) {
  const value = Array.isArray(header) ? header[0] : header;
  return value?.replace(/^Bearer\s+/i, "");
}

/** Guard every `/admin/*` API with the dedicated admin session token.
 * 使用独立管理员会话 token 统一保护 `/admin/*` API。 */
@Injectable()
export class AdminAuthGuard implements CanActivate {
  constructor(
    @Inject(AdminAuthService) private readonly auth: AdminAuthService,
  ) {}

  canActivate(context: ExecutionContext) {
    const request = context.switchToHttp().getRequest<AdminRequest>();
    request.adminUser = this.auth.verifyToken(
      bearerToken(request.headers.authorization),
    );
    return true;
  }
}
