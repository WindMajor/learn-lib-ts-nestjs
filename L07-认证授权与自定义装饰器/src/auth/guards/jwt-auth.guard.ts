import { Injectable } from "@nestjs/common";
import { AuthGuard } from "@nestjs/passport";

/**
 * WHAT: JwtAuthGuard——基于 Passport JWT 策略的认证守卫
 *
 * 【核心原理——AuthGuard('jwt') 做了什么】
 *   1. 读取请求中的 Authorization: Bearer <token>
 *   2. 用 JwtStrategy 验证 token：
 *      - 解码 → 验证签名 → 检查过期 → 调用 validate()
 *   3. validate() 的返回值赋值给 request.user
 *   4. 如果 token 无效 → 自动返回 401 Unauthorized
 *
 *   【对比 Passport.js 在 Express 中的使用】
 *     // Express
 *     app.get('/profile', passport.authenticate('jwt', { session: false }), (req, res) => {
 *       res.json(req.user);
 *     });
 *
 *     // NestJS
 *     @UseGuards(JwtAuthGuard)
 *     @Get('profile')
 *     getProfile(@CurrentUser() user) { return user; }
 *
 *     NestJS 用装饰器语法糖 + Guard 模式封装了 Passport——
 *     更声明式、更可组合（可以和其他 Guard 一起使用）
 *
 * 【对比 Spring Security】
 *   Spring 的 JwtAuthenticationFilter 自动保护所有端点，
 *   然后通过 .permitAll() 放行特定端点。
 *   NestJS 的 Guard 默认不保护任何端点——需要手动 @UseGuards() 绑定。
 *   这个差异体现了两种框架的安全哲学：Spring 默认安全，NestJS 默认开放。
 *
 * WARNING:
 *   - 确保 JwtStrategy 在 providers 中注册（AuthModule 中）
 *   - JWT Secret 必须通过环境变量注入——不要硬编码
 */
@Injectable()
export class JwtAuthGuard extends AuthGuard("jwt") {}
