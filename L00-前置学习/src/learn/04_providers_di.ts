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

import { Injectable, Inject, Optional, Module, Scope, Controller, Get } from '@nestjs/common';
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
    console.log(`执行 SQL: ${sql}`); // 执行 SQL: SELECT * FROM users
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
console.log(appService.getUsers()); // [{ id: 1, name: 'test' } ]

/* 
手动注入的特点：
  你负责创建所有依赖实例
  你控制依赖的生命周期和顺序
  你必须知道整个依赖树（repo → service → appService）
  每次使用都要手动 new，无法复用实例
  依赖关系变化时，需要手动修改所有创建代码
手动注入的缺点：
  如果 UserService_04 需要新增一个 LoggerService 依赖，你需要修改所有创建 UserService_04 的地方
  无法全局共享实例，每次 new 都是新对象
  测试时难以替换依赖（需要修改代码）

DI自动注入的特点：
  容器负责创建和注入依赖
  容器管理生命周期（默认单例，整个应用共享一个实例）
  你只需声明需要什么（通过构造函数参数），不需要知道如何创建
  容器自动解析依赖树，递归创建所有依赖
  依赖关系变化时，只需修改构造函数签名，容器自动适配
DI自动注入的优势：
  新增依赖只需修改构造函数，容器自动处理
  默认单例模式，性能更好
  测试时可以轻松 mock 依赖（通过 useClass/useValue 等）
  支持循环依赖解决、作用域控制等高级特性
DI自动注入的缺点：
  学习曲线和复杂度：需要理解装饰器、元数据、反射等概念，新手难以理解"魔法般"的自动注入机制，调试时难以追踪依赖是如何被创建和注入的
  隐式依赖关系：依赖关系隐藏在装饰器和构造函数中，不如手动注入直观，难以快速了解一个类的所有依赖（需要查看构造函数），大型项目中依赖树可能变得难以理解
  运行时错误：编译能通过，但运行时可能报错，依赖缺失只能在运行时发现，错误信息有时不够清晰
  性能开销：容器启动时需要解析和构建依赖树，反射和元数据读取有轻微性能损耗（通常可忽略），循环依赖检测增加复杂度
  过度依赖框架：代码与框架强耦合，难以迁移到其他框架，测试时必须模拟整个 DI 容器或使用框架的测试工具，无法脱离框架单独运行某些类
实际权衡：
  在 NestJS 这样的企业级框架 中，这些缺点远小于收益：
    ✅ 代码更简洁、可维护性更高
    ✅ 单例管理、作用域控制等开箱即用
    ✅ 便于测试（可以轻松 mock 依赖）
  但在小型脚本或简单项目 中，手动注入可能更合适，避免引入不必要的复杂度。
*/

// ============================================================
// 示例 2：属性注入（@Inject() 装饰器）+ 接口 vs 类注入对比
// ============================================================

/**
 * 【场景】需要注入时无法通过构造函数声明（如多继承场景、可选依赖）
 * 【语法点】@Inject(Token) 声明属性注入，@Optional() 标记可选依赖
 * 【核心问题】为什么需要字符串 Token？接口 vs 类注入有什么区别？
 */

// 定义 Logger 接口
interface Logger {
  log(message: string): void;
}

// 实现 Logger 接口的具体类
@Injectable()
class ConsoleLogger implements Logger {
  public log(message: string): void {
    console.log(`[LOG] ${message}`);
  }
}

// 定义字符串 Token 常量（避免魔法字符串拼写错误）
const LOGGER_TOKEN = 'LOGGER_TOKEN';

// ============================================================
// 示例 2.1：❌ 错误示例 —— 接口无法直接注入
// ============================================================
@Injectable()
class WrongInjectionService {
  // ❌ 错误：接口在运行时被擦除，DI 容器找不到 Logger
  // 编译通过，但运行时 logger 会是 undefined
  constructor(private readonly logger: Logger) {}
  //                                   ^^^^^^ 运行时不存在
  public doLog(): void {
    this.logger.log('This will crash!'); // TypeError: Cannot read property 'log' of undefined
  }
}

// ============================================================
// 示例 2.2：✅ 正确方式 1 —— 直接注入具体类（推荐）
// ============================================================
@Injectable()
class DirectClassInjection {
  // ✅ 直接注入 ConsoleLogger 类，无需 @Inject
  constructor(private readonly logger: ConsoleLogger) {}
  //                                   ^^^^^^^^^^^^^ class 在运行时存在，可作为 Token
  public doLog(): void {
    this.logger.log('Direct class injection works!');
  }
}

// ============================================================
// 示例 2.3：✅ 正确方式 2 —— 接口 + 字符串 Token（面向接口编程）
// ============================================================
@Injectable()
class StringTokenInjection {
  // ✅ 使用字符串 Token，需要配合 @Inject
  constructor(@Inject(LOGGER_TOKEN) private readonly logger: Logger) {}
  //          ^^^^^^^^^^^^^^^^^^^^ 使用常量，避免拼写错误
  //                                                           ^^^^^^ 接口仅用于类型约束
  public doLog(): void {
    this.logger.log('String token injection works!');
  }
}

