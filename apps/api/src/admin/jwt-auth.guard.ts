/**
 * JwtAuthGuard — protects all /admin/* endpoints (9.1). Verifies the bearer
 * JWT and requires role=admin. Applied at controller level so no endpoint can
 * accidentally be left unguarded.
 * JwtAuthGuard——保护所有 /admin/* 端点。校验 bearer JWT 且要求 role=admin。
 * 在 controller 层统一应用，避免漏加守卫。
 */
import { Injectable, CanActivate, ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import type { Request } from 'express';

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(private readonly jwt: JwtService) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const req = ctx.switchToHttp().getRequest<Request>();
    const auth = req.headers.authorization;
    const token = auth?.replace(/^Bearer\s+/i, '');
    if (!token) {
      throw new UnauthorizedException({ code: 'UNAUTHORIZED', message: 'Missing bearer token' });
    }
    try {
      const payload = await this.jwt.verifyAsync<{ sub: string; role: string }>(token);
      if (payload.role !== 'admin') {
        throw new UnauthorizedException({ code: 'FORBIDDEN', message: 'Admin role required' });
      }
      (req as Request & { user?: unknown }).user = payload;
      return true;
    } catch {
      throw new UnauthorizedException({ code: 'UNAUTHORIZED', message: 'Invalid or expired token' });
    }
  }
}
