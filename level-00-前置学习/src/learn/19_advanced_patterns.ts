/**
 * ============================================================
 * 第 19 章：进阶模式与自定义能力
 * ============================================================
 *
 * 【学习目标】
 *   1. 掌握自定义装饰器：组合装饰器和自定义参数装饰器
 *   2. 了解微服务概念：@nestjs/microservices 的传输层
 *   3. 了解 GraphQL 简介：@nestjs/graphql 与 REST 的对比
 *   4. 掌握完整的生命周期钩子使用
 *   5. 理解进阶架构模式
 *
 * 【与 Express/FastAPI/Spring/Django 的对比提示】
 *   - Express：自定义中间件函数作为装饰器的替代
 *   - FastAPI：Depends 组合与自定义依赖
 *   - Spring：自定义注解（@Target + @Retention）+ Spring Cloud 微服务
 *   - Django：自定义装饰器 + Django REST Framework 扩展
 *
 * 【与 Vue3 前端的协作关系】
 *   - 自定义装饰器 = Vue3 中自定义 Composable 函数（封装重复逻辑）
 *   - 组合装饰器 = Vue3 中的组合式 API（多个 composable 组合使用）
 *   - GraphQL = 前端灵活查询的替代方案
 */

import {
  Injectable,
  OnModuleInit,
  OnApplicationBootstrap,
  OnModuleDestroy,
  BeforeApplicationShutdown,
  OnApplicationShutdown,
  createParamDecorator,
  ExecutionContext,
  SetMetadata,
  UseGuards,
  applyDecorators,
  Controller,
  Get,
  Module,
} from '@nestjs/common';

// ============================================================
// 示例 1：组合装饰器（减少重复代码）
// ============================================================

/**
 * 【场景】将多个经常一起使用的装饰器合并为一个
 *        如 @Auth() = @UseGuards(JwtAuthGuard) + @Roles('ADMIN')
 * 【语法点】applyDecorators() 函数组合多个装饰器
 * 【NestJS 设计意图】装饰器组合是声明式编程的高级形式，
 *                   减少模板代码，提高可读性和一致性
 */

// 定义 @Auth() 组合装饰器
const Auth = (...roles: string[]): MethodDecorator & ClassDecorator => {
  return applyDecorators(
    SetMetadata('roles', roles), // 设置角色元数据
    // UseGuards(JwtAuthGuard, RolesGuard), // 应用多个守卫
    // ApiBearerAuth(),                      // Swagger Bearer Token 认证
    // ApiForbiddenResponse({ description: '权限不足' }),
  );
};

// 定义 @Public() 装饰器（标记公开路由，跳过 JWT 验证）
const IS_PUBLIC_KEY = 'isPublic';
const Public = (): MethodDecorator & ClassDecorator => {
  return applyDecorators(
    SetMetadata(IS_PUBLIC_KEY, true),
    // 可以添加其他公开路由特定的配置
  );
};

// 使用组合装饰器
@Controller('admin')
class AdminController {
  // 需要 ADMIN 角色（组合了多个装饰器的职责）
  @Auth('ADMIN')
  @Get('dashboard')
  public dashboard(): string {
    return '管理员仪表盘';
  }

  // 需要 USER 或 ADMIN 角色
  @Auth('USER', 'ADMIN')
  @Get('reports')
  public reports(): string {
    return '报表';
  }

  // 公开路由
  @Public()
  @Get('public')
  public publicInfo(): string {
    return '公开信息';
  }
}

// ============================================================
// 示例 2：自定义参数装饰器 —— @User()
// ============================================================

/**
 * 【场景】从请求中提取当前登录用户信息
 *        @User() 提取整个用户对象，@User('id') 提取用户 ID
 * 【语法点】createParamDecorator((data, ctx) => ...)
 * 【NestJS 设计意图】参数装饰器是 Request 到 Controller 参数的类型安全桥梁
 *                   与 @Body()、@Param() 一样，@User() 让 Controller 参数声明更语义化
 */

interface UserPayload {
  id: number;
  email: string;
  role: 'USER' | 'EDITOR' | 'ADMIN';
}

interface AuthenticatedRequest extends Request {
  user: UserPayload;
}

// 自定义 @User() 参数装饰器
const User = createParamDecorator(
  (data: keyof UserPayload | undefined, ctx: ExecutionContext): UserPayload => {
    const request = ctx.switchToHttp().getRequest<AuthenticatedRequest>();
    const user: UserPayload = request.user;

    // 如果指定了字段名，返回该字段的值
    if (data) {
      return user[data] as unknown as UserPayload;
    }

    // 否则返回整个用户对象
    return user;
  },
);

