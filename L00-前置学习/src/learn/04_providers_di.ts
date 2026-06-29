/**
 * ============================================================
 * 第 04 章：提供者（Provider）与依赖注入（核心）
 * ============================================================
 *
 * 【学习目标】
 *   1. 理解 Provider 的本质：任何可被 DI 容器实例化的类或值
 *   2. 掌握 @Injectable() 和注入方式：构造函数注入 vs 属性注入
 *   3. 掌握自定义 Provider 的四种模式：useClass、useValue、useFactory、useExisting
 *   4. 理解注入令牌（Token）的概念：类 Token vs 字符串 Token
 *   5. 掌握 Provider 三种作用域：DEFAULT（单例）、REQUEST（请求级）、TRANSIENT（瞬时）
 *
 * 【与 Express/FastAPI/Spring/Django 的对比提示】
 *   - Express：没有 DI 概念，需手动创建和管理实例
 *   - FastAPI：Depends 函数提供了类似 DI 的能力
 *   - Spring：NestJS 的 DI 容器几乎是 Spring IoC 的 TypeScript 版本
 *   - Django：没有内置 DI，通常通过 Service Locator 或手动导入
 *
 * 【与 Vue3 前端的协作关系】
 *   - Provider = Vue3 的 provide/inject —— 提供依赖和注入依赖
 *   - useFactory = Vue3 的 computed 工厂函数
 *   - 作用域 SINGLETON = Vue3 的全局 provide（应用级别单例）
 *   - 作用域 REQUEST = 每个请求独立的 Pinia Store 实例
 */

import {
  Injectable,
  Inject,
  Optional,
  Module,
  Scope,
  Controller,
  Get,
} from '@nestjs/common';
import type { OnModuleInit } from '@nestjs/common';

// ============================================================
// 示例 1：@Injectable() 的本质 —— 构造函数注入（推荐方式）
// ============================================================

/**
 * 【场景】标准的三层依赖：Controller → Service → Repository
 * 【语法点】@Injectable() 标记类可被注入，构造函数声明依赖
 * 【NestJS 设计意图】DI 容器自动解析依赖关系图，开发者只需声明类型
 * 【DI 容器行为】启动时：
 *   1. 扫描 @Injectable() 类，建立依赖图
 *   2. 按依赖顺序实例化（先实例化被依赖的）
 *   3. 默认单例，整个应用生命周期只有一个实例
 */
@Injectable()
class DatabaseRepository {
  public query(sql: string): unknown[] {
    console.log(`执行 SQL: ${sql}`);
    return [{ id: 1, name: 'test' }];
  }
}

@Injectable()
class UserService_04 {
  // 构造函数注入：TypeScript 的类型注解在运行时通过 reflect-metadata 保留
  // NestJS 通过 design:paramtypes 元数据得知需要注入 DatabaseRepository
  constructor(private readonly repository: DatabaseRepository) {}

  public findAll(): unknown[] {
    return this.repository.query('SELECT * FROM users');
  }
}

@Injectable()
class AppService_04 {
  constructor(
    private readonly userService: UserService_04,
    // 多个依赖：DI 容器自动解析所有构造函数参数
  ) {}

  public getUsers(): unknown[] {
    return this.userService.findAll();
  }
}

// 验证 DI 容器行为：手动模拟一次注入过程
const repo: DatabaseRepository = new DatabaseRepository();
const service: UserService_04 = new UserService_04(repo);
const appService: AppService_04 = new AppService_04(service);
console.log(appService.getUsers());

// ============================================================
// 示例 2：属性注入（@Inject() 装饰器）
// ============================================================

/**
 * 【场景】需要注入时无法通过构造函数声明（如多继承场景、可选依赖）
 * 【语法点】@Inject(Token) 声明属性注入，@Optional() 标记可选依赖
 * 【NestJS 设计意图】提供除构造函数外的补充注入方式
 * 【注意】构造函数注入是首选，属性注入仅在特殊场景使用
 */
interface Logger {
  log(message: string): void;
}

@Injectable()
class ConsoleLogger implements Logger {
  public log(message: string): void {
    console.log(`[LOG] ${message}`);
  }
}

