/**
 * ============================================================
 * 第 02 章：模块系统（核心）
 * ============================================================
 *
 * 【学习目标】
 *   1. 理解 @Module() 装饰器的四个属性及其职责
 *   2. 掌握模块在 DI 容器中的作用域边界概念
 *   3. 掌握全局模块 @Global() 的使用场景与风险
 *   4. 理解动态模块 forRoot()/forFeature() 模式
 *   5. 掌握模块引用 ModuleRef 和循环依赖的解决方案
 *
 * 【与 Express/FastAPI/Spring/Django 的对比提示】
 *   - Express：没有模块概念，全靠开发者自行组织。NestJS 的模块提供了天然的代码边界
 *   - FastAPI：Router + Depends 的组合类似于模块+依赖注入
 *   - Spring：@Configuration + @ComponentScan 与 NestJS 的 @Module 设计理念高度一致
 *   - Django：Django App 类似于 NestJS Module，但 NestJS 的模块隔离更强、导入/导出更明确
 *
 * 【与 Vue3 前端的协作关系】
 *   - NestJS Module = Vue3 的 Feature Module（按功能域拆分）
 *   - exports 数组 = Vue3 的 provide() —— 向外部暴露可用资源
 *   - imports 数组 = Vue3 的 import 语句 —— 引入外部模块
 */

// ============================================================
// 示例 1：@Module() 装饰器的基本结构
// ============================================================

/**
 * 【场景】一个最简模块定义
 * 【语法点】@Module() 的四个属性：providers、controllers、imports、exports
 * 【NestJS 设计意图】模块是 NestJS 的组织单元，也是 DI 容器的作用域边界。
 *                   每个模块维护自己的 Provider 注册表，跨模块访问需要显式导出。
 * 【DI 容器行为】NestJS 启动时扫描所有模块，构建模块依赖图，
 *               然后在每个模块内实例化 Provider 并处理依赖关系。
 */
import { ModuleRef } from '@nestjs/core';
import { Module, Injectable, Controller, Get } from '@nestjs/common';

// ---- 模拟依赖类 ----
@Injectable()
class UsersService {
  public findAll(): string[] {
    return ['user1', 'user2'];
  }
}

@Injectable()
class PostsService {
  public findAll(): string[] {
    return ['post1', 'post2'];
  }
}

@Controller('users')
class UsersController {
  // 构造函数的参数中使用private（或 public、protected、readonly）是参数属性的简写写法
  // 在 NestJS 中，这种写法特别常见：private 确保服务实例是类的私有属性，可以在类的其他方法中通过 this.usersService 访问注入的服务
  constructor(private usersService: UsersService) {} // 注入 Service
  // 如果去掉 private，参数就只是普通的构造函数参数，不会自动成为类属性，无法在其他方法中访问。

  @Get()
  public findAll(): string[] {
    return this.usersService.findAll(); // 调用 Service
  }
}
// --------------------

// 子模块：封装特定功能
@Module({
  providers: [UsersService], // providers：本模块可注入的类/值
  controllers: [UsersController], // controllers：本模块处理的路由
  exports: [UsersService], // exports：对外暴露的 Provider
})
class UsersModule {}

// 父模块：导入子模块并组织功能
@Module({
  imports: [UsersModule], // imports：导入其他模块，使用其导出的 Provider
  providers: [PostsService],
  controllers: [],
  exports: [PostsService],
})
class AppModule {}

console.log('AppModule 和 UsersModule 已定义');

// ============================================================
// 示例 2：模块的 DI 作用域边界
// ============================================================

/**
 * 【场景】演示模块的 Provider 隔离性
 * 【语法点】模块内的 Provider 默认是私有的，除非放在 exports 数组中
 * 【NestJS 设计意图】模块边界 = 封装边界，防止内部实现泄露
 * 【DI 容器行为】当模块 A 导入模块 B 时，A 只能使用 B 的 exports 列表中的 Provider
 */

@Injectable()
class PrivateService {
  public secret(): string {
    return '只有本模块能访问'; // 是下面的IsolatedModule的@Module装饰器里exports里没写导致的
  }
}

