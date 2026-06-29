import { SetMetadata, CustomDecorator } from "@nestjs/common";

/**
 * WHAT: @Roles() 自定义装饰器——标记接口所需的角色
 *
 * 【核心原理——SetMetadata 的底层机制】
 *   SetMetadata('roles', ['admin']) 调用 Reflect.defineMetadata('roles', ['admin'], target)
 *   元数据保存在函数的 Reflect 存储中，后续 Guard 通过 Reflector 读取
 *
 * 【对比 Spring Security】
 *   @PreAuthorize("hasRole('ADMIN')")  —— 更灵活（支持 SpEL 表达式）
 *   @Roles('admin')  —— 更简单但不如 SpEL 灵活
 *
 *   NestJS 的 @Roles() 需要自己实现 Guard 来读取元数据，
 *   而 Spring 的 @PreAuthorize 直接由框架解释。这是有意为之——
 *   NestJS 给你更多的控制权，但不提供开箱即用的 RBAC。
 */
export const ROLES_KEY = "roles";
export const Roles = (...roles: string[]): CustomDecorator<string> =>
  SetMetadata(ROLES_KEY, roles);
