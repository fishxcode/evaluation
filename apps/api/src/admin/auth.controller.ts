/**
 * AuthController — POST /admin/login (public). Issues a JWT on valid creds.
 * AuthController——POST /admin/login（公开）。凭据有效时签发 JWT。
 */
import { Controller, Post, Body } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { AuthService } from './auth.service.js';
import { AdminStore } from './admin-store.service.js';

@ApiTags('admin')
@Controller('admin')
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    private readonly store: AdminStore,
  ) {}

  @Post('login')
  @ApiOperation({ summary: 'Admin login → JWT / 管理员登录换取 JWT' })
  @ApiResponse({ status: 201, description: 'JWT token issued' })
  @ApiResponse({ status: 401, description: 'Invalid credentials' })
  async login(@Body() body: { username: string; password: string }) {
    const result = await this.auth.login(body?.username ?? '', body?.password ?? '');
    this.store.audit({ actor: body.username, action: 'login', detail: {} });
    return result;
  }
}