@Injectable()
class PublicService {
  public info(): string {
    return '外部模块也能访问';
  }
}

@Module({
  providers: [PrivateService, PublicService],
  exports: [PublicService], // 只有 PublicService 可以被其他模块使用
  // PrivateService 只能在当前模块内部注入
})
class IsolatedModule {}

// 另一个模块
// import { IsolatedModule } from './isolated.module'; // ES6 导入类定义

@Injectable()
class ConsumerService {
  // 可以注入 PublicService（因为 IsolatedModule 导出了它）
  // 不能注入 PrivateService（未导出，DI 容器会报错）

  constructor(private publicService: PublicService) {}

  public getData(): string {
    return this.publicService.info(); // 实际调用 PublicService 的方法
  }
}

@Module({
  imports: [IsolatedModule], // NestJS 注册模块依赖关系
  providers: [ConsumerService], // 实际项目中一个文件一个类，通过 import 解决依赖，不会遇到"声明前使用"的问题
})
class ConsumerModule {}

// ============================================================
// 示例 3：全局模块 @Global()
// ============================================================

/**
 * 【场景】某个模块需要被所有模块使用（如数据库连接、配置、日志）
 * 【语法点】@Global() 装饰器让模块的 exports 自动对所有模块可见，无需手动 imports
 * 【NestJS 设计意图】减少重复的 imports 声明，但需要谨慎使用
 * 【风险】全局模块过多会导致命名冲突和依赖关系不可追踪，类似全局变量的问题
 */

import { Global, Inject } from '@nestjs/common';

@Global() // 标记为全局模块
@Module({
  providers: [
    {
      provide: 'DATABASE_CONNECTION', // ← 注入 token（标识符）
      useValue: { connected: true, host: 'localhost', port: 5432 }, // ← 提供的值
    },
    // 这是一段 DI 容器的配置，具体来说是一个 Provider 配置对象。它告诉 NestJS 的依赖注入容器：
    // 当有人请求 'DATABASE_CONNECTION' 这个 token 时，就给他这个对象 { connected: true, host: 'localhost', port: 5432 }
    // 通常用于注入常量、配置对象、或简单数据。
    // 就像是在 DI 容器里注册了一个"全局变量"，但通过依赖注入的方式提供，而不是直接访问全局变量。这样更容易测试和替换。
  ],
  exports: ['DATABASE_CONNECTION'], // 将 'DATABASE_CONNECTION' 这个 provider 导出，让所有模块都可以注入 'DATABASE_CONNECTION'
  // 1.providers：在当前模块的 DI 容器中注册 'DATABASE_CONNECTION'
  // 2.exports：允许其他模块使用这个 provider
  // 3.@Global()：让这个导出自动对所有模块可见，无需在每个模块的 imports 中声明
})
class DatabaseModule {}

// 其他模块无需 imports 就能使用
@Injectable()
class UserRepository {
  // 直接注入全局 Provider，无需在所在模块的 imports 中声明 DatabaseModule

  constructor(@Inject('DATABASE_CONNECTION') private db: { connected: boolean; host: string; port: number }) {
    console.log(this.db.host); // 'localhost'
    console.log(this.db.port); // 5432
  }

  // ✅ 当 provider 的是字符串（如 'DATABASE_CONNECTION'）时，TypeScript 无法从参数类型推断，必须用 @Inject() 明确指定
  // constructor(@Inject('DATABASE_CONNECTION') private db: any) {}

  // ✅ 当 provider 的是类时，TypeScript 的类型信息足够让 NestJS 识别，可以省略 @Inject()
  // constructor(private usersService: UsersService) {}
}

// ============================================================
// 示例 4：动态模块 —— forRoot() / forFeature() 模式
// ============================================================

/**
 * 【场景】模块需要接收配置参数才能正确初始化（如数据库连接信息、JWT 密钥）
 * 【语法点】在 Module 类上定义静态方法 forRoot()，返回 DynamicModule
 * 【NestJS 设计意图】让模块使用者能传递配置，同时保持模块内部实现封装
 * 【实际案例】@nestjs/config 的 ConfigModule.forRoot()、
 *            TypeORM 的 TypeOrmModule.forRoot()、Drizzle 集成也可用此模式
 */