@Injectable()
class PropertyInjectionService {
  // 属性注入：直接在属性上使用 @Inject()
  @Inject('CONFIG_TOKEN')
  private readonly config!: { appName: string; version: string };

  // 可选注入：如果 Provider 不存在也不会报错
  @Optional()
  @Inject('OPTIONAL_LOGGER')
  private readonly logger?: Logger;

  public printConfig(): void {
    console.log(`App: ${this.config.appName} v${this.config.version}`);
  }

  public safeLog(message: string): void {
    if (this.logger) {
      this.logger.log(message);
    } else {
      console.log(`[FALLBACK] ${message}`);
    }
  }
}

// ============================================================
// 示例 3：自定义 Provider —— useClass（标准类替换）
// ============================================================

/**
 * 【场景】根据环境使用不同的实现（开发环境的 Mock vs 生产环境的真实服务）
 * 【语法点】{ provide: Token, useClass: Implementation }
 * 【NestJS 设计意图】面向接口编程，通过 DI 容器切换实现而无需修改业务代码
 */
interface PaymentService {
  charge(amount: number): string;
}

@Injectable()
class RealPaymentService implements PaymentService {
  public charge(amount: number): string {
    return `真实扣款 ¥${amount}`;
  }
}

class MockPaymentService implements PaymentService {
  // Mock 实现不需要 @Injectable()（因为它通过 useClass 直接指定）
  public charge(amount: number): string {
    return `模拟扣款 ¥${amount}（不会实际扣款）`;
  }
}

// 模块配置：
@Module({
  providers: [
    {
      provide: 'PAYMENT_SERVICE', // 接口 Token（用字符串避免类型擦除问题）
      useClass:
        process.env['NODE_ENV'] === 'production'
          ? RealPaymentService
          : MockPaymentService, // 开发环境用 Mock
    },
  ],
})
class PaymentModule {}

// ============================================================
// 示例 4：自定义 Provider —— useValue（常量/配置对象）
// ============================================================

/**
 * 【场景】注入静态配置、第三方库实例、Mock 对象
 * 【语法点】{ provide: Token, useValue: constantValue }
 * 【NestJS 设计意图】DI 容器不仅能管理类实例，还能管理任意值
 *                   这也是测试中 Mock 依赖的主要方式
 */
interface AppConfig {
  port: number;
  databaseUrl: string;
  jwtSecret: string;
}

const appConfig: AppConfig = {
  port: 3000,
  databaseUrl: 'postgresql://localhost:5432/nestjs_learn',
  jwtSecret: 'super-secret-key',
};

@Module({
  providers: [
    // 注入配置对象
    {
      provide: 'APP_CONFIG',
      useValue: appConfig,
    },
    // 注入简单常量
    {
      provide: 'MAX_RETRY_COUNT',
      useValue: 3,
    },
    // 注入第三方库实例（如 Redis 客户端）
    {
      provide: 'REDIS_CLIENT',
      useValue: {
        get: (key: string): string => `mock-value-for-${key}`,
        set: (key: string, value: string): void => {
          console.log(`Redis SET ${key}=${value}`);
        },
      },
    },
  ],
})
class ConfigModule_04 {}

@Injectable()
class ConfigConsumer {
  constructor(
    @Inject('APP_CONFIG') private readonly config: AppConfig,
    @Inject('MAX_RETRY_COUNT') private readonly maxRetry: number,
  ) {}

  public showConfig(): void {
    console.log(`端口: ${this.config.port}, 最大重试: ${this.maxRetry}`);
  }
}

// ============================================================
// 示例 5：自定义 Provider —— useFactory（工厂函数）
// ============================================================

/**
 * 【场景】需要异步初始化（如连接数据库、读取配置文件）、条件实例化
 * 【语法点】{ provide: Token, useFactory: (...deps) => instance, inject: [...] }
 * 【NestJS 设计意图】处理复杂初始化逻辑，工厂函数可以注入其他 Provider
 * 【DI 容器行为】先解析 inject 数组中的依赖，再将它们作为参数传给 useFactory
 */
