import {
  Injectable,
  CanActivate,
  ExecutionContext,
  Logger,
} from "@nestjs/common";
import { Observable } from "rxjs";

/**
 * WHAT: AuthGuard——简单的认证守卫（检查请求头中的 token）
 *
 * 【核心原理——CanActivate 接口】
 *   interface CanActivate {
 *     canActivate(context: ExecutionContext): boolean | Promise<boolean> | Observable<boolean>;
 *   }
 *
 *   - 返回 true → 请求继续（进入 Interceptor → Pipe → Controller）
 *   - 返回 false → NestJS 抛出 ForbiddenException（默认 403）
 *   - 也可以自己抛出异常（如 UnauthorizedException）
 *
 *   同步/异步都支持——取决于你的认证逻辑是否需要查数据库
 *
 * 【ExecutionContext 是什么？】
 *   它封装了当前请求的完整上下文：
 *   - switchToHttp():  获取 HTTP 请求的 Request/Response/Next
 *   - switchToRpc():   获取微服务调用上下文
 *   - switchToWs():    获取 WebSocket 上下文
 *   - getHandler():    获取当前处理函数（Controller 方法）
 *   - getClass():      获取当前 Controller 类
 *
 *   这种设计使得同一个 Guard 可以用于 HTTP/WebSocket/RPC 等多种传输层。
 *
 * 【对比 Express】
 *   Express 的认证中间件：
 *   app.use((req, res, next) => {
 *     if (!req.headers.authorization) return res.status(401).json({...});
 *     next();
 *   });
 *   NestJS 的 Guard 更结构化和可复用——可以绑定到特定 Controller/方法级别。
 *
 * 【对比 Spring Security】
 *   Spring Security 的 Filter Chain 更复杂（十多个过滤器链）。
 *   NestJS 的 Guard 简单直接——但这意味着你需要自己处理复杂场景。
 *
 * 【对比 Go Gin】
 *   func AuthMiddleware() gin.HandlerFunc {
 *     return func(c *gin.Context) {
 *       token := c.GetHeader("Authorization")
 *       if token == "" { c.AbortWithStatusJSON(401, ...); return }
 *       c.Next()
 *     }
 *   }
 *   与 NestJS Guard 的理念相同——拦截请求，检查条件，决定是否放行。
 *
 * WARNING:
 *   - Guard 在 Interceptor 之前执行！日志拦截器不会记录被 Guard 拒绝的请求
 *   - Guard 中抛出异常 → ExceptionFilter 会捕获（在最终的异常处理阶段）
 *   - 全局 Guard 先于方法级 Guard 执行
 */
@Injectable()
export class AuthGuard implements CanActivate {
  private readonly logger = new Logger(AuthGuard.name);

  canActivate(
    context: ExecutionContext,
  ): boolean | Promise<boolean> | Observable<boolean> {
    const request = context.switchToHttp().getRequest();
    const authHeader = request.headers.authorization;

    this.logger.log(`🔒 Guard: 检查认证 [Authorization: ${authHeader || "无"}]`);

    // 简化逻辑：有 token 就放行
    if (authHeader) {
      // 将解析后的用户信息存入 request（后续 Guard/Controller 可读取）
      request.user = { id: 1, name: "模拟用户", role: "user" };
      this.logger.log("✅ Guard: 认证通过");
      return true;
    }

    // 无 token → 拒绝访问（此处返回 false 即可，NestJS 自动转成 403）
    this.logger.warn("⛔ Guard: 认证失败——缺少 Authorization 头");
    return false;
  }
}

/**
 * WHAT: RoleGuard——基于角色的授权守卫
 *
 * 【核心原理——@SetMetadata + Reflector】
 *   这个 Guard 演示了 NestJS 的"元数据反射"机制：
 *   1. Controller 方法上用 @SetMetadata('roles', ['admin']) 标记所需角色
 *   2. Guard 中通过 Reflector 读取元数据
 *   3. 比较用户角色和所需角色 → 决定是否放行
 *
 *   【对比 Spring Security】
 *     Spring: @PreAuthorize("hasRole('ADMIN')")
 *     NestJS: @SetMetadata('roles', ['admin']) + RoleGuard
 *     差异：Spring 的注解直接驱动 SpEL 表达式，NestJS 需要手动实现 Guard
 *
 *   【高阶主题—Reflector 原理】
 *     Reflector 是 NestJS 对 Reflect.getMetadata() 的封装。
 *     当 @SetMetadata('roles', ['admin']) 装饰 Controller 方法时，
 *     实际调用 Reflect.defineMetadata('roles', ['admin'], handler)。
 *     RoleGuard 通过 reflector.get('roles', handler) 读取这个元数据。
 *
 *   Level 07 会详细展开自定义装饰器+Reflector 的完整用法。
 */
@Injectable()
export class RoleGuard implements CanActivate {
  private readonly logger = new Logger(RoleGuard.name);

  constructor(
    // WHAT: Reflector 是 NestJS 封装好的元数据读取工具
    private readonly reflector: Reflector,
  ) {}

  canActivate(context: ExecutionContext): boolean {
    // 读取方法上通过 @SetMetadata 设置的元数据
    const requiredRoles = this.reflector.get<string[]>(
      "roles",
      context.getHandler(),
    );

    // 如果没有设置角色要求 → 放行
    if (!requiredRoles || requiredRoles.length === 0) {
      this.logger.log("🔓 RoleGuard: 无角色要求，放行");
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const user = request.user;

    this.logger.log(
      `🔒 RoleGuard: 需要角色 [${requiredRoles}], 当前用户角色: ${user?.role}`,
    );

    // 检查用户是否有所需角色
    const hasRole = requiredRoles.includes(user?.role);
    if (hasRole) {
      this.logger.log("✅ RoleGuard: 角色验证通过");
    } else {
      this.logger.warn("⛔ RoleGuard: 角色不足——拒绝访问");
    }
    return hasRole;
  }
}