// ============================================================
// 示例 2.4：属性注入示例（可选依赖）
// ============================================================
@Injectable()
class PropertyInjectionService {
  // 属性注入方式 1：直接注入类（推荐）
  @Optional() // 如果找不到也不报错
  private readonly directLogger?: ConsoleLogger;

  // 属性注入方式 2：接口 + 字符串 Token
  @Optional()
  @Inject(LOGGER_TOKEN) // 使用常量
  private readonly tokenLogger?: Logger;

  public safeLog(message: string): void {
    // 优先使用 directLogger
    if (this.directLogger) {
      this.directLogger.log(message);
    } else if (this.tokenLogger) {
      this.tokenLogger.log(message);
    } else {
      console.log(`[FALLBACK] ${message}`); // 两个都不存在时的降级处理
    }
  }
}

// ============================================================
// 示例 2.5：模块配置 —— 注册字符串 Token
// ============================================================
/**
 * 【关键】字符串 Token 必须在模块中注册，告诉 DI 容器这个 Token 对应哪个实现
 */
@Module({
  providers: [
    // 注册具体实现类
    ConsoleLogger,

    // 注册字符串 Token（面向接口编程的关键）
    {
      provide: LOGGER_TOKEN, // Token：DI 容器的钥匙
      useClass: ConsoleLogger, // 实现：告诉容器用 ConsoleLogger 类，不能使用Logger，不能使用接口
      /* 因为useClass 需要一个可以被实例化的构造函数 */
    },

    // 注册使用者
    DirectClassInjection,
    StringTokenInjection,
    PropertyInjectionService,
  ],
})
class Example2Module {}
/* 如果只有一个实现，直接注入类确实更简单（推荐）
字符串 Token + 接口的价值在于多态切换：
// 多个实现
class ConsoleLogger implements Logger { ... }
class FileLogger implements Logger { ... }
class RemoteLogger implements Logger { ... }
// 开发环境用 ConsoleLogger
@Module({
  providers: [{
    provide: LOGGER_TOKEN,
    useClass: process.env.NODE_ENV === 'production' 
      ? RemoteLogger    // 生产环境：远程日志
      : ConsoleLogger,  // 开发环境：控制台日志
  }],
})
// 业务代码不需要修改
@Injectable()
class MyService {
  constructor(@Inject(LOGGER_TOKEN) private logger: Logger) {}
  // ✅ 通过修改模块配置切换实现，业务代码零改动
}

其他典型应用：
// 支付服务：生产用真实支付，测试用 Mock
@Module({
  providers: [{
    provide: 'PAYMENT',
    useClass: isTest ? MockPayment : StripePayment,  // 一行配置切换
  }],
})
*/

/**
 * 【使用常量的好处】
 * ❌ 魔法字符串：
 *   provide: 'LOGGER_TOKEN'
 *   @Inject('LOGGER_TOKNE')  // 拼错了！运行时才报错
 *
 * ✅ 使用常量：
 *   const LOGGER_TOKEN = 'LOGGER_TOKEN';
 *   provide: LOGGER_TOKEN
 *   @Inject(LOGGER_TOKEN)  // IDE 自动补全，类型安全
 */

