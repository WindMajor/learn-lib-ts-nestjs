/**
 * ================================================================
 * BUG #02: 循环依赖未使用 forwardRef → 启动崩溃
 * ================================================================
 *
 * 【错误类型】运行期错误 —— NestJS 启动时抛出 CircularDependencyException 或 undefined Provider
 *
 * 【如何触发】
 *   将本文件内容导入到 NestJS 应用中运行 npm run start
 *
 * 【真实错误堆栈】
 *   Error: Nest cannot create the module instance.
 *   Often, this is because of a circular dependency between modules.
 *   Use forwardRef() to avoid it.
 *
 *   (Read more: https://docs.nestjs.com/fundamentals/circular-dependency)
 *
 *   Scope [AppModule -> UsersModule -> AuthModule -> UsersModule]
 *
 * 【为什么会这样】
 *   1. AppModule 导入 UsersModule
 *   2. UsersModule 导入 AuthModule（因为 UserController 需要 AuthGuard）
 *   3. AuthModule 导入 UsersModule（因为 AuthService 需要 UserService 验证用户）
 *   4. IoC 容器的拓扑排序进入死循环：UsersModule → AuthModule → UsersModule → ...
 *   5. 容器检测到循环引用 → 抛出错误
 *
 *   【核心原理】NestJS 的模块初始化是递归的：
 *   initModule(AppModule):
 *     initModule(UsersModule):
 *       initModule(AuthModule):
 *         initModule(UsersModule):  // ← 已经在上层栈中！
 *           → 检测到循环 → 抛出错误
 *
 * 【在 Express/Spring/Go/Rust 中对应的行为】
 *   - Express: 不存在此问题——没有模块系统，所有路由都在一个扁平空间
 *   - Spring:  默认也不允许循环依赖（Spring Boot 2.6+ 默认禁止）
 *             可以通过 @Lazy 注解延迟注入解决
 *             或者设置 spring.main.allow-circular-references=true（不推荐）
 *   - Go:      编译期错误——如果你在两个包之间互相 import，Go 编译器会报 "import cycle not allowed"
 *             Go 的解决方式：抽取公共接口到第三个包，或使用接口+依赖反转
 *   - Rust:    同样的编译期错误——Rust 的模块系统在编译期解析，不可能有循环引用
 *             Rust 通过 trait 解耦：定义 trait 在公共 crate，两边分别实现
 *
 * 【对比分析】NestJS 的循环依赖是一个"运行时问题"（Go/Rust 是编译期问题）。
 *   这意味着你在 NestJS 中可以"不小心"写出循环依赖，启动时才暴露。
 *   这与 TypeScript/JavaScript 的动态特性一脉相承。
 *
 * 【如何修复】
 *   NestJS 提供了 forwardRef() 打破循环：
 *
 *   // AuthModule 中
 *   @Module({
 *     imports: [forwardRef(() => UsersModule)],  // ← 延迟引用
 *     ...
 *   })
 *
 *   // UsersModule 中
 *   @Module({
 *     imports: [forwardRef(() => AuthModule)],  // ← 延迟引用
 *     ...
 *   })
 *
 *   forwardRef 的原理：
 *   1. 它接受一个函数（返回模块类），而非直接传递模块类
 *   2. 容器见到 forwardRef() 时，不立即解析模块，而是记住这个函数
 *   3. 当所有模块的"非延迟"部分都初始化完毕后，再调用函数获取模块引用
 *   4. 此时 AuthModule 已经创建完成，UsersModule 可以安全地获取 AuthModule 的 exports
 *
 *   【对比 Spring】Spring 的 @Lazy 也是用代理/CGLIB 延迟注入，原理类似
 *   【对比 Go/Rust】Go/Rust 根本不需要这个——编译期就阻止了循环依赖
 *
 * 【最佳实践】
 *   - 尽量避免循环依赖！它是代码设计问题的信号
 *   - 如果确实需要（如 AuthModule ↔ UsersModule），考虑：
 *     方案 A: 抽取共享模块（如 SharedModule），把两边都需要的类型/接口放进去
 *     方案 B: 使用 forwardRef() 但加注释说明为什么这里必须循环引用
 *   - 在 Service 层面也可能有循环依赖（A 需要 B，B 需要 A）
 *     同样用 forwardRef(() => BService) 在 @Inject() 中解决
 */

import { Module, Controller, Get, Injectable, forwardRef } from "@nestjs/common";

// ============================================================
// Auth 模块——需要 UsersModule（因为要查用户）
// ============================================================
@Injectable()
class AuthService {
  // 需要 UserService 来验证用户身份
  // constructor(@Inject(forwardRef(() => UserService)) private userService: UserService) {}
  validate(token: string) {
    return { userId: 1, token };
  }
}

@Module({
  providers: [AuthService],
  exports: [AuthService],
  // BUG: 直接导入 UsersModule 造成循环
  // imports: [UsersModule],  // ← 循环依赖！
  // 修复:
  // imports: [forwardRef(() => UsersModule)],
  imports: [],
})
class AuthModule {}

// ============================================================
// Users 模块——需要 AuthModule（因为需要 AuthGuard）
// ============================================================
@Injectable()
class UserService {
  findAll() {
    return [{ id: 1, name: "用户A" }];
  }
}

@Controller("users")
class UserController {
  // 需要 AuthGuard → 需要 AuthService → 需要 AuthModule
  constructor(
    private readonly userService: UserService,
    // BUG: 如果注入 AuthService，则循环依赖
    // private readonly authService: AuthService,
  ) {}

  @Get()
  findAll() {
    return this.userService.findAll();
  }
}

@Module({
  controllers: [UserController],
  providers: [UserService],
  exports: [UserService],
  // BUG: 直接导入 AuthModule 造成循环
  imports: [AuthModule], // ← 循环依赖！
  // 修复: imports: [forwardRef(() => AuthModule)],
})
class UsersModule {}

// 以下注释是修复后的正确写法：
/*
@Module({
  imports: [forwardRef(() => UsersModule)],
  providers: [AuthService],
  exports: [AuthService],
})
class AuthModuleFixed {}

@Module({
  imports: [forwardRef(() => AuthModuleFixed)],
  controllers: [UserController],
  providers: [UserService],
  exports: [UserService],
})
class UsersModuleFixed {}
*/

@Module({
  imports: [UsersModule, AuthModule], // ← 这里也会检测到循环
})
export class BugAppModule {}
