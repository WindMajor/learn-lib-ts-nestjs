import { Injectable, UnauthorizedException } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";

/**
 * WHAT: AuthService——处理登录和 Token 签发
 *
 * 【JWT 签发的核心流程】
 *   1. 验证用户凭证（用户名/密码）
 *   2. 如果正确 → jwtService.sign(payload) 签发 Token
 *   3. 返回 Token 给前端
 *   4. 前端后续请求携带 Authorization: Bearer <token>
 *   5. JwtAuthGuard 自动验证 Token 并注入用户信息
 *
 * 【JWT Payload 的设计原则】
 *   - 不要放敏感信息（密码、手机号）——JWT 的 Payload 是 base64 编码，可以解码
 *   - 放用户标识（sub = userId）和权限角色
 *   - 签名（Signature）保证不可篡改，但不保证保密
 *
 * 【对比 Go】
 *   Go 的 JWT 签发：
 *   token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
 *   tokenString, _ := token.SignedString([]byte(secret))
 *   与 NestJS 的 jwtService.signAsync() 本质上一样
 *
 * 【对比 Rust (jsonwebtoken crate)】
 *   let token = encode(&Header::default(), &claims, &EncodingKey::from_secret(secret))?;
 *   Result<Token, Error>——Rust 的错误处理更严格
 */
@Injectable()
export class AuthService {
  constructor(private readonly jwtService: JwtService) {}

  /**
   * WHAT: 登录——验证用户并返回 JWT
   * 
   * 实际项目中这里应该：
   * 1. 查数据库验证用户名密码
   * 2. 使用 bcrypt 比对密码哈希（不做明文比较）
   */
  async login(username: string, password: string) {
    // 模拟用户验证（实际应用查数据库 + bcrypt）
    if (username === "admin" && password === "admin123") {
      const payload = { sub: 1, username: "admin", role: "admin" };
      return {
        access_token: await this.jwtService.signAsync(payload),
        user: payload,
      };
    }
    if (username === "user" && password === "user123") {
      const payload = { sub: 2, username: "user", role: "user" };
      return {
        access_token: await this.jwtService.signAsync(payload),
        user: payload,
      };
    }
    throw new UnauthorizedException("用户名或密码错误");
  }
}