/**
 * ============================================================
 * 📋 核心知识点总结
 * ============================================================
 *
 * 【为什么接口不能直接注入？】
 * TypeScript 接口在编译后会被完全擦除：
 *   interface Logger { log(msg: string): void; }
 *   // 编译成 JavaScript 后 → 空（什么都没有）
 *
 * 【为什么 class 可以直接注入？】
 * class 在 TypeScript 中有双重身份：
 *   1. 作为类型（编译时）：const logger: ConsoleLogger
 *   2. 作为值（运行时）：providers: [ConsoleLogger]
 *
 * 【两种注入方式对比】
 * ┌─────────────────┬──────────────────┬─────────────────────┐
 * │                 │  直接注入类      │  接口 + 字符串 Token │
 * ├─────────────────┼──────────────────┼─────────────────────┤
 * │ 类型安全        │  ✅ 编译时检查    │  ⚠️ Token 易拼错     │
 * │ 面向接口编程    │  ❌ 耦合具体实现  │  ✅ 解耦，易测试      │
 * │ 写法复杂度      │  简单，无需 @Inject│  需要 @Inject       │
 * │ 适用场景        │  单一实现         │  多实现切换          │
 * └─────────────────┴──────────────────┴─────────────────────┘
 *
 * 【最佳实践】
 * - 简单场景：直接注入类 `constructor(private logger: ConsoleLogger)`
 * - 需要多态：使用字符串 Token + 定义常量避免拼写错误
 *   const LOGGER_TOKEN = 'LOGGER_TOKEN';
 *   @Inject(LOGGER_TOKEN)
 */

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
      useClass: process.env['NODE_ENV'] === 'production' ? RealPaymentService : MockPaymentService, // 开发环境用 Mock
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
    // 【问题】第三方库的实例不是用 @Injectable() 装饰的类，无法直接注入
    // 【解决】先创建实例，再用 useValue 注入到容器
    // 【实际项目】
    //   import Redis from 'ioredis';
    //   const redisClient = new Redis({ host: 'localhost', port: 6379 });
    //   providers: [{ provide: 'REDIS_CLIENT', useValue: redisClient }]
    {
      provide: 'REDIS_CLIENT',
      useValue: {
        // 这里用普通对象模拟 Redis 客户端的 API（实际项目中是真实的 Redis 实例）
        get: (key: string): string => {
          // 模拟 Redis GET 命令：返回存储的值
          // 实际: await redis.get('user:1') 返回 'Alice'
          return `value-of-${key}`; // 这里返回模拟值
        },
        set: (key: string, value: string): void => {
          // 模拟 Redis SET 命令：存储键值对
          // 实际: await redis.set('user:1', 'Alice')
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
    @Inject('REDIS_CLIENT') private readonly redis: any, // 注入 Redis 客户端
  ) {}

  public showConfig(): void {
    console.log(`端口: ${this.config.port}, 最大重试: ${this.maxRetry}`);
  }

  public async cacheData(): Promise<void> {
    // 使用注入的 Redis 客户端
    this.redis.set('app:config', JSON.stringify(this.config));
    const cached = this.redis.get('app:config');
    console.log(`从 Redis 获取: ${cached}`);
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

        await new Promise<void>((resolve) => setTimeout(resolve, 100)); // // 暂停 100 毫秒
        /* 常用的 sleep/延迟函数，用于模拟异步操作的耗时 */

        return {
          host,
          port,
          connected: true,
          timestamp: Date.now(),
          databaseUrl: config.databaseUrl,
        };
      },
      inject: ['DB_HOST', 'DB_PORT', 'APP_CONFIG'], // 必须手动指定，工厂函数需要显式声明
      /* inject 数组的作用是告诉 DI 容器：这个工厂函数需要哪些依赖。
        工厂函数需要 3 个参数，对应上面工程方法里的，host, port, config，顺序很重要，必须对应
        inject 是依赖声明清单，告诉 DI 容器"按这个顺序，把这些依赖注入到工厂函数的参数中"。
      */
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
      // 上面的工厂函数参数列表为空，就不需要写inject数组了
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
      useExisting: OriginalLogger, // 指向同一个实例（单例），不创建新的示例
      /* 如果这里使用 useClass，会创建第2个实例 */
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
  /* 每个 HTTP 请求创建一个新实例，同一请求内共享 */

  public getRequestId(): string {
    return this.requestId;
  }
}

// 场景 3：瞬时作用域 —— 每次注入都创建新实例
// 典型用途：无状态工具类、临时对象、一次性使用的对象
@Injectable({ scope: Scope.TRANSIENT })
class TransientService {
  private readonly id: string = crypto.randomUUID(); // 每个实例都有唯一 ID
  /* 每次注入都创建新实例，即使在同一HTTP请求内 */

  public getId(): string {
    return this.id;
  }

  // 无状态方法：纯函数，不依赖实例状态
  public formatDate(date: Date): string {
    return date.toISOString();
  }
}
/* 假设一个请求中注入两次：
REQUEST作用域：同一请求内是同一个实例
  @Controller()
  class MyController {
    constructor(
      private service1: RequestScopedService,
      private service2: RequestScopedService,
    ) {
      console.log(service1.getRequestId() === service2.getRequestId());  // true ✅
      // 同一请求内，两个注入点得到同一个实例
    }
  }
TRANSIENT作用域：每次注入都是新实例
  @Controller()
  class MyController {
    constructor(
      private service1: TransientService,
      private service2: TransientService,
    ) {
      console.log(service1.getId() === service2.getId());  // false ❌
      // 即使在同一个构造函数里，也是两个不同的实例
    }
  }
*/

/* 
NestJS 作用域的向上传播规则：如果单例依赖了 REQUEST 作用域的服务，单例也会被"污染"成 REQUEST 作用域。（作用域会向上传播）
注意：如果一个单例 Service 注入了 REQUEST 作用域的 Provider，单例 Service 本身也需要声明为 REQUEST 作用域
*/
@Injectable({ scope: Scope.REQUEST }) // 必须匹配子依赖的作用域
class UsesRequestScopeService {
  constructor(private readonly requestService: RequestScopedService) {}
}
/* 
作用域传播规则（生命周期从长到短）：
DEFAULT（单例，最长）→ REQUEST（请求级，中等）→ TRANSIENT（瞬时，最短）

传播方向：短生命周期会"感染"长生命周期
- DEFAULT 依赖 REQUEST → 必须改为 REQUEST ✅
- DEFAULT 依赖 TRANSIENT → 必须改为 TRANSIENT ✅
- REQUEST 依赖 TRANSIENT → 必须改为 TRANSIENT ✅

核心原则：消费者的作用域必须 <= 依赖的作用域（生命周期必须更短或相等），否则会产生语义冲突
*/

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
