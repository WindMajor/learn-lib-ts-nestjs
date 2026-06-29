/**
 * ============================================================
 * 第 11 章：配置管理
 * ============================================================
 *
 * 【学习目标】
 *   1. 掌握 @nestjs/config 模块的核心用法：ConfigModule.forRoot()
 *   2. 掌握 ConfigService 的注入和类型安全使用
 *   3. 掌握环境变量验证：Joi 或 class-validator 启动时校验
 *   4. 掌握自定义配置文件 registerAs() 创建命名空间配置
 *   5. 理解多环境配置和加载优先级
 *
 * 【与 Express/FastAPI/Spring/Django 的对比提示】
 *   - Express：dotenv + process.env 手动读取，无类型和验证
 *   - FastAPI：Pydantic Settings（BaseSettings）—— 与 NestJS 的配置验证理念一致
 *   - Spring：applicaiton.yml + @Value / @ConfigurationProperties
 *   - Django：settings.py 模块化配置
 *
 * 【与 Vue3 前端的协作关系】
 *   - .env 文件存放环境变量 = 前端 VITE_ 前缀的环境变量
 *   - 后端配置无命名限制，但不应提交到 Git（.env 在 .gitignore 中）
 *   - 前后端各自维护 .env.example 作为环境变量文档
 */

import { Injectable, Module } from '@nestjs/common';

// ============================================================
// 示例 1：@nestjs/config 基本使用
// ============================================================

/**
 * 【场景】在 main.ts 中导入 ConfigModule，读取 .env 文件
 * 【语法点】ConfigModule.forRoot() 自动读取项目根目录的 .env 文件
 * 【NestJS 设计意图】集中管理配置，通过 DI 使用，避免分散的 process.env 调用
 * 【DI 容器行为】ConfigModule 将 .env 的所有键值对注册为 Provider
 */

// ---- 模拟 @nestjs/config ----
interface ConfigService_11 {
  get<T = string>(key: string): T | undefined;
  getOrThrow<T = string>(key: string): T;
}

// 简化版 ConfigService 实现
@Injectable()
class MockConfigService implements ConfigService_11 {
  private readonly config: Map<string, string> = new Map();

  constructor() {
    // 模拟从 .env 加载
    this.config.set('PORT', '3000');
    this.config.set('DATABASE_URL', 'postgresql://localhost:5432/nestjs_learn');
    this.config.set('JWT_SECRET', 'my-secret-key');
    this.config.set('JWT_EXPIRATION', '7d');
    this.config.set('NODE_ENV', 'development');
  }

  public get<T = string>(key: string): T | undefined {
    return this.config.get(key) as T | undefined;
  }

  public getOrThrow<T = string>(key: string): T {
    const value: T | undefined = this.get<T>(key);
    if (value === undefined) {
      throw new Error(`配置项 "${key}" 未定义，请检查 .env 文件`);
    }
    return value;
  }
}

// 模拟 ConfigModule
const ConfigModule_11 = {
  forRoot: (options?: {
    isGlobal?: boolean;
    envFilePath?: string;
    validationSchema?: unknown;
  }) => {
    const configService = new MockConfigService();
    return {
      module: class ConfigRootModule {},
      global: options?.isGlobal ?? true,
      providers: [{ provide: 'CONFIG_SERVICE', useValue: configService }],
      exports: ['CONFIG_SERVICE'],
    };
  },
};

// ---- 使用示例 ----

// main.ts 中导入：
// @Module({
//   imports: [ConfigModule.forRoot({
//     isGlobal: true,                  // 全局模块，所有模块都能使用
//     envFilePath: '.env',            // env 文件路径
//     // envFilePath: ['.env.development.local', '.env.development', '.env'],
//     // 加载优先级（前面的优先）
//   })],
// })
// class AppModule_11 {}

// Service 中使用 ConfigService：
@Injectable()
class DatabaseService {
  constructor(private readonly configService: MockConfigService) {}

  public connect(): void {
    // 类型安全的配置读取
    const url: string = this.configService.getOrThrow<string>('DATABASE_URL');
    const nodeEnv: string =
      this.configService.get<string>('NODE_ENV') ?? 'development';

    console.log(`[${nodeEnv}] 连接数据库: ${url}`);

    // ❌ 不要这样做：分散的 process.env 调用
    // const url = process.env.DATABASE_URL;  // 无类型、无验证
  }

  public getJwtConfig(): { secret: string; expiration: string } {
    return {
      secret: this.configService.getOrThrow<string>('JWT_SECRET'),
      expiration: this.configService.get<string>('JWT_EXPIRATION') ?? '7d',
    };
  }
}

// ============================================================
// 示例 2：环境变量验证 —— Joi Schema 验证
// ============================================================

/**
 * 【场景】启动时验证必填环境变量，防止运行时因缺失配置崩溃
 * 【语法点】Joi.object().validate(process.env)
 * 【NestJS 设计意图】Fail-fast 原则：在启动阶段发现问题，而非运行时报错
 *                   与前端构建时的环境变量检查理念一致
 */

