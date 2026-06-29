/**
 * ================================================================
 * BUG #01: Provider 未注册到 Module 的 providers 数组 → 启动崩溃
 * ================================================================
 *
 * 【错误类型】运行期错误 —— NestJS 启动时抛出 NestDependencyException
 *
 * 【如何触发】
 *   将本文件保存为 app.module.ts 替代正确的 app.module.ts，
 *   然后运行 npm run start —— 你会看到如下错误：
 *
 * 【真实错误堆栈】
 *   Error: Nest can't resolve dependencies of the CatsController (?, Logger).
 *   Please make sure that the argument CatsService at index [0] is available
 *   in the AppModule context.
 *
 *   Potential solutions:
 *   - Is AppModule a valid NestJS module?
 *   - If CatsService is a provider, is it part of the current AppModule?
 *   - If CatsService is exported from a separate @Module, is that module imported within AppModule?
 *     @Module({
 *       imports: [ /* the Module containing CatsService *‍/ ]
 *     })
 *
 * 【为什么会这样】
 *   1. IoC 容器在创建 AppModule 时发现它注册了 CatsController
 *   2. 扫描 CatsController 的构造函数参数 → 发现需要 CatsService
 *   3. 在当前 AppModule 的 providers 数组中查找 CatsService → 找不到！
 *   4. 在 AppModule 的 imports 模块的 exports 中查找 → 也没有！
 *   5. 抛出 UnknownDependenciesException
 *
 * 【NestJS IoC 容器的查找规则】
 *   当创建一个 Provider A 时发现它依赖 Provider B：
 *   1. 先在 A 所在的 Module 的 providers 中查找 B
 *   2. 再在 A 所在 Module 的 imports 模块的 exports 中查找 B
 *   3. 如果都找不到 → 报错（不会向上查找父模块，也不会全局扫描）
 *
 *   → 这意味着某个模块的 imports/controllers/providers 配置错误
 *     会导致"看似无关"的依赖解析失败——因为容器只在当前模块范围内查找。
 *
 * 【在 Express/Spring/Go 中对应的行为】
 *   - Express: 不适用——Express 没有 IoC 容器，你直接 new Service() 不需要注册
 *   - Spring:  类似错误 → "No qualifying bean of type 'CatsService' available"
 *              但 Spring 可以通过 @ComponentScan 自动扫描包路径，不会遇到这个问题
 *   - Go:      编译期错误——如果你把 Service 的类型写错了，编译器直接报错
 *   - Rust:    编译期错误——trait bound 不满足，编译器直接报错
 *
 * 【对比分析】这是 NestJS 特有的问题：它结合了运行期反射和显式注册。
 *   优点：清晰的模块边界，一眼就能看出模块依赖关系
 *   缺点：容易遗漏注册，且错误信息可能在编译期无法发现
 *
 * 【如何修复】
 *   方案 1（推荐）：使用独立的 CatsModule -> AppModule imports CatsModule
 *     见本关正解 src/app.module.ts 和 src/cats/cats.module.ts
 *   方案 2：直接在 AppModule 的 providers 中注册 CatsService
 *     但这违背了模块化原则
 */

import { Module, Controller, Get, Injectable } from "@nestjs/common";

@Injectable()
class CatsService {
  findAll(): string[] {
    return ["Bug Cat #1", "Bug Cat #2"];
  }
}

@Controller("cats")
class CatsController {
  // WHAT: 构造函数声明了依赖 CatsService
  // BUG: CatsService 没有注册在 AppModule 的 providers 数组中！
  constructor(private readonly catsService: CatsService) {}
  // ↑ 第 0 个参数 index [0] = CatsService → 容器找不到 → 崩溃

  @Get()
  findAll() {
    return this.catsService.findAll();
  }
}

@Module({
  controllers: [CatsController],
  // BUG: providers 数组是空的！CatsService 没有注册！
  providers: [],
  // 修复: providers: [CatsService],
})
export class BugAppModule {}

// ============================================================
// 修复后的正确代码（取消注释即可修复）
// ============================================================

// export class FixedAppModule {}
// @Module({
//   controllers: [CatsController],
//   providers: [CatsService],  // ← 修复：注册 CatsService
// })
