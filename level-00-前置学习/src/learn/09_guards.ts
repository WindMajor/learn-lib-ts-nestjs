/**
 * ============================================================
 * 第 09 章：守卫与权限控制
 * ============================================================
 *
 * 【学习目标】
 *   1. 理解守卫的本质：决定请求是否被允许通过（返回 true/false）
 *   2. 掌握 CanActivate 接口和 ExecutionContext 的使用
 *   3. 掌握 @SetMetadata() + Reflector 实现声明式角色权限
 *   4. 理解 JWT Guard 的工作流程
 *   5. 掌握守卫 vs 中间件的区别：守卫能访问 DI 容器和反射元数据
 *
 * 【与 Express/FastAPI/Spring/Django 的对比提示】
 *   - Express：通常用中间件做鉴权（req, res, next → res.status(401)）
 *   - FastAPI：Depends 函数 + HTTPBearer 与 Guard 概念相似
 *   - Spring：Spring Security 的 Filter Chain + @PreAuthorize("hasRole('ADMIN')")
 *   - Django：Permission Classes + @permission_classes 装饰器
 *
 * 【与 Vue3 前端的协作关系】
 *   - 守卫 = Vue Router 的 beforeEach 导航守卫（决定能否进入路由）
 *   - @Roles('admin') = Vue3 路由 meta: { roles: ['admin'] }
 *   - 前端路由守卫阻止 UI 跳转，后端守卫阻止 API 调用 —— 双重保护
 */

import {
  Injectable,
  CanActivate,
  ExecutionContext,
  SetMetadata,
  UseGuards,
  Global,
  Module,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import { Observable } from 'rxjs';

// ============================================================
// 示例 1：守卫基础 —— 实现 CanActivate 接口
// ============================================================

/**
 * 【场景】最简守卫：检查请求头中是否有 Authorization Header
 * 【语法点】实现 CanActivate 接口，返回 boolean | Promise<boolean> | Observable<boolean>
 * 【NestJS 设计意图】守卫是一种「二进制决策」——请求能通过或不能通过
 *                   与中间件不同，守卫有完整的 DI 容器支持
 * 【ExecutionContext】比 ArgumentsHost 更强大，能获取 Class（控制器）和 Handler（方法）的引用
 */
@Injectable()
class SimpleAuthGuard implements CanActivate {
  public canActivate(context: ExecutionContext): boolean {
    const request: Request = context.switchToHttp().getRequest<Request>();
    const authHeader: string | undefined = request.headers['authorization'];

    if (!authHeader) {
      // 守卫返回 false，NestJS 自动响应 403 Forbidden
      console.log('没有 Authorization Header，拒绝访问');
      return false;
    }

    return true; // 允许通过
  }
}

// ============================================================
// 示例 2：ExecutionContext 深度使用
// ============================================================

/**
 * 【场景】守卫需要知道是哪个 Controller 的哪个方法被调用
 * 【语法点】context.getClass() 获取 Controller 类，context.getHandler() 获取方法引用
 * 【NestJS 设计意图】ExecutionContext 提供完整的调用上下文，
 *                   让守卫能根据目标类/方法做出决策
 */
@Injectable()
class ExecutionContextDemoGuard implements CanActivate {
  public canActivate(context: ExecutionContext): boolean {
    // 获取目标 Controller 类
    const controllerClass = context.getClass();
    const controllerName: string = controllerClass.name;
    console.log(`守卫：拦截 Controller "${controllerName}"`);

    // 获取目标方法
    const handler = context.getHandler();
    const methodName: string = handler.name;
    console.log(`守卫：拦截方法 "${methodName}"`);

    // 获取 HTTP 请求对象
    const request: Request = context.switchToHttp().getRequest<Request>();
    console.log(`守卫：请求路径 ${request.method} ${request.url}`);

    return true;
  }
}

// ============================================================
// 示例 3：JWT 认证 Guard（核心示例）
// ============================================================

/**
 * 【场景】验证 JWT Token，提取用户信息并附加到 request 上
 * 【语法点】注入 JwtService，解析 Token，将用户信息挂到 request.user
 * 【NestJS 设计意图】Guard 可以操作 request 对象（如附加 user），
 *                   下游的 Controller 和 Service 可以直接使用 request.user
 */

// 模拟 JwtService（实际来自 @nestjs/jwt）
interface JwtPayload {
  sub: number; // 用户 ID
  email: string;
  role: 'USER' | 'EDITOR' | 'ADMIN';
  iat: number; // 签发时间
  exp: number; // 过期时间
}

interface AttachedUser {
  id: number;
  email: string;
  role: 'USER' | 'EDITOR' | 'ADMIN';
}

@Injectable()
class MockJwtService {
  public verify(token: string): JwtPayload {
    // 实际使用 jsonwebtoken 库的 verify 方法
    // 此处简化：假设 Token 合法
    return {
      sub: 1,
      email: 'user@example.com',
      role: 'USER',
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + 604800,
    };
  }
}

// 扩展 Express Request 类型（实际放在 types/express.d.ts 中）
interface AuthenticatedRequest extends Request {
  user: AttachedUser;
}

@Injectable()
class JwtAuthGuard implements CanActivate {
  constructor(private readonly jwtService: MockJwtService) {}

  public canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const token: string | undefined = this.extractTokenFromHeader(request);

    if (!token) {
      // 可以抛出 UnauthorizedException 而不是返回 false，
      // 这样能提供更友好的错误信息
      return false;
    }

    try {
      const payload: JwtPayload = this.jwtService.verify(token);

      // 将用户信息附加到 request 上（下游可用 @Req() 获取）
      request.user = {
        id: payload.sub,
        email: payload.email,
        role: payload.role,
      };

      return true;
    } catch (error) {
      console.error('Token 验证失败:', error);
      return false;
    }
  }

  private extractTokenFromHeader(request: Request): string | undefined {
    const authHeader: string | undefined = request.headers['authorization'];
    if (!authHeader) return undefined;

    const [type, token] = authHeader.split(' ');
    return type === 'Bearer' ? token : undefined;
  }
}