// Joi 验证模式（实际项目中使用 joi 库）
interface JoiSchema {
  validate: (config: Record<string, unknown>) => {
    error?: { message: string };
    value: Record<string, unknown>;
  };
}

// 模拟 Joi Schema
const createValidationSchema = (): JoiSchema => {
  return {
    validate: (config: Record<string, unknown>) => {
      const errors: string[] = [];

      // 必填项检查
      if (!config['DATABASE_URL']) {
        errors.push('DATABASE_URL 是必填项');
      }
      if (!config['JWT_SECRET']) {
        errors.push('JWT_SECRET 是必填项');
      }
      if (
        typeof config['JWT_SECRET'] === 'string' &&
        config['JWT_SECRET'].length < 32
      ) {
        errors.push('JWT_SECRET 长度不能少于 32 个字符');
      }

      // 类型检查
      const port: number = parseInt((config['PORT'] as string) ?? '3000', 10);
      if (isNaN(port) || port < 1 || port > 65535) {
        errors.push('PORT 必须是 1-65535 之间的整数');
      }

      if (errors.length > 0) {
        return {
          error: { message: `配置验证失败:\n${errors.join('\n')}` },
          value: config,
        };
      }

      return { value: { ...config, PORT: port } };
    },
  };
};

// ConfigModule 使用验证
const validatedConfigModule = ConfigModule_11.forRoot({
  isGlobal: true,
  validationSchema: createValidationSchema(),
  // 如果验证失败，应用启动时就会抛出异常
});

// ============================================================
// 示例 3：自定义配置文件 —— registerAs() 命名空间配置
// ============================================================

/**
 * 【场景】将配置按功能分组（database、jwt、cache、email），
 *        每个命名空间独立管理，注入时按命名空间获取
 * 【语法点】registerAs('namespace', configFactory) + ConfigService.get('namespace')
 * 【NestJS 设计意图】配置的模块化管理，避免单一巨型配置对象
 */

// 定义配置类型
interface DatabaseConfig {
  host: string;
  port: number;
  user: string;
  password: string;
  database: string;
  url: string;
}

interface JwtConfig {
  secret: string;
  expiration: string;
  refreshExpiration: string;
}

interface CacheConfig {
  ttl: number;
  maxItems: number;
}

// registerAs 工厂函数
const databaseConfig = (configService: MockConfigService): DatabaseConfig => ({
  host: configService.get<string>('DB_HOST') ?? 'localhost',
  port: parseInt(configService.get<string>('DB_PORT') ?? '5432', 10),
  user: configService.getOrThrow<string>('DB_USER'),
  password: configService.getOrThrow<string>('DB_PASSWORD'),
  database: configService.get<string>('DB_NAME') ?? 'nestjs_learn',
  url: configService.getOrThrow<string>('DATABASE_URL'),
});

const jwtConfig = (configService: MockConfigService): JwtConfig => ({
  secret: configService.getOrThrow<string>('JWT_SECRET'),
  expiration: configService.get<string>('JWT_EXPIRATION') ?? '7d',
  refreshExpiration:
    configService.get<string>('JWT_REFRESH_EXPIRATION') ?? '30d',
});

const cacheConfig = (): CacheConfig => ({
  ttl: 300, // 5 分钟
  maxItems: 1000,
});

// 使用命名空间配置
@Injectable()
class NamespacedConfigService {
  constructor(private readonly configService: MockConfigService) {}

  public getDatabaseConfig(): DatabaseConfig {
    // 类型安全的命名空间配置读取
    return databaseConfig(this.configService);
  }

  public getJwtConfig(): JwtConfig {
    return jwtConfig(this.configService);
  }

  public getCacheConfig(): CacheConfig {
    return cacheConfig();
  }
}

// ============================================================
// 示例 4：多环境配置加载策略
// ============================================================

/**
 * 【场景】不同环境使用不同的配置（开发、测试、生产）
 * 【语法点】envFilePath 数组，前面文件优先级更高
 * 【NestJS 设计意图】支持标准的 .env 加载层级，与 dotenv-flow 一致
 */

const multiEnvConfig = {
  // 加载优先级（前面的优先）：
  envFilePath: [
    '.env.development.local', // 本地开发（不提交 Git）
    '.env.development', // 开发环境
    '.env', // 默认配置
  ],

  // 忽略 .env 文件不存在的情况（生产环境可能没有 .env 文件）
  ignoreEnvFile: process.env['NODE_ENV'] === 'production',

  // 自定义环境文件加载逻辑
  // load: [databaseConfig, jwtConfig],
};

// ============================================================
// 示例 5：配置与代码的类型安全桥接
// ============================================================

/**
 * 【场景】确保代码中使用的配置键是有效的，避免字符串拼写错误
 * 【语法点】定义配置类型枚举，在 ConfigService.get() 中使用
 * 【NestJS 设计意图】类型安全 = 编译时就能发现错误，而非运行时炸裂
 */

// 定义配置键的联合类型
type ConfigKey =
  | 'PORT'
  | 'DATABASE_URL'
  | 'JWT_SECRET'
  | 'JWT_EXPIRATION'
  | 'CORS_ORIGIN'
  | 'UPLOAD_DIR'
  | 'NODE_ENV';

