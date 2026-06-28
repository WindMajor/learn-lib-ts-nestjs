import { Module } from "@nestjs/common";
import { JwtModule } from "@nestjs/jwt";
import { PassportModule } from "@nestjs/passport";
import { JwtStrategy } from "./jwt.strategy";
import { AuthService } from "./auth.service";
import { AuthController } from "./auth.controller";

/**
 * WHAT: AuthModule——认证授权模块
 *
 * 【核心配置】
 *   PassportModule: 注册 Passport 的 JWT 策略
 *   JwtModule.register({...}): 配置 JWT 签发（密钥 + 过期时间）
 *
 * 【对比 Spring Security】
 *   Spring 的认证配置更复杂（SecurityFilterChain Bean），
 *   但 NestJS 的 AuthModule 已经足够清晰——每个配置项都有明确的含义。
 */
@Module({
  imports: [
    PassportModule.register({ defaultStrategy: "jwt" }),
    JwtModule.register({
      secret: process.env.JWT_SECRET || "dev-secret",
      signOptions: { expiresIn: process.env.JWT_EXPIRES_IN || "7d" },
    }),
  ],
  controllers: [AuthController],
  providers: [AuthService, JwtStrategy],
  exports: [AuthService, JwtModule],
})
export class AuthModule {}