// ============================================================
// 示例 4：@SetMetadata() + Reflector 实现角色权限（RBAC 核心）
// ============================================================

/**
 * 【场景】声明式角色控制：@Roles('admin') 装饰器 + RolesGuard
 * 【语法点】@SetMetadata() 存储元数据，Reflector 读取元数据
 * 【NestJS 设计意图】元数据是 Guard 的核心能力——让装饰器成为 Guard 的"配置语言"
 *                   这与 Spring Security 的 @PreAuthorize 理念完全一致
 */

// 1. 定义角色元数据的 Key（使用 Symbol 避免冲突）
const ROLES_KEY = 'roles';

// 2. 创建 @Roles() 装饰器（组合 @SetMetadata）
const Roles = (...roles: string[]): MethodDecorator & ClassDecorator => {
  return SetMetadata(ROLES_KEY, roles);
};

// 3. 创建 RolesGuard
@Injectable()
class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  public canActivate(context: ExecutionContext): boolean {
    // 从目标方法和目标类上读取 @Roles() 设置的元数据
    // getAllAndOverride: 方法级 > 类级（方法级覆盖类级）
    const requiredRoles: string[] | undefined =
      this.reflector.getAllAndOverride<string[]>(ROLES_KEY, [
        context.getHandler(),
        context.getClass(),
      ]);

    // 如果没有 @Roles() 装饰器，说明不需要角色权限，直接放行
    if (!requiredRoles || requiredRoles.length === 0) {
      return true;
    }

    // 从 JwtAuthGuard 附加的 user 中获取角色
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const user: AttachedUser = request.user;

    if (!user) {
      return false; // 需要角色但没有用户信息
    }

    // 检查用户角色是否在允许的角色列表中
    return requiredRoles.some((role: string) => user.role === role);
  }
}

// 4. 使用示例
class GuardDemoController {
  // 任何人都能访问（没有 @Roles）
  public getPublicData(): string {
    return '公开数据';
  }

  // 只有管理员能访问
  @Roles('ADMIN')
  @UseGuards(JwtAuthGuard, RolesGuard) // 多个 Guard 按从左到右顺序执行
  public getAdminData(): string {
    return '管理员数据';
  }

  // EDITOR 或 ADMIN 角色能访问（方法级覆盖类级）
  @Roles('EDITOR', 'ADMIN')
  public managePosts(): string {
    return '文章管理';
  }
}

// ============================================================
// 示例 5：守卫组合与全局守卫
// ============================================================