import type { DynamicModule, Provider } from '@nestjs/common';

interface DrizzleModuleOptions {
  url: string;
  log?: boolean;
}

// 痛点：如果用静态的 @Module() 装饰器，配置是写死的：
// ❌ 配置写死，无法根据环境切换
// @Module({
//   providers: [{
//     provide: 'DB',
//     useValue: { url: 'localhost:5432' }  // 写死了
//   }]
// })
// class DrizzleModule {}

// 解决：用静态方法 + 动态返回：
// ✅ 可以根据参数动态生成配置
// DrizzleModule.forRoot({ url: process.env.DATABASE_URL })

// 为什么还需要 @Module({})：1.标识这是一个 NestJS 模块，让 NestJS 识别这个类是模块；2.可以有静态配置：如果需要，可以写一些固定的配置
@Module({}) // 这里是空的 @Module({})，这是动态模块的常见写法，因为所有的配置都是通过 forRoot() 动态返回的，不需要在装饰器中写死
class DrizzleModule {
  /**
   * NestJS 的动态模块（Dynamic Module）模式，用于创建可配置的模块。
   * forRoot —— 在根模块调用一次，注册全局数据库连接
   */
  // forRoot 是 NestJS 社区的约定俗成的命名规范，有特定含义。表示在根模块注册一次，全局配置
  public static forRoot(options: DrizzleModuleOptions): DynamicModule {
    // 1️⃣ 将用户传入的配置注册为 Provider
    const optionsProvider: Provider = {
      provide: 'DRIZZLE_OPTIONS',
      useValue: options, // 保存配置对象
    };

    // 2️⃣ 使用工厂函数创建数据库连接
    const connectionProvider: Provider = {
      provide: 'DRIZZLE_CONNECTION',
      useFactory: (opts: DrizzleModuleOptions) => {
        // 实际项目中这里初始化 drizzle + pg Pool
        return { connected: true, url: opts.url, log: opts.log };
      },
      inject: ['DRIZZLE_OPTIONS'], // 注入配置 Provider
    };

    // 3️⃣ 返回动态生成的模块配置
    return {
      module: DrizzleModule, // 模块类本身
      global: true, // 注册为全局模块
      providers: [optionsProvider, connectionProvider],
      exports: [connectionProvider],
    };
  }

  /**
   * forFeature —— 在子模块中调用，注册特定实体的 Repository
   */
  // forFeature是NestJS社区约定的命名规范，表示在功能模块注册，局部配置
  public static forFeature(): DynamicModule {
    return {
      module: DrizzleModule,
      providers: [
        {
          provide: 'USER_REPOSITORY',
          useFactory: (conn: { connected: boolean }) => ({
            findMany: () => [{ id: 1, name: 'test' }],
            connection: conn,
          }),
          inject: ['DRIZZLE_CONNECTION'],
        },
      ],
      exports: ['USER_REPOSITORY'],
    };
  }
}

// 使用方式：
@Module({
  imports: [DrizzleModule.forRoot({ url: 'postgresql://...', log: true })], // 根模块注册
})
class RootModule {}

@Module({
  imports: [DrizzleModule.forFeature()], // 子模块注册 entity-specific 的 Provider
})
class FeatureModule {}

// ============================================================
// 示例 5：模块引用 —— ModuleRef（打破常规 DI 的场景）
// ============================================================

/**
 * 【场景】需要动态获取 Provider 实例（如工厂模式、条件注入、手动管理生命周期）
 * 【语法点】ModuleRef.get() 获取已实例化的 Provider
 * 【NestJS 设计意图】提供一种程序化获取依赖的方式，作为装饰器注入的补充
 * 【注意】常规场景请使用构造函数注入，ModuleRef 仅用于特殊场景
 */
import type { OnModuleInit as NestOnModuleInit } from '@nestjs/common';

