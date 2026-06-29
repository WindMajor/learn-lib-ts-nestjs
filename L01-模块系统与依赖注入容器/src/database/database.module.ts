import { Module, Logger, OnModuleInit } from "@nestjs/common";
import { DatabaseInfoController } from "./database-info.controller";
import { DatabaseInfoService } from "./database-info.service";

/**
 * WHAT: Database 模块——演示"自定义 Provider"和"模块间依赖"
 *
 * WHY: 这个模块展示了 NestJS 的三种 Provider 注册方式：
 *   1. useClass:   标准语法糖 providers: [SomeClass] 等同于 { provide: SomeClass, useClass: SomeClass }
 *   2. useValue:   注入常量/配置对象，常用于 Mock 测试
 *   3. useFactory: 工厂函数，可以接收其他 Provider 作为参数，动态创建实例
 *
 * 【核心原理——useFactory 的依赖注入】
 *   { provide: 'CONNECTION_POOL', useFactory: (config) => new Pool(config), inject: [CONFIG] }
 *   inject 数组告诉 IoC 容器："工厂函数的参数按顺序从容器中获取 CONFIG"
 *   容器会：
 *   1. 先从 providers 中找到 { provide: CONFIG, ... } → 获取 CONFIG 实例
 *   2. 将 CONFIG 实例作为参数传给 factory 函数
 *   3. factory 返回的对象注册为 Token 'CONNECTION_POOL'
 *
 * 【对比 Spring Boot】
 *   Spring: @Bean + @Qualifier + @Configuration
 *   NestJS: { provide, useFactory, inject } 三件套
 *   本质相同：都是"声明式创建 Bean"
 *
 * 【对比 Go】
 *   Go 的工厂函数是你手动调用的：
 *   pool := NewPool(config)
 *   NestJS 的 useFactory 是声明式的——你声明依赖关系，容器负责调用。
 *   但 Go 的优点是编译期类型安全（你不可能把错误的类型传给工厂函数），
 *   NestJS 的类型匹配是运行期的（通过 Token 字符串或类引用）
 */
@Module({
  controllers: [DatabaseInfoController],
  providers: [
    // 方式 1: 标准语法糖
    DatabaseInfoService,

    // 方式 2: useValue——注入一个配置常量
    {
      provide: "DB_CONFIG",
      useValue: {
        host: "localhost",
        port: 5432,
        database: "nestjs_learn",
        poolSize: 10,
      },
    },

    // 方式 3: useFactory——动态创建 Provider
    // WARNING: inject 数组必须与工厂函数参数一一对应，
    //   如果遗漏了某个依赖，IoC 容器会抛出 Error: Nest can't resolve dependencies of the DATABASE_CONNECTION
    {
      provide: "DATABASE_CONNECTION",
      useFactory: (
        config: { host: string; port: number; database: string },
      ) => {
        return {
          id: Math.random().toString(36).substring(7),
          connected: true,
          config,
          queryCount: 0,
          connectTime: new Date().toISOString(),
        };
      },
      inject: ["DB_CONFIG"], // ← 从 providers 数组中找到 Token 为 'DB_CONFIG' 的 Provider
    },
  ],
  exports: [DatabaseInfoService],
})
export class DatabaseModule implements OnModuleInit {
  private readonly logger = new Logger(DatabaseModule.name);

  onModuleInit() {
    this.logger.log(
      "DatabaseModule 已初始化——DATABASE_CONNECTION 已建立",
    );
  }
}
