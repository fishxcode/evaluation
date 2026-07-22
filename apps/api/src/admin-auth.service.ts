import crypto from "node:crypto";
import { Injectable, UnauthorizedException } from "@nestjs/common";

interface SessionPayload {
  sub: string;
  exp: number;
  iat: number;
}

const TOKEN_TTL_MS = 60 * 60 * 1000;

function timingSafeEqualText(left: string, right: string) {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);
  if (leftBuffer.length !== rightBuffer.length) return false;
  return crypto.timingSafeEqual(leftBuffer, rightBuffer);
}

function base64Url(input: string | Buffer) {
  return Buffer.from(input).toString("base64url");
}

function parseBase64UrlJson<T>(value: string): T {
  return JSON.parse(Buffer.from(value, "base64url").toString("utf8")) as T;
}

/** Authenticate admin users with salted password hashes and signed sessions.
 * 使用带盐密码哈希与签名会话认证管理员。 */
@Injectable()
export class AdminAuthService {
  private readonly username = process.env.ADMIN_USERNAME;
  private readonly passwordHash = process.env.ADMIN_PASSWORD_HASH;
  private readonly secret =
    process.env.ADMIN_SESSION_SECRET ??
    process.env.JWT_SECRET ??
    crypto.randomBytes(32).toString("hex");

  /** Create a PBKDF2 password hash for deployment secret preparation.
   * 为部署密钥准备创建 PBKDF2 密码哈希。 */
  static hashPassword(
    password: string,
    salt = crypto.randomBytes(16).toString("hex"),
    iterations = 210_000,
  ) {
    const digest = crypto
      .pbkdf2Sync(password, salt, iterations, 32, "sha256")
      .toString("hex");
    return `pbkdf2$${iterations}$${salt}$${digest}`;
  }

  /** Validate credentials and return a signed expiring admin token.
   * 校验凭据并返回带过期时间的签名管理员 token。 */
  login(username: string | undefined, password: string | undefined) {
    if (!this.username || !this.passwordHash) {
      throw new UnauthorizedException("Admin credentials are not configured");
    }
    if (
      !username ||
      !password ||
      username !== this.username ||
      !this.verifyPassword(password, this.passwordHash)
    ) {
      throw new UnauthorizedException("Invalid admin credentials");
    }
    const now = Date.now();
    const payload: SessionPayload = {
      sub: username,
      iat: now,
      exp: now + TOKEN_TTL_MS,
    };
    return {
      token: this.sign(payload),
      expiresAt: new Date(payload.exp).toISOString(),
      user: { username },
    };
  }

  /** Verify a signed admin token and return its subject.
   * 校验签名管理员 token 并返回主体。 */
  verifyToken(token: string | undefined) {
    if (!token) throw new UnauthorizedException("Missing admin token");
    const [payloadPart, signature] = token.split(".");
    if (!payloadPart || !signature)
      throw new UnauthorizedException("Invalid admin token");
    const expected = this.signature(payloadPart);
    if (!timingSafeEqualText(signature, expected))
      throw new UnauthorizedException("Invalid admin token");
    const payload = parseBase64UrlJson<SessionPayload>(payloadPart);
    if (payload.exp < Date.now())
      throw new UnauthorizedException("Admin token expired");
    return payload.sub;
  }

  /** Refresh a valid token without reusing the public refresh token path.
   * 刷新有效登录态，不复用公开 refresh token 方案。 */
  refresh(token: string | undefined) {
    const username = this.verifyToken(token);
    const now = Date.now();
    const payload: SessionPayload = {
      sub: username,
      iat: now,
      exp: now + TOKEN_TTL_MS,
    };
    return {
      token: this.sign(payload),
      expiresAt: new Date(payload.exp).toISOString(),
      user: { username },
    };
  }

  private verifyPassword(password: string, encodedHash: string) {
    const [algorithm, iterationsValue, salt, expected] = encodedHash.split("$");
    if (algorithm !== "pbkdf2" || !iterationsValue || !salt || !expected)
      return false;
    const iterations = Number(iterationsValue);
    if (!Number.isInteger(iterations) || iterations < 100_000) return false;
    const actual = crypto
      .pbkdf2Sync(password, salt, iterations, 32, "sha256")
      .toString("hex");
    return timingSafeEqualText(actual, expected);
  }

  private sign(payload: SessionPayload) {
    const payloadPart = base64Url(JSON.stringify(payload));
    return `${payloadPart}.${this.signature(payloadPart)}`;
  }

  private signature(payloadPart: string) {
    return crypto
      .createHmac("sha256", this.secret)
      .update(payloadPart)
      .digest("base64url");
  }
}