@Injectable()
class DynamicService implements NestOnModuleInit {
  constructor(private readonly moduleRef: ModuleRef) {}

  // 在模块初始化后手动获取 Provider
  public onModuleInit(): void {
    // 按类 Token 获取（默认严格模式，Provider 必须存在）
    const usersService: UsersService = this.moduleRef.get(UsersService);

    // 按字符串 Token 获取
    const db: unknown = this.moduleRef.get('DATABASE_CONNECTION');

    console.log('动态获取 UsersService:', usersService.findAll());
    console.log('动态获取数据库连接:', db);
  }

  // 按作用域获取（用于 REQUEST 作用域的 Provider）
  public async getScopedProvider(contextId: unknown): Promise<UsersService | null> {
    const result = await this.moduleRef.resolve<UsersService>(UsersService, contextId as { id: number }, {
      strict: false, // 非严格模式，Provider 不存在返回 undefined 而不会抛错
    });
    return result;
  }
}

// ============================================================
// 示例 6：模块的循环依赖及其解决方案
// ============================================================

/**
 * 【场景】模块 A 导入模块 B，模块 B 也导入模块 A（如 User 和 Auth 相互引用）
 * 【语法点】forwardRef(() => XxxModule) 延迟解析模块引用
 * 【NestJS 设计意图】允许必要的循环依赖，但鼓励通过重构避免它
 * 【DI 容器行为】forwardRef 返回一个 ForwardReference 对象，
 *               DI 容器在模块实例化完成后才解析它，打破循环
 */
// forwardRef 仅用于下方注释示例，实际使用时需从 @nestjs/common 导入
// import { forwardRef } from '@nestjs/common';

// ---- 模拟 ----
// @Module({})
// class AuthModuleMock {}
// @Module({})
// class UsersModuleMock {}
// @Injectable()
// class AuthServiceMock {}
// @Injectable()
// class UsersServiceMock {}
// ----

// 场景：UsersModule 需要 AuthModule 的 Guard，AuthModule 需要 UsersModule 的 Service

// 方案一：模块级循环依赖使用 forwardRef()
// 注：先声明 AuthModule（或被引用的模块应先声明或使用 forwardRef 延迟引用）

// 方案二：Provider 级循环依赖使用 @Inject(forwardRef(() => Type))
// 注：下方示例中 AuthService 和 UsersService_ 相互引用，
// 需使用 forwardRef 打破循环，但为简洁此处仅展示模式

// @Injectable()
// class AuthService_02 {
//   constructor(
//     @Inject(forwardRef(() => UsersService_))
//     private readonly usersService: UsersService_,
//   ) {}
// }

@Injectable()
class UsersService_ {
  // 实际中如果与 AuthService 循环依赖：
  // constructor(
  //   @Inject(forwardRef(() => AuthService_02))
  //   private readonly authService: unknown,
  // ) {}
  public findAll(): string[] {
    return ['user1'];
  }
}

const showForwardRefExample = (): void => {
  // 展示 forwardRef 用法（避免类声明顺序问题）
  const _forwardRefUsage = (): void => {
    // @Module({
    //   imports: [forwardRef(() => AuthModule)],  // 延迟引用
    // })
    // class UsersModule {}
    //
    // @Module({
    //   imports: [forwardRef(() => UsersModule)],  // 双方都用 forwardRef
    // })
    // class AuthModule {}
    console.log('forwardRef 模式示例已展示');
  };
  _forwardRefUsage();
};

// ============================================================
// ❌ 常见错误 1：模块未导入却使用其 Provider
// ============================================================

/**
 * 【错误现象】Nest can't resolve dependencies of the XxxService...
 *             Please make sure that the argument YyyService is available in the XxxModule context
 * 【错误原因】XxxModule 没有导入包含 YyyService 的模块
 * 【正确写法】在 XxxModule 的 imports 中添加 YyyModule，且确保 YyyService 在 YyyModule.exports 中
 */

// ❌ 错误写法：
// @Module({
//   providers: [PostService],  // PostService 需要 UsersService
//   // 缺少 imports: [UsersModule]
// })
// class PostModule {}