// 使用自定义参数装饰器
@Controller('profile')
class ProfileController {
  /**
   * 获取当前用户完整信息
   * @User() 自动从 JWT Guard 附加的 request.user 中提取
   */
  @Get()
  public getProfile(@User() user: UserPayload): UserPayload {
    return user;
  }

  /**
   * 只获取当前用户 ID
   */
  @Get('id')
  public getUserId(@User('id') userId: number): { userId: number } {
    return { userId };
  }

  /**
   * 获取当前用户角色
   */
  @Get('role')
  public getUserRole(@User('role') role: string): { role: string } {
    return { role };
  }
}

// ============================================================
// 示例 3：微服务概念简述（@nestjs/microservices）
// ============================================================

/**
 * 【场景】了解 NestJS 微服务的传输层概念
 * 【核心概念】
 *   微服务 = 独立运行的 NestJS 应用，通过消息队列通信
 *
 * 支持的传输层：
 *   - TCP：简单直连（适合开发调试）
 *   - Redis：发布/订阅模式
 *   - RabbitMQ：AMQP 协议（生产推荐）
 *   - Kafka：高吞吐流处理
 *   - gRPC：高性能 RPC
 *   - MQTT：IoT 场景
 *
 * 架构模式：
 *   Hybrid App：同一应用既是 HTTP 服务又是微服务
 *   Request-Response：同步请求-响应模式
 *   Event-Based：异步事件驱动（EventEmitter）
 */

// 微服务基本使用模式（注释）
/*
// 主应用（HTTP + 微服务混合）
const app = await NestFactory.create(AppModule);
const microservice = app.connectMicroservice<MicroserviceOptions>({
  transport: Transport.REDIS,
  options: { host: 'localhost', port: 6379 },
});
await app.startAllMicroservices();
await app.listen(3000);

// 消息处理器（Controller 的微服务版本）
@Controller()
class MathController {
  @MessagePattern({ cmd: 'sum' })  // 处理消息
  accumulate(data: number[]): number {
    return data.reduce((a, b) => a + b, 0);
  }
}

// 客户端调用
@Injectable()
class ClientService {
  constructor(@Inject('MATH_SERVICE') private client: ClientProxy) {}

  async sum(numbers: number[]): Promise<number> {
    return firstValueFrom(this.client.send({ cmd: 'sum' }, numbers));
  }
}
*/

// ============================================================
// 示例 4：GraphQL 简介（@nestjs/graphql）
// ============================================================

/**
 * 【场景】了解 GraphQL 在 NestJS 中的位置
 * 【对比 REST】
 *   - REST：固定端点返回固定结构，多端点获取关联数据需要多次请求
 *   - GraphQL：单一端点，客户端指定需要的字段和关联
 *   - REST 适合：简单 CRUD、文件上传、第三方 API
 *   - GraphQL 适合：复杂关联查询、移动端（节省流量）、前端频繁变化的 UI
 *
 * NestJS 支持两种方式：
 *   1. Code First：用 TypeScript 装饰器定义 Schema（推荐）
 *   2. Schema First：先写 .graphql 文件，再实现 Resolver
 */

// Code First 模式（注释示例）
/*
import { ObjectType, Field, Int, Resolver, Query } from '@nestjs/graphql';

// GraphQL 类型定义（自动生成 Schema）
@ObjectType()
class UserGql {
  @Field(() => Int)
  id: number;

  @Field()
  name: string;

  @Field()
  email: string;
}

// Resolver（GraphQL 版本的 Controller）
@Resolver(() => UserGql)
class UsersResolver {
  constructor(private readonly usersService: UsersService) {}

  @Query(() => [UserGql])
  async users(): Promise<UserGql[]> {
    return this.usersService.findAll();
  }
}
// 前端查询：{ users { id name email } }  ← 只返回需要的字段
*/

// ============================================================
// 示例 5：完整的生命周期钩子使用
// ============================================================