@Module({
  providers: [
    // 基础 Provider
    { provide: 'DB_HOST', useValue: 'localhost' },
    { provide: 'DB_PORT', useValue: 5432 },

    // 工厂 Provider：接收注入的依赖，动态创建实例
    {
      provide: 'DATABASE_CONNECTION_04',
      useFactory: async (host: string, port: number, config: AppConfig) => {
        // 模拟异步连接数据库
        console.log(`正在连接 ${host}:${port}...`);
        await new Promise<void>((resolve) => setTimeout(resolve, 100));
        return {
          host,
          port,
          connected: true,
          timestamp: Date.now(),
          databaseUrl: config.databaseUrl,
        };
      },
      inject: ['DB_HOST', 'DB_PORT', 'APP_CONFIG'], // 管道式注入依赖
    },

    // 条件工厂：根据环境变量创建不同实现
    {
      provide: 'CACHE_DRIVER',
      useFactory: () => {
        if (process.env['CACHE_DRIVER'] === 'redis') {
          return { type: 'redis', host: 'localhost' };
        }
        return { type: 'memory', store: new Map() };
      },
      // 无 inject，不需要依赖
    },
  ],
})
class FactoryModule {}

// ============================================================
// 示例 6：自定义 Provider —— useExisting（别名）
// ============================================================

/**
 * 【场景】为已有 Provider 创建别名（如向后兼容、简化 Token 名称）
 * 【语法点】{ provide: 'NEW_TOKEN', useExisting: 'OLD_TOKEN' }
 * 【NestJS 设计意图】避免重复注册，统一引用同一个实例
 */
@Injectable()
class OriginalLogger {
  public log(message: string): void {
    console.log(`[ORIGINAL] ${message}`);
  }
}

@Module({
  providers: [
    OriginalLogger,
    // 为 OriginalLogger 创建别名
    {
      provide: 'LOGGER',
      useExisting: OriginalLogger, // 指向同一个实例（单例）
    },
  ],
})
class AliasModule {}

// ============================================================
// 示例 7：Provider 作用域 —— DEFAULT / REQUEST / TRANSIENT
// ============================================================

/**
 * 【场景】不同业务需求需要不同的实例生命周期
 * 【语法点】@Injectable({ scope: Scope.XXX })
 * 【NestJS 设计意图】默认单例最高效，但某些场景需要请求隔离或每次新建
 */

// 场景 1：默认作用域 —— 单例（整个应用共享一个实例）
@Injectable() // 默认 scope: Scope.DEFAULT
class SingletonService {
  private readonly created: number = Date.now();
  public getCreatedTime(): number {
    return this.created;
  }
}

// 场景 2：请求作用域 —— 每个 HTTP 请求创建一个新实例
// 典型用途：存储请求上下文（如当前用户信息）
@Injectable({ scope: Scope.REQUEST })
class RequestScopedService {
  private readonly requestId: string = crypto.randomUUID();
  public getRequestId(): string {
    return this.requestId;
  }
}

// 场景 3：瞬时作用域 —— 每次注入都创建新实例
// 典型用途：无状态工具类、临时对象
@Injectable({ scope: Scope.TRANSIENT })
class TransientService {
  private readonly counter: number = 1;
  public increment(): number {
    return this.counter + 1;
  }
}

// 注意：如果一个单例 Service 注入了 REQUEST 作用域的 Provider，
// 单例 Service 本身也需要声明为 REQUEST 作用域（作用域会向上传播）
@Injectable({ scope: Scope.REQUEST }) // 必须匹配子依赖的作用域
class UsesRequestScopeService {
  constructor(private readonly requestService: RequestScopedService) {}
}

// ============================================================
// ❌ 常见错误 1：循环依赖（A 注入 B，B 注入 A）
// ============================================================

/**
 * 【错误现象】Nest can't resolve dependencies 或 实例为 undefined
 * 【错误原因】ServiceA 需要 ServiceB，ServiceB 需要 ServiceA，形成死循环
 * 【正确写法】使用 @Inject(forwardRef(() => Type)) 或重构代码避免循环
 */

// ❌ 错误写法：
// @Injectable()
// class ServiceA { constructor(private b: ServiceB) {} }
// @Injectable()
// class ServiceB { constructor(private a: ServiceA) {} }  // 循环！

// ✅ 正确写法之一（使用 forwardRef）：
// import { forwardRef } from '@nestjs/common';
// @Injectable()
// class ServiceA {
//   constructor(@Inject(forwardRef(() => ServiceB)) private b: ServiceB) {}
// }

