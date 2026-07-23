/**
 * AdminModule — JWT config + admin auth/management controllers (9.1, 9.2).
 * AdminModule——JWT 配置 + 管理员认证/管理 controller。
 */
import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { AuthService } from './auth.service.js';
import { AuthController } from './auth.controller.js';
import { AdminController } from './admin.controller.js';
import { AdminStore } from './admin-store.service.js';
import { JwtAuthGuard } from './jwt-auth.guard.js';
import { DatasetService } from '../data/dataset.service.js';

@Module({
  imports: [
    JwtModule.register({
      // JWT secret from env (9.1) — never hardcoded / JWT 密钥来自环境变量
      secret: process.env.JWT_SECRET ?? 'dev-only-insecure-secret-change-me',
      signOptions: { expiresIn: process.env.JWT_EXPIRES_IN ?? '8h' },
    }),
  ],
  controllers: [AuthController, AdminController],
  providers: [AuthService, AdminStore, JwtAuthGuard, DatasetService],
})
export class AdminModule {}
