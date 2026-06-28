import { Module, Logger, OnModuleInit } from "@nestjs/common";
import { CatsController } from "./cats.controller";
import { CatsService, DatabaseProvider } from "./cats.service";

/**
 * WHAT: Cats 功能模块——封装所有与"猫"相关的功能
 *
 * WHY: @Module 装饰器的四个核心属性：
 *   - controllers: 注册路由处理器（告诉 Express 挂载哪些路由）
 *   - providers: 注册 Ioc 容器管理的对象（告诉容器创建哪些实例）
 *   - imports: 声明模块级依赖（当需要其他模块的 Provider 时）
 *   - exports: 暴露 Provider 给其他模块（打破模块封装边界）
 *
 * 【核心原理——NestJS 如何处理 @Module 元数据】
 *   NestJS 在扫描 @Module 时，实际上是读取 TypeScript 编译后生成的
 *   __decorate([Module({...})], CatsModule) 中的配置对象。
 *   这个配置对象被保存在 Reflect Metadata 中，容器启动时读取。
 *
 *   providers: [CatsService, InMemoryDatabaseService] 被解析为：
 *   [
 *     { provide: CatsService, useClass: CatsService },
 *     { provide: DatabaseProvider, useClass: InMemoryDatabaseService }
 *   ]
 *   （第二项的 provide 是 abstract class，NestJS 用 useClass 指定具体实现）
 *
 * 【对比 Spring Boot】
 *   Spring: @Configuration + @ComponentScan → 自动扫描 Bean
 *   NestJS: @Module({ providers: [...] }) → 手动注册
 *   差异：NestJS 更显式，不会出现"隐式 Bean 未扫描到"的问题。
 *   但需要手动维护 providers 数组，在大型项目中可能很冗长。
 *   这是有意为之的设计取舍——显式胜过隐式。
 *
 * 【对比 Go】
 *   Go 没有"模块"概念——依赖通过 import 路径和函数参数传递。
 *   NestJS 的 Module 本质上是一个"逻辑分组 + IoC 注册范围"的概念。
 *
 * WARNING: providers 数组中注册的顺序一般不重要——
 *   IoC 容器会根据依赖关系自动拓扑排序。
 *   但如果你使用 useFactory 且工厂函数依赖其他 Provider，
 *   被依赖的 Provider 必须同样注册在 providers 中（不一定在同模块，可以是 imports 的模块的 exports）
 */
@Module({
  controllers: [CatsController],
  providers: [
    CatsService,
    // WHAT: 自定义 Provider——用 useClass 将抽象类映射到具体实现
    // WHY: 这实现了"依赖倒置原则"——高层模块(CatsService)依赖抽象(DatabaseProvider)，
    //   低层模块(InMemoryDatabaseService)实现抽象。通过 IoC 容器配置绑定两者。
    //
    // 【对比 Spring Boot】
    //   Spring: @Primary 或 @Qualifier 指定 Bean 实现
    //   NestJS: { provide: Token, useClass: Implementation }
    //   本质相同：都是"接口/抽象类" → "具体实现"的映射
    //
    // 【对比 Rust】
    //   Rust 的 trait 实现通过 impl Trait for Type 在编译期绑定，不需要运行期容器
    //   NestJS 的运行期绑定更灵活（可以在不同环境注入不同实现），但有运行时开销
    {
      provide: DatabaseProvider,
      useClass: InMemoryDatabaseService,
    },
  ],
  // WHAT: 将 CatsService 暴露给其他模块
  // WHY: 默认情况下，模块内的 Provider 是私有的——其他模块无法注入
  //   如果你希望其他模块能注入 CatsService，必须显式 export
  // 【对比 Go】Go 的包导出只靠首字母大写，没有"模块边界"的概念
  exports: [CatsService],
})
export class CatsModule implements OnModuleInit {
  private readonly logger = new Logger(CatsModule.name);

  onModuleInit() {
    this.logger.log("CatsModule 已初始化——所有 Provider 已就绪，路由已注册");
  }
}

// ============================================================
// WHAT: 内存数据库实现——DatabaseProvider 的具体实现
// WHY: 放在 cats.module.ts 中是为了简洁（Level 04 中将抽象出独立 Repository）
// ============================================================

import { Injectable as NestInjectable } from "@nestjs/common";

@NestInjectable()
class InMemoryDatabaseService extends DatabaseProvider {
  private readonly logger = new Logger(InMemoryDatabaseService.name);
  private data: Map<string, unknown[]> = new Map();
  private idCounter = 0;

  /**
   * LIFECYCLE: onModuleInit 在构造函数之后立即执行
   * 此时可以安全地进行初始化操作（如预加载数据）
   */
  onModuleInit() {
    // 预置一些测试数据——方便验证 API 是否正常工作
    this.data.set("cats", [
      { id: 1, name: "咪咪", age: 2, breed: "波斯猫" },
      { id: 2, name: "旺财", age: 3, breed: "橘猫" },
      { id: 3, name: "小花", age: 1, breed: "英短" },
    ]);
    this.idCounter = 3;
    this.logger.log("内存数据库已初始化，预置 3 条数据");
  }

  query(sql: string): unknown[] {
    this.logger.log(`执行查询: ${sql}`);
    // 简单模拟——实际项目中会用 Prisma/TypeORM
    if (sql.includes("cats")) {
      return this.data.get("cats") ?? [];
    }
    return [];
  }

  insert(record: unknown): void {
    const cat = record as { name: string };
    this.logger.log(`插入记录: ${cat.name}`);
    const existing = this.data.get("cats") ?? [];
    existing.push(record);
    this.data.set("cats", existing);
  }

  generateId(): number {
    return ++this.idCounter;
  }
}