/**
 * 【场景】组合多个守卫、全局注册守卫
 * 【语法点】@UseGuards(Guard1, Guard2) 顺序执行
 *          APP_GUARD Token 注册全局守卫
 * 【NestJS 设计意图】守卫是可以堆叠的——每个守卫只关注一个职责
 */

// 守卫 1：检查 IP 白名单
@Injectable()
class IpWhitelistGuard implements CanActivate {
  private readonly allowedIps: Set<string> = new Set([
    '127.0.0.1',
    '::1',
    '::ffff:127.0.0.1',
  ]);

  public canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<Request>();
    const ip: string =
      (request.ip ?? '') || (request.socket.remoteAddress ?? '');

    if (!this.allowedIps.has(ip)) {
      console.log(`IP ${ip} 不在白名单中`);
      return false;
    }

    return true;
  }
}

// 守卫 2：检查 Content-Type
@Injectable()
class ContentTypeGuard implements CanActivate {
  public canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<Request>();
    const contentType: string | undefined = request.headers['content-type'];

    // 对于 POST/PUT/PATCH，如果不需要 JSON 格式，可以在这里检查
    return true;
  }
}

// 守卫 3：API Key 验证（服务间调用）
@Injectable()
class ApiKeyGuard implements CanActivate {
  public canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<Request>();
    const apiKey: string | undefined = request.headers['x-api-key'] as
      | string
      | undefined;

    return apiKey === process.env['API_KEY'];
  }
}

// 组合使用多个守卫
@UseGuards(
  IpWhitelistGuard, // 先检查 IP
  ApiKeyGuard, // 再检查 API Key
  JwtAuthGuard, // 最后验证 JWT
)
class MultiGuardController {}

// 全局注册守卫（适用于需要所有路由都验证 JWT 的场景）
@Global()
@Module({
  providers: [
    // { provide: APP_GUARD, useClass: JwtAuthGuard },
  ],
})
class GlobalGuardModule {}

// ============================================================
// 示例 6：异步 Guard（数据库查询权限）
// ============================================================

/**
 * 【场景】需要查询数据库才能判断权限（如检查资源所有权）
 * 【语法点】canActivate 返回 Promise<boolean>，NestJS 自动等待
 * 【NestJS 设计意图】守卫支持异步操作，权限检查可能需要数据库查询
 */

@Injectable()
class OwnershipGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  public async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const user: AttachedUser = request.user;

    // 管理员可以跳过所有权检查
    if (user.role === 'ADMIN') {
      return true;
    }

    // 从路径参数中获取资源 ID
    const paramId = request.params['id'];
    const resourceId: string =
      typeof paramId === 'string'
        ? paramId
        : Array.isArray(paramId)
          ? (paramId[0] ?? '')
          : '';
    if (!resourceId) {
      return false;
    }

    // 查询资源的所有者（模拟异步数据库查询）
    const resource = await this.findResourceById(parseInt(resourceId, 10));
    if (!resource) {
      return false;
    }

    // 判断当前用户是否是资源的所有者
    return resource.ownerId === user.id;
  }

  private async findResourceById(
    id: number,
  ): Promise<{ ownerId: number } | null> {
    // 模拟数据库查询
    return new Promise<{ ownerId: number } | null>((resolve) => {
      setTimeout(() => {
        resolve({ ownerId: 1 });
      }, 100);
    });
  }
}

// ============================================================
// ❌ 常见错误 1：忘记在 Controller 上应用 @UseGuards()
// ============================================================

/**
 * 【错误现象】Guard 定义好了但不生效，未登录用户也能访问
 * 【错误原因】创建了 Guard 类但忘记用 @UseGuards() 装饰控制器或方法
 * 【正确写法】@UseGuards() 可以用于类级别或方法级别
 */

// ❌ 错误写法：
// class UsersController {
//   @Get()  // 忘记 @UseGuards(JwtAuthGuard)
//   findAll() { return []; }
// }

// ✅ 正确写法（类级别）：
// @UseGuards(JwtAuthGuard)  // 保护所有方法
// class UsersController { ... }

// ✅ 正确写法（方法级别）：
// class UsersController {
//   @Get()
//   @UseGuards(JwtAuthGuard)  // 只保护这个方法
//   findAll() { return []; }
// }

