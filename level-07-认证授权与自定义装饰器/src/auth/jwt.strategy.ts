/**
 * WHAT: JWT 策略——验证 JWT Token 并解析用户信息
 *
 * 【核心原理——Passport + NestJS 的集成方式】
 *   1. PassportStrategy(Strategy) 扩展 passport-jwt 的 Strategy 类
 *   2. super({...}) 配置 JWT 验证选项（从哪个 Header 提取、用哪个密钥验证）
 *   3. validate(payload) → 每次请求到达时调用，payload 是 JWT 解码后的内容
 *      - 返回的对象会注入到 request.user 中
 *      - 如果抛出异常 → Passport 自动返回 401 Unauthorized
 *
 * 【对比 Express 手动 JWT】
 *   // Express 手动实现
 *   app.use((req, res, next) => {
 *     const token = req.headers.authorization?.split(' ')[1];
 *     const payload = jwt.verify(token, secret);
 *     req.user = payload;
 *     next();
 *   });
 *   NestJS 用 Passport 封装——多了类型安全和与 Guards 的集成
 *
 * 【对比 Spring Security】
 *   Spring: JwtAuthenticationFilter extends OncePerRequestFilter
 *   同样是在请求到达 Controller 前解析 JWT，设置 SecurityContext
 *
 * 【对比 Go Gin】
 *   Go 用 middleware 手动解析 JWT：
 *     tokenString := c.GetHeader("Authorization")[7:]
 *     token, _ := jwt.Parse(tokenString, ...)
 *     c.Set("user", token.Claims)
 *   没有 NestJS 的 Strategy 抽象——Go 更直接
 *
 * WARNING:
 *   - secretOrKey 必须与签发 JWT 时使用的密钥一致
 *   - 如果密钥不一致 → Passport 返回 401 "invalid signature"
 *   - jwtFromRequest 有多种提取方式：ExtractJwt.fromAuthHeaderAsBearerToken() 是最常见的
 */
import { Injectable } from "@nestjs/common";
import { PassportStrategy } from "@nestjs/passport";
import { ExtractJwt, Strategy } from "passport-jwt";

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor() {
    super({
      // WHAT: 从 Authorization: Bearer <token> 中提取 JWT
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      // WHAT: 是否忽略过期检查——生产环境必须 false
      ignoreExpiration: false,
      // WHAT: 验证签名的密钥
      secretOrKey: process.env.JWT_SECRET || "dev-secret",
    });
  }

  /**
   * WHAT: 验证回调——Payload 是 JWT 解码后的内容
   *
   * 你可以在这做更多验证：
   * - 检查用户是否被禁用
   * - 从数据库加载完整用户信息（而非仅依赖 JWT payload）
   * - 检查 token 是否在黑名单中（用于登出）
   *
   * 返回值会被赋值给 request.user
   */
  async validate(payload: { sub: number; username: string; role: string }) {
    // 这里可以查数据库验证用户是否存在
    return {
      userId: payload.sub,
      username: payload.username,
      role: payload.role,
    };
  }
}
