/**
 * AuthService — admin login with bcrypt password verification + JWT issuance
 * (9.1). Credentials come from env (ADMIN_USERNAME / ADMIN_PASSWORD_HASH);
 * never hardcoded. Distinct from the REFRESH_TOKEN scheme.
 * AuthService——管理员登录：bcrypt 校验密码 + 签发 JWT。凭据来自环境变量，
 * 绝不硬编码。与 REFRESH_TOKEN 方案区分。
 */
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import bcrypt from 'bcryptjs';

@Injectable()
export class AuthService {
  constructor(private readonly jwt: JwtService) {}

  /**
   * Validate credentials and return a signed JWT. Always runs bcrypt.compare
   * even on unknown user to avoid timing/username enumeration.
   * 校验凭据并返回签名 JWT。即使用户名未知也执行 bcrypt.compare，避免时序/枚举攻击。
   * @throws UnauthorizedException on invalid credentials / 凭据无效时抛出
   */
  async login(username: string, password: string): Promise<{ token: string; expiresIn: string }> {
    const expectedUser = process.env.ADMIN_USERNAME ?? '';
    const expectedHash = process.env.ADMIN_PASSWORD_HASH ?? '';
    // dummy hash keeps compare timing constant for unknown users / 恒定时序
    const compareHash = expectedHash || '$2b$12$0000000000000000000000000000000000000000000000000000';
    const passwordOk = await bcrypt.compare(password, compareHash);
    const userOk = username === expectedUser && expectedUser.length > 0;

    if (!userOk || !passwordOk || !expectedHash) {
      throw new UnauthorizedException({ code: 'UNAUTHORIZED', message: 'Invalid username or password' });
    }

    const expiresIn = process.env.JWT_EXPIRES_IN ?? '8h';
    const token = await this.jwt.signAsync({ sub: username, role: 'admin' }, { expiresIn });
    return { token, expiresIn };
  }
}