// 类型安全的配置获取
@Injectable()
class TypeSafeConfigService {
  constructor(private readonly configService: MockConfigService) {}

  // 泛型约束确保 Key 是合法的配置键
  public getConfig<K extends ConfigKey>(key: K): string | undefined {
    return this.configService.get<string>(key);
  }

  public getRequiredConfig<K extends ConfigKey>(key: K): string {
    return this.configService.getOrThrow<string>(key);
  }
}

// ============================================================
// ❌ 常见错误 1：环境变量读取为 undefined
// ============================================================

/**
 * 【错误现象】configService.get('KEY') 返回 undefined，应用运行时崩溃
 * 【错误原因】1）KEY 未在 .env 中定义 2）ConfigModule 未导入
 *             3）.env 文件不在项目根目录 4）环境变量名拼写错误
 * 【正确写法】使用 getOrThrow() 在启动时 fail-fast，而非默默返回 undefined
 */

// ❌ 错误写法：
// const secret = this.configService.get('JWT_SECRET');
// console.log(secret);  // undefined → Token 签名失败但不知道原因

// ✅ 正确写法：
// const secret = this.configService.getOrThrow('JWT_SECRET');  // 启动时抛异常

// ============================================================
// ❌ 常见错误 2：敏感信息泄露到日志
// ============================================================

/**
 * 【错误现象】日志中打印了完整的 DATABASE_URL（含密码）或 JWT_SECRET
 * 【错误原因】开发时用 console.log(this.config) 或错误日志中包含配置
 * 【正确写法】配置对象序列化时脱敏处理
 */

// ❌ 错误写法：
// console.log('当前配置:', this.configService);  // 可能泄露密码

// ✅ 正确写法：
const safeLogConfig = (config: MockConfigService): void => {
  const dbUrl: string = config.get<string>('DATABASE_URL') ?? '';
  const maskedUrl: string = dbUrl.replace(/\/\/.*@/, '//***:***@'); // 脱敏
  console.log('数据库地址:', maskedUrl);
  // 数据库地址: postgresql://***:***@localhost:5432/nestjs_learn
};

// ============================================================
// ❌ 常见错误 3：配置在模块外使用（在 Provider 外通过 process.env 直接读取）
// ============================================================

/**
 * 【错误现象】模块的 imports 数组中使用 process.env.XXX，而不是通过 ConfigService
 * 【错误原因】模块定义发生在 DI 容器初始化之前，此时 ConfigService 不可用
 *            但直接使用 process.env 无法获得类型安全、验证、默认值等好处
 * 【正确写法】在 Provider 内（如 useFactory）通过 DI 获取 ConfigService
 */

// ❌ 错误写法（模块级别的直接读取）：
// @Module({
//   imports: [
//     TypeOrmModule.forRoot({
//       url: process.env.DATABASE_URL,  // 直接读取，无验证、无默认值
//     }),
//   ],
// })

// ✅ 正确写法（通过 useFactory 注入 ConfigService）：
// @Module({
//   imports: [
//     TypeOrmModule.forRootAsync({
//       imports: [ConfigModule],
//       inject: [ConfigService],
//       useFactory: (configService: ConfigService) => ({
//         url: configService.getOrThrow('DATABASE_URL'),
//       }),
//     }),
//   ],
// })

console.log('=== 第 11 章示例代码结束 ===');

// ============================================================
// 本章小结
// ============================================================
/*
 * 【核心要点】
 *   - ConfigModule.forRoot() 加载 .env 并注册全局 ConfigService
 *   - ConfigService 提供 get() 和 getOrThrow() 类型安全的配置读取
 *   - validationSchema 在启动时校验必填项和类型（fail-fast）
 *   - registerAs() 创建命名空间配置，按功能分组
 *   - 多环境通过 envFilePath 数组控制加载优先级
 *   - 类型安全的 ConfigKey 联合类型防止字符串拼写错误
 *
 * 【与前后章的关联】
 *   - 第 04 章：ConfigService 是一个 Provider，通过 DI 注入
 *   - 第 12 章：数据库连接配置通过 ConfigService 获取
 *   - 第 13 章：JWT 密钥通过 ConfigService 读取
 *
 * 【常见面试题】
 *   Q: 如何保证环境变量在启动时被正确配置？
 *   A: 使用 ConfigModule.forRoot({ validationSchema }) 在启动时校验，
 *      必填项使用 getOrThrow()，缺失则立即抛异常。
 *      这是 fail-fast 原则的体现。
 *
 *   Q: registerAs 的作用是什么？
 *   A: 创建命名空间配置，将相关配置分组管理（如 database、jwt、cache），
 *      使用时 configService.get('database.host') 而非分散的 get()。
 */

// ============================================================
// 🎯 通关检查清单
// ============================================================
/*
 * [ ] 能使用 ConfigModule.forRoot() 加载 .env 文件
 * [ ] 能编写环境变量验证逻辑（启动时校验）
 * [ ] 能使用 registerAs() 创建命名空间配置
 * [ ] 能说出 1 个与 Spring Boot 配置管理的差异
 * [ ] 能指出 1 个常见错误及修复方法
 */