/**
 * 【场景】利用 NestJS 生命周期钩子在正确的时机执行初始化/清理
 * 【语法点】OnModuleInit、OnApplicationBootstrap、OnModuleDestroy、
 *          BeforeApplicationShutdown、OnApplicationShutdown
 * 【NestJS 设计意图】声明式生命周期管理，让开发者专注于"做什么"而非"何时做"
 * 【执行顺序】
 *   1. 模块按照依赖顺序初始化（OnModuleInit）
 *   2. 所有模块初始化完毕后（OnApplicationBootstrap）
 *   3. 应用正常运行中…
 *   4. 收到关闭信号（BeforeApplicationShutdown）
 *   5. 模块按照依赖顺序逆序销毁（OnModuleDestroy）
 *   6. 完全关闭（OnApplicationShutdown）
 */

@Injectable()
class LifecycleDemoService
  implements
    OnModuleInit,
    OnApplicationBootstrap,
    OnModuleDestroy,
    BeforeApplicationShutdown,
    OnApplicationShutdown
{
  // 1. 模块初始化后 —— 连接数据库、加载配置
  public async onModuleInit(): Promise<void> {
    console.log('[Lifecycle] 1. OnModuleInit: 模块初始化完成');
    // 典型用途：await this.drizzle.onModuleInit(); // 连接数据库
    //          await this.cacheService.connect();
  }

  // 2. 应用启动后 —— 预热缓存、加载默认数据
  public async onApplicationBootstrap(): Promise<void> {
    console.log('[Lifecycle] 2. OnApplicationBootstrap: 应用启动完毕');
    // 典型用途：await this.cacheService.warmUp();
    //          预加载常用数据到 Redis
  }

  // 3. 应用关闭前（收到 SIGTERM/SIGINT） —— 等待当前请求完成
  public async beforeApplicationShutdown(signal?: string): Promise<void> {
    console.log(`[Lifecycle] 3. BeforeApplicationShutdown: 收到信号 ${signal}`);
    // 典型用途：等待正在处理的请求完成（优雅关闭）
    // await new Promise(resolve => setTimeout(resolve, 5000));
  }

  // 4. 模块销毁 —— 断开数据库连接
  public async onModuleDestroy(): Promise<void> {
    console.log('[Lifecycle] 4. OnModuleDestroy: 模块销毁');
    // 典型用途：await this.drizzle.onModuleDestroy(); // 断开数据库连接
    //          await this.redis.quit();
  }

  // 5. 应用完全关闭
  public async onApplicationShutdown(signal?: string): Promise<void> {
    console.log(`[Lifecycle] 5. OnApplicationShutdown: 应用关闭 (${signal})`);
    // 典型用途：最终清理、发送关闭通知
  }
}

// ============================================================
// 示例 6：自定义全局装饰器模块
// ============================================================

/**
 * 【场景】将自定义装饰器组织成一个模块，供其他模块使用
 * 【语法点】@Module 封装装饰器逻辑和相关服务
 * 【NestJS 设计意图】自定义装饰器及其相关逻辑应该封装为模块，保持可复用性
 */

@Module({
  providers: [
    // 自定义装饰器不需要注册为 Provider（它们是函数/装饰器）
    // 但装饰器依赖的服务需要注册
  ],
  exports: [
    // 导出装饰器依赖的服务
  ],
})
class CustomDecoratorsModule {}

// 在实际项目中，自定义装饰器通常放在 common/decorators/ 目录下
// 结构示例：
// common/
//   decorators/
//     auth.decorator.ts     ← @Auth() 组合装饰器
//     user.decorator.ts     ← @User() 参数装饰器
//     public.decorator.ts   ← @Public() 公开路由装饰器
//     roles.decorator.ts    ← @Roles() 角色装饰器
//   guards/
//     roles.guard.ts
//   index.ts               ← 统一导出

// ============================================================
// ❌ 常见错误 1：自定义装饰器未在模块中正确注册
// ============================================================

/**
 * 【错误现象】自定义参数装饰器返回 undefined
 * 【错误原因】装饰器依赖的 Guard（如 JwtAuthGuard）未应用，
 *            或者自定义装饰器依赖的运行时服务未注册到 DI 容器
 * 【正确写法】确保自定义装饰器依赖的 Guard 已应用，相关服务已注册
 */

// ❌ 错误：
// @UseGuards(SomeGuard)  // 忘记应用 Guard
// getProfile(@User() user) {}  // user 为 undefined

// ✅ 正确：
// @UseGuards(JwtAuthGuard)  // JwtAuthGuard 将 user 附加到 request
// getProfile(@User() user: UserPayload) {}  // user 是完整对象

