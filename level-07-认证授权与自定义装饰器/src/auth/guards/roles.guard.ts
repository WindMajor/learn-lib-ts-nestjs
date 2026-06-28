import { Injectable, CanActivate, ExecutionContext } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { ROLES_KEY } from "../decorators/roles.decorator";

/**
 * WHAT: RolesGuard——基于 @Roles() 装饰器的授权守卫
 *
 * 【核心原理——Reflector 读取元数据】
 *   Reflector 是 NestJS 封装 Reflect.getMetadata() 的工具类。
 *   它能在 Guard/Interceptor/Filter 中读取：
 *   - 方法级的元数据（context.getHandler()）
 *   - 类级的元数据（context.getClass()）
 *
 *   决策逻辑：
 *   1. 读取方法上的 @Roles('admin') 元数据
 *   2. 如果没标 @Roles() → 放行（无角色限制）
 *   3. 检查 request.user.role 是否在所需角色列表中
 *   4. 匹配 → 放行，不匹配 → 返回 403
 *
 * 【对比 Spring Security】
 *   Spring: @PreAuthorize("hasRole('ADMIN')") + MethodSecurityInterceptor
 *   原理相同——"注解标记 + 切面拦截 + 权限判断"
 *
 * 【对比 Go】
 *   Go 没有注解/装饰器——通常用中间件 + 路由分组实现
 *   adminGroup := r.Group("/admin", AuthMiddleware(), RoleMiddleware("admin"))
 *   不如 NestJS 的装饰器方式灵活（无法方法级控制）
 */
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<string[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!requiredRoles || requiredRoles.length === 0) {
      return true;
    }

    const { user } = context.switchToHttp().getRequest();
    return requiredRoles.includes(user?.role);
  }
}
