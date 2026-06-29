/**
 * ================================================================
 * BUG #01: Repository 未标记 @Injectable() → 依赖解析失败
 * ================================================================
 *
 * 【错误类型】运行期——"Nest can't resolve dependencies"
 *
 * 【真实错误堆栈】
 *   Error: Nest can't resolve dependencies of the CatsService (?).
 *   Please make sure that the argument CatsRepository at index [0]
 *   is available in the CatsModule context.
 *
 * 【为什么会这样】
 *   忘记给 Repository 类加上 @Injectable() 装饰器。
 *   虽然 PrismaService 有 @Injectable()，但 Repository 也需要：
 *   - @Injectable() 告诉 NestJS："这个类可以被 IoC 容器管理，可以注入到其他地方"
 *   - 没有 @Injectable() → NestJS 不知道这个类可以注入
 *   - CatsService 需要 CatsRepository → 容器找不到 → 抛出异常
 *
 *   → 即使你已经在 Module 的 providers 中注册了 Repository，
 *     如果类本身没有 @Injectable()，IoC 容器仍然无法处理。
 *
 * 【对比 Spring】Spring 的 @Repository 会同时标记为 Bean + 异常转换
 * 【对比 Go】Go 不需要标记——任何 struct 都可以作为依赖传递
 */

// BUG: 缺少 @Injectable()
// import { Injectable } from "@nestjs/common";

// @Injectable()  ← 取消注释即修复
class BuggyRepository {
  constructor(private readonly db: any) {}
  findAll() { return []; }
}

// 修复后:
/*
@Injectable()
class FixedRepository {
  constructor(private readonly prisma: PrismaService) {}
  findAll() { return this.prisma.cat.findMany(); }
}
*/