// ============================================================
// ❌ 常见错误 2：生命周期钩子内阻塞启动
// ============================================================

/**
 * 【错误现象】应用启动非常慢，一直卡在某个步骤
 * 【错误原因】OnModuleInit 或 OnApplicationBootstrap 中有长时间运行的同步/异步操作
 *            OnModuleInit 是串行执行的，一个模块阻塞会影响所有模块
 * 【正确写法】耗时初始化操作使用异步 + 超时保护，或延迟到第一次使用时初始化
 */

// ❌ 错误：
// async onModuleInit() {
//   await heavyComputationSync();  // 10 秒的同步操作
// }

// ✅ 正确：
// async onModuleInit() {
//   // 1. 使用超时保护
//   const timeout = setTimeout(() => this.fallbackInit(), 10000);
//   await connect();
//   clearTimeout(timeout);
//
//   // 2. 或延迟初始化（Lazy Init）
//   this.markNeedsInit = true;  // 在第一次使用时再初始化
// }

// ============================================================
// ❌ 常见错误 3：组合装饰器顺序错误
// ============================================================

/**
 * 【错误现象】组合装饰器中某个装饰器不生效或行为不符合预期
 * 【错误原因】applyDecorators 中的装饰器执行顺序与预期不符
 *            装饰器按从下到上（靠近被装饰元素的先执行）的顺序执行
 * 【正确写法】了解 NestJS 装饰器执行顺序，正确排列组合顺序
 */

// applyDecorators 中的装饰器从右到左执行
// @Auth('ADMIN')
//   展开为：
//   @SetMetadata('roles', ['ADMIN'])
//   @UseGuards(JwtAuthGuard, RolesGuard)  ← 先执行 JwtAuthGuard，再执行 RolesGuard
//   @ApiBearerAuth()  ← 最后执行

// ✅ 正确组合：
// const Auth = (...roles: string[]) => {
//   return applyDecorators(
//     SetMetadata('roles', roles),   // 先设置元数据（最先执行）
//     UseGuards(JwtAuthGuard, RolesGuard),  // 中间执行守卫
//     ApiBearerAuth(),               // 最后执行 ApiBearerAuth（Swagger 装饰器）
//   );
// };

console.log('=== 第 19 章示例代码结束 ===');

// ============================================================
// 本章小结
// ============================================================
/*
 * 【核心要点】
 *   - 组合装饰器（applyDecorators）减少重复的装饰器声明
 *   - 自定义参数装饰器（createParamDecorator）让 Controller 参数更语义化
 *   - 微服务通过消息队列（TCP/Redis/RabbitMQ/Kafka）通信
 *   - GraphQL 是 REST 的替代方案，Code First 模式以 TypeScript 为中心
 *   - 生命周期钩子：OnModuleInit → OnApplicationBootstrap → 运行 → BeforeApplicationShutdown → OnModuleDestroy → OnApplicationShutdown
 *   - 自定义装饰器应放在 common/decorators/ 目录下
 *
 * 【与前后章的关联】
 *   - 第 09 章：@Auth() 组合了 JwtAuthGuard 和 RolesGuard
 *   - 第 01-20 章：自定义装饰器减少了全书各章的样板代码
 *   - 第 20 章：综合实战会组合使用自定义装饰器
 *
 * 【常见面试题】
 *   Q: 什么是微服务？NestJS 如何支持微服务架构？
 *   A: 微服务是将单体应用拆分为多个独立服务，通过消息通信。
 *      NestJS 通过 @nestjs/microservices 支持多种传输层（TCP/Redis/RabbitMQ/Kafka），
 *      @MessagePattern 处理消息，ClientProxy 发送消息。
 *
 *   Q: REST 和 GraphQL 的区别？何时选择哪个？
 *   A: REST：固定端点，适合简单 CRUD、缓存友好；
 *      GraphQL：灵活查询，前端按需取数据，减少 over-fetching；
 *      选择：API 稳定且客户端少 → REST；前端频繁变化且需要灵活查询 → GraphQL。
 */
// ============================================================
// 🎯 通关检查清单
// ============================================================
/*
 * [ ] 能手写一个组合装饰器（如 @Auth()）
 * [ ] 能手写一个自定义参数装饰器（如 @User()）
 * [ ] 能列举 NestJS 支持的微服务传输层（至少 3 种）
 * [ ] 能说出 REST 和 GraphQL 的一个关键差异
 * [ ] 能指出 1 个常见错误及修复方法
 */