// ============================================================
// ❌ 常见错误 2：Guard 内抛出异常未正确处理
// ============================================================

/**
 * 【错误现象】Guard 返回 false 只收到默认 403，没有自定义错误信息
 * 【错误原因】返回 false 时 NestJS 只触发默认的 ForbiddenException
 * 【正确写法】需要自定义错误信息时，在 Guard 中抛出特定的 HttpException
 */

// ❌ 错误写法（只返回 false，无法提供友好信息）：
// class SilentGuard implements CanActivate {
//   canActivate() {
//     return false;  // 客户端只收到 { statusCode: 403, message: 'Forbidden' }
//   }
// }

// ✅ 正确写法（抛出异常，提供详细信息）：
// import { UnauthorizedException, ForbiddenException } from '@nestjs/common';
// class VerboseGuard implements CanActivate {
//   canActivate(context: ExecutionContext) {
//     const request = context.switchToHttp().getRequest();
//     if (!request.headers.authorization) {
//       throw new UnauthorizedException('请先登录');  // 401
//     }
//     if (!hasPermission) {
//       throw new ForbiddenException('您没有权限执行此操作');  // 403
//     }
//     return true;
//   }
// }

// ============================================================
// ❌ 常见错误 3：元数据 Key 拼写不一致
// ============================================================

/**
 * 【错误现象】@Roles() 设置了角色但 RolesGuard 读取不到
 * 【错误原因】SetMetadata('role', ...) vs Reflector.get('roles', ...) Key 不一致
 * 【正确写法】使用常量或 Symbol 定义元数据 Key，避免魔法字符串
 */

// ❌ 错误写法：
// // 装饰器中
// SetMetadata('role', ['admin']);   // 单数
// // Guard 中
// reflector.get('roles', handler);   // 复数 → 读不到！

// ✅ 正确写法：
// const ROLES_KEY = Symbol('roles');  // 使用 Symbol 保证唯一性
// SetMetadata(ROLES_KEY, ['admin']);
// reflector.get(ROLES_KEY, handler);

console.log('=== 第 09 章示例代码结束 ===');

// ============================================================
// 本章小结
// ============================================================
/*
 * 【核心要点】
 *   - 守卫实现 CanActivate，返回 true/false 决定请求是否继续
 *   - ExecutionContext > ArgumentsHost：可获取 Class、Handler 和 Reflector
 *   - @SetMetadata() + Reflector 是 RBAC 的实现基础
 *   - JwtAuthGuard 验证 Token 并附加 user 到 request
 *   - RolesGuard 读取 @Roles() 元数据并与用户角色对比
 *   - 守卫支持异步（返回 Promise<boolean>）用于数据库权限查询
 *
 * 【与前后章的关联】
 *   - 第 08 章：Guard 功能上可以替代鉴权中间件，且更强大（有 DI + 元数据）
 *   - 第 10 章：Interceptor 不能做"拒绝访问"（返回 false），这是 Guard 的专属能力
 *   - 第 13 章：passport-jwt 实际工作方式就是本章 JwtAuthGuard 的完整实现
 *
 * 【常见面试题】
 *   Q: 守卫和中间件有什么区别？
 *   A: 1. 守卫在中间件之后执行
 *      2. 守卫能访问 DI 容器（注入 Service）和 Reflector（读取元数据）
 *      3. 守卫返回 true/false 控制是否放行，中间件通过 next() 控制
 *      4. 守卫知道调用的是哪个 Controller 和 Handler，中间件只知道 URL
 *
 *   Q: 如何实现基于角色的访问控制（RBAC）？
 *   A: 1. 定义 @Roles('admin') 装饰器（用 SetMetadata 存储角色）
 *      2. 实现 RolesGuard（用 Reflector 读取角色）
 *      3. 与 JwtAuthGuard 组合使用：先验证 Token，再检查角色
 */
// ============================================================
// 🎯 通关检查清单
// ============================================================
/*
 * [ ] 能手写一个简单的 CanActivate 守卫
 * [ ] 能实现 @Roles() + RolesGuard 的 RBAC 权限控制
 * [ ] 能解释 ExecutionContext 比 ArgumentsHost 多出的能力
 * [ ] 能说出 Guard 和 Middleware 的 3 个关键区别
 * [ ] 能指出 1 个常见错误及修复方法
 */