// ✅ 正确写法之二（重构：抽取公共依赖到 ServiceC）：
// @Injectable()
// class ServiceC { doSharedWork() {} }
// class ServiceA { constructor(private c: ServiceC) {} }
// class ServiceB { constructor(private c: ServiceC) {} }

// ============================================================
// ❌ 常见错误 2：未标记 @Injectable() 却尝试注入
// ============================================================

/**
 * 【错误现象】Nest can't resolve dependencies of the XxxController.
 *             Please make sure that the argument YyyService at index [0]
 *             is available in the XxxModule context.
 * 【错误原因】DI 容器不认识未装饰 @Injectable() 的类
 * 【正确写法】所有会被注入的类都要加 @Injectable()
 */

// ❌ 错误写法：
// class UserService_fix {  // 缺少 @Injectable()
//   findAll() { return []; }
// }

// ✅ 正确写法：
// @Injectable()
// class UserService_fix {
//   findAll() { return []; }
// }

// ============================================================
// ❌ 常见错误 3：Token 类型不匹配导致 undefined
// ============================================================

/**
 * 【错误现象】注入的依赖为 undefined，但启动时不报错
 * 【错误原因】字符串 Token 拼写不一致：
 *            provide: 'MY_TOKEN'  vs  @Inject('MY-TOKEN')
 * 【正确写法】将 Token 定义为常量，避免魔法字符串
 */

// ❌ 错误写法：
// @Module({
//   providers: [{ provide: 'MY_TOKEN', useValue: 'hello' }],
// })
// class BadModule {}
// @Injectable()
// class Consumer {
//   constructor(@Inject('MY-TOKEN') val: string) {}  // 拼写不一致！
// }

// ✅ 正确写法：
const MY_TOKEN = 'MY_TOKEN'; // 定义常量避免拼写错误
@Module({
  providers: [{ provide: MY_TOKEN, useValue: 'hello' }],
})
class GoodModule {}
@Injectable()
class GoodConsumer {
  constructor(@Inject(MY_TOKEN) private readonly val: string) {}
}

console.log('=== 第 04 章示例代码结束 ===');

// ============================================================
// 本章小结
// ============================================================
/*
 * 【核心要点】
 *   - Provider = 任何可被 DI 容器管理的值（类/常量/工厂结果）
 *   - @Injectable() 标记类为可注入，构造函数注入是最推荐的方式
 *   - 四种自定义 Provider：useClass（替换实现）、useValue（常量）、useFactory（动态创建）、useExisting（别名）
 *   - Token 是 DI 容器的钥匙：类 Token（类型安全）优先，字符串 Token 用于接口和常量
 *   - 三种作用域：DEFAULT（单例/高效）、REQUEST（请求隔离）、TRANSIENT（每次新建）
 *
 * 【与前后章的关联】
 *   - 第 03 章：Controller 通过构造函数注入 Service = 本章的 DI 机制
 *   - 第 05 章：Service 层的业务逻辑依赖于本章的 Provider 注册机制
 *   - 第 12 章：DrizzleService 作为一个 Provider 被注入到各个 Service 中
 *
 * 【常见面试题】
 *   Q: useClass、useValue、useFactory、useExisting 的区别和使用场景？
 *   A: useClass — 多态替换（如 Mock vs Real）；useValue — 常量/配置注入；
 *      useFactory — 需要异步初始化或条件逻辑；useExisting — 创建别名。
 *
 *   Q: NestJS 的三种作用域有什么区别？什么情况用 REQUEST 作用域？
 *   A: DEFAULT 是单例（最高效）；REQUEST 每个请求新建（存储请求上下文）；
 *      TRANSIENT 每次注入新建。REQUEST 适用于存储当前用户、请求 ID 等信息。
 */

// ============================================================
// 🎯 通关检查清单
// ============================================================
/*
 * [ ] 能解释 Provider 的本质和四种自定义方式
 * [ ] 能手写 useFactory 工厂函数（含 inject 依赖）
 * [ ] 能说出三种作用域的区别和适用场景
 * [ ] 能说出 1 个与 Spring DI 的差异
 * [ ] 能指出 1 个常见错误及修复方法
 */