// ✅ 正确写法：
// @Module({
//   imports: [UsersModule],   // 导入包含 UsersService 的模块
//   providers: [PostService],
// })
// class PostModule {}

// ============================================================
// ❌ 常见错误 2：循环依赖未处理导致 undefined
// ============================================================

/**
 * 【错误现象】启动时抛出：UndefinedModuleException 或依赖为 undefined
 * 【错误原因】模块 A 和 B 相互导入，DI 容器无法决定初始化顺序
 * 【正确写法】使用 forwardRef(() => XxxModule) 打破循环
 */

// ❌ 错误写法：
// @Module({ imports: [BModule] }) class AModule {}
// @Module({ imports: [AModule] }) class BModule {}  // 循环依赖！

// ✅ 正确写法：
// @Module({ imports: [forwardRef(() => BModule)] }) class AModule {}
// @Module({ imports: [forwardRef(() => AModule)] }) class BModule {}

// ============================================================
// ❌ 常见错误 3：全局模块过度使用导致命名冲突
// ============================================================

/**
 * 【错误现象】同一个字符串 Token 被不同的全局模块注册，后者覆盖前者；
 *            或者项目难以追踪某个依赖来自哪个模块
 * 【错误原因】@Global() 降低了模块导入的显式性，使得依赖关系不可见
 * 【正确写法】只有真正需要全局共享的基础模块（数据库、配置、日志）才使用 @Global()
 *            业务模块应通过显式 imports 声明依赖
 */

// 引用所有 demo 变量以避免 unused-vars 警告
void AppModule;
void IsolatedModule;
void ConsumerService;
void DatabaseModule;
void UserRepository;
void RootModule;
void FeatureModule;
void DynamicService;
void UsersService_;
showForwardRefExample();

console.log('=== 第 02 章示例代码结束 ===');

// ============================================================
// 本章小结
// ============================================================
/*
 * 【核心要点】
 *   - @Module() 是 NestJS 的组织核心：providers、controllers、imports、exports
 *   - 模块是 DI 容器的作用域边界：未 exports 的 Provider 对外不可见
 *   - @Global() 谨慎使用，仅用于基础设施模块（数据库、配置、日志）
 *   - 动态模块 forRoot()/forFeature() 用于需要配置参数的模块
 *   - ModuleRef 可程序化获取 Provider，但要优先使用构造函数注入
 *   - forwardRef() 解决循环依赖，但最好通过重构避免
 *
 * 【与前后章的关联】
 *   - 第 01 章介绍了项目结构，本章解释了其核心组织单元——模块
 *   - 第 03 章将进入模块内的控制器，了解路由处理
 *   - 第 04 章深入 DI 容器，理解模块如何管理 Provider 生命周期
 *
 * 【常见面试题】
 *   Q: @Module() 的四个属性分别是什么作用？
 *   A: providers（注册本模块的 Provider）、controllers（注册本模块的控制器）、
 *      imports（导入其他模块以使用其导出的 Provider）、
 *      exports（将本模块的 Provider 暴露给其他模块）
 *
 *   Q: 动态模块和普通模块有什么区别？
 *   A: 动态模块的 @Module() 返回 DynamicModule 对象（而非静态元数据），
 *      允许在运行时根据配置参数决定 providers 和 exports。
 *      典型模式是 forRoot()（根模块配置）和 forFeature()（子模块注册）。
 *
 *   Q: 如何解决模块循环依赖？
 *   A: 使用 forwardRef(() => XxxModule) 延迟模块引用解析。
 *      最好通过重构（抽取公共模块）从根本上消除循环依赖。
 */

// ============================================================
// 🎯 通关检查清单
// ============================================================
/*
 * [ ] 能解释 @Module() 的四个属性和模块作用域边界
 * [ ] 能手写一个简单的动态模块（forRoot 模式）
 * [ ] 能说出 @Global() 的适用场景和风险
 * [ ] 能使用 forwardRef() 解决循环依赖
 * [ ] 能指出 1 个常见错误及修复方法
 */
