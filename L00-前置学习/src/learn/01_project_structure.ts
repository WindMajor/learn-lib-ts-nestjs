/**
 * ============================================================
 * 第 01 章：项目结构与装饰器本质
 * ============================================================
 *
 * 【学习目标】
 *   1. 理解 NestJS 项目目录结构的职责划分
 *   2. 掌握 main.ts 中 NestFactory.create() 的链式配置模式
 *   3. 理解 TypeScript 装饰器的本质：experimentalDecorators + reflect-metadata
 *   4. 了解 nest-cli.json 的核心配置项
 *   5. 理解 NestJS 与 Express 的底层关系
 *
 * 【与 Express/FastAPI/Spring/Django 的对比提示】
 *   - Express：NestJS 默认底层就是 Express，但包装了模块化架构和 DI 容器 （Dependency Injection 依赖注入容器）
 *   - FastAPI：两者都大量使用装饰器，但 FastAPI 是函数级管理，NestJS 是类级管理
 *   - Spring：都使用了 DI 容器 + 模块化 + 注解/装饰器，设计理念高度相似
 *   - Django：Django 是「约定优于配置」的大而全框架，NestJS 更灵活、模块边界更清晰
 *
 * 【与 Vue3 前端的协作关系】
 *   - main.ts 相当于 Vue3 的 main.ts：全局注册插件、配置 Provider
 *   - 项目结构中的 Controller = Vue Router 的路由配置
 *   - 项目结构中的 Module = Vue3 的 Feature Module（按功能拆分）
 */

// ============================================================
// 示例 1：NestJS 最简入口 —— main.ts 基本结构
// ============================================================

/**
 * 【场景】应用启动入口
 * 【语法点】NestFactory.create() 创建应用实例
 * 【NestJS 设计意图】工厂模式创建应用，隐藏 Express/Fastify 底层细节
 * 【DI 容器行为】create() 内部会扫描所有 @Module 装饰的类，构建完整的 DI 容器树
 */
import { NestFactory } from '@nestjs/core';
import type { INestApplication } from '@nestjs/common';

// 注：此处 AppModule 假设已在 app.module.ts 中定义
// import { AppModule } from './app.module';

// ---- 模拟定义，实际项目中应在独立文件中 ----
class MockAppModule {}
// --------------------------------------------

const bootstrap1 = async (): Promise<void> => {
  // NestFactory.create() 返回一个 NestFastifyApplication 或 NestExpressApplication
  const app: INestApplication = await NestFactory.create(MockAppModule);
  await app.listen(process.env['PORT'] ?? 3000);
  console.log(`Application is running on: ${await app.getUrl()}`);
};

// ============================================================
// 示例 2：main.ts 的链式配置 —— 全局前缀、CORS、Swagger
// ============================================================

/**
 * 【场景】生产级 main.ts 的完整配置
 * 【语法点】app.setGlobalPrefix()、app.enableCors()、app.useGlobalPipes() 等链式调用
 * 【NestJS 设计意图】提供统一的全局配置入口，不污染具体业务代码
 * 【DI 容器行为】全局配置在模块初始化之前执行，影响所有后续的请求处理
 */
import { ValidationPipe, VersioningType } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';

const bootstrap2 = async (): Promise<void> => {
  const app: INestApplication = await NestFactory.create(MockAppModule);

  // 1. 全局路由前缀：所有路由自动加上 /api/v1 前缀
  app.setGlobalPrefix('api/v1');

  // 2. 全局管道：自动验证和转换请求数据
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true, // 自动剥离 DTO 中未定义的属性
      forbidNonWhitelisted: true, // 存在未定义属性时抛出 400
      transform: true, // 自动类型转换（如 string → number）
    }),
  );

  // 3. CORS（Cross-Origin Resource Sharing 跨域资源共享） 配置：允许前端跨域访问
  app.enableCors({
    origin: process.env['CORS_ORIGIN'] ?? 'http://localhost:5173',
    credentials: true, // 允许携带 Cookie
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  });

  // 4. API 版本控制
  app.enableVersioning({
    type: VersioningType.URI, // 通过 URI 控制版本：/v1/users、/v2/users
    defaultVersion: '1',
  });

  // 5. Swagger 文档（简要配置）
  const config = new DocumentBuilder()
    .setTitle('NestJS Learn API')
    .setDescription('NestJS 系统化学习项目 API 文档')
    .setVersion('1.0')
    .addBearerAuth() // JWT Token 认证
    .build();
  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api/docs', app, document); // 访问 /api/docs 查看文档

  await app.listen(3000);
};

// ============================================================
// 示例 3：装饰器本质 —— experimentalDecorators + reflect-metadata
// ============================================================

/**
 * 【场景】理解装饰器在运行时的行为
 * 【语法点】装饰器是一个函数，在类定义时执行；reflect-metadata 存储元数据
 * 【NestJS 设计意图】装饰器 = 声明式编程，用代码声明意图而非手动配置
 * 【DI 容器行为】NestJS 启动时会读取 reflect-metadata 存储的元数据，构建依赖关系图
 */
import 'reflect-metadata';

// 模拟 NestJS 的 @Injectable() 装饰器（简化版）
const Injectable = (): ClassDecorator => {
  return (target: object) => {
    // 在类的原型上存储元数据 —— 「这个类是可注入的」
    Reflect.defineMetadata('injectable', true, target);
    // 获取构造函数的参数类型（用于 DI 容器自动解析依赖）
    const paramTypes: unknown[] =
      (Reflect.getMetadata('design:paramtypes', target) as unknown[]) ?? [];
    Reflect.defineMetadata('design:paramtypes', paramTypes, target);
    console.log(
      `[Injectable] ${(target as { name?: string }).name} 被标记为可注入, 依赖:`,
      paramTypes,
    );
  };
};

// 模拟 NestJS 的 @Module() 装饰器（简化版）
interface ModuleMetadata {
  providers: unknown[];
  controllers: unknown[];
  imports: unknown[];
  exports: unknown[];
}

const Module = (metadata: ModuleMetadata): ClassDecorator => {
  return (target: object) => {
    Reflect.defineMetadata('module', metadata, target);
    console.log(
      `[Module] ${(target as { name?: string }).name} 模块已注册，provider数量: ${metadata.providers.length}`,
    );
  };
};

// 使用示例
@Injectable()
class UserService {
  public findAll(): string[] {
    return ['user1', 'user2'];
  }
}

@Module({
  providers: [UserService],
  controllers: [],
  imports: [],
  exports: [UserService],
})
class UserModule {}

// 验证元数据
const isInjectable: boolean =
  Reflect.getMetadata('injectable', UserService) === true;
const moduleMetadata = Reflect.getMetadata('module', UserModule) as
  ModuleMetadata | undefined;
console.log('UserService 可注入:', isInjectable);
console.log('UserModule providers 数量:', moduleMetadata?.providers.length);

// ============================================================
// 示例 4：nest-cli.json 核心配置解读
// ============================================================

/**
 * 【场景】理解 nest-cli.json 的配置项含义
 * 【语法点】JSON Schema 驱动的 CLI 配置
 * 【NestJS 设计意图】通过配置文件控制代码生成和编译行为
 */

interface NestCliConfig {
  /** JSON Schema 引用 */
  $schema: string;
  /** 代码生成器的集合：@nestjs/schematics 是官方默认 */
  collection: string;
  /** 源代码根目录（相对于项目根目录） */
  sourceRoot: string;
  /** TypeScript 编译器选项 */
  compilerOptions: {
    /** 每次构建前是否删除 dist 目录 */
    deleteOutDir: boolean;
    /** Webpack 模式（可选，用于热重载优化） */
    webpack?: boolean;
    /** 需要额外编译的资源文件（如 .hbs 模板） */
    assets?: string[];
    /** 监听额外的文件变化 */
    watchAssets?: boolean;
  };
  /** 代码生成器选项 */
  generateOptions?: {
    /** 生成文件时使用 flat（扁平）风格还是子目录风格 */
    flat?: boolean;
    /** 是否跳过生成 spec 测试文件 */
    spec?: boolean;
    /** 是否跳过生成 import 语句 */
    skipImport?: boolean;
  };
}

const mockNestCliConfig: NestCliConfig = {
  $schema: 'https://json.schemastore.org/nest-cli',
  collection: '@nestjs/schematics',
  sourceRoot: 'src',
  compilerOptions: {
    deleteOutDir: true, // 构建前清理 dist，防止旧文件残留
  },
  generateOptions: {
    flat: false, // 生成文件放在子目录中（模块风格）
    spec: true, // 默认生成测试文件
  },
};
console.log(
  'nest-cli.json 示例配置:',
  JSON.stringify(mockNestCliConfig, null, 2),
);

// ============================================================
// 示例 5：NestJS 底层适配器切换 —— Express → Fastify
// ============================================================

/**
 * 【场景】NestJS 默认使用 Express，但可以切换到 Fastify 以获得更高性能
 * 【语法点】FastifyAdapter 替换默认的 ExpressAdapter
 * 【NestJS 设计意图】平台无关的架构，通过适配器模式解耦 HTTP 层
 * 【对比】Express: 生态丰富、中间件多；Fastify: 性能更好、Schema 验证内置
 */
import { FastifyAdapter } from '@nestjs/platform-fastify';
import type { NestFastifyApplication } from '@nestjs/platform-fastify';

const bootstrap3 = async (): Promise<void> => {
  // 切换到 Fastify
  const app: NestFastifyApplication =
    await NestFactory.create<NestFastifyApplication>(
      MockAppModule,
      new FastifyAdapter({ logger: true }),
    );

  // Fastify 监听端口（与 Express 完全相同的调用方式）
  await app.listen(3000, '0.0.0.0');
};

// ============================================================
// 示例 6：项目目录结构详解
// ============================================================

/**
 * 【场景】标准 NestJS 项目目录结构及各目录职责
 * 【语法点】无代码，纯注释解释
 * 【NestJS 设计意图】约定式结构让大型团队能快速理解项目组织
 *
 * nestjs-basic-learn/
 * ├── src/                          # 源代码根目录
 * │   ├── main.ts                   # 应用入口：创建实例、全局配置、监听端口
 * │   ├── app.module.ts             # 根模块：统一导入所有子模块
 * │   ├── app.controller.ts         # 根控制器：健康检查、根路径
 * │   ├── app.service.ts            # 根服务
 * │   ├── users/                    # 用户模块（功能模块示例）
 * │   │   ├── users.module.ts       # 模块定义
 * │   │   ├── users.controller.ts   # 控制器（路由层）
 * │   │   ├── users.service.ts      # 服务层（业务逻辑）
 * │   │   ├── dto/                  # 数据传输对象
 * │   │   │   ├── create-user.dto.ts
 * │   │   │   └── update-user.dto.ts
 * │   │   └── entities/             # 实体（可选，Drizzle 项目使用 schema 定义，不需要单独实体）
 * │   ├── auth/                     # 认证模块
 * │   ├── common/                   # 公共模块（守卫、拦截器、过滤器、装饰器）
 * │   │   ├── guards/
 * │   │   ├── interceptors/
 * │   │   ├── filters/
 * │   │   └── decorators/
 * │   └── learn/                    # 本项目的学习文件（非生产代码）
 * ├── drizzle/                     # Drizzle ORM 迁移文件
 * │   └── migrations/               # SQL 迁移文件
 * ├── src/db/                       # Drizzle 数据层
 * │   ├── schema.ts                 # 数据库表定义
 * │   ├── drizzle.service.ts        # Drizzle 服务
 * │   ├── drizzle.module.ts         # Drizzle 模块
 * │   └── index.ts                  # 统一导出
 * ├── test/                         # E2E 测试
 * │   ├── app.e2e-spec.ts
 * │   └── jest-e2e.json
 * ├── nest-cli.json                 # NestJS CLI 配置
 * ├── tsconfig.json                 # TypeScript 编译配置
 * ├── tsconfig.build.json           # 生产构建用 TypeScript 配置
 * ├── docker-compose.yml            # Docker 基础设施编排
 * └── .env                          # 环境变量（不提交到 Git）
 */

// ============================================================
// 示例 7：Swagger DocumentBuilder 的完整配置示例
// ============================================================

/**
 * 【场景】配置完整的 Swagger 文档（为前端生成 API 文档）
 * 【语法点】DocumentBuilder 链式调用
 * 【NestJS 设计意图】代码即文档，减少前后端沟通成本
 */
import { DocumentBuilder as SwaggerDocBuilder } from '@nestjs/swagger';

const createSwaggerConfig = (): Omit<
  Parameters<typeof SwaggerModule.createDocument>[1],
  ''
> => {
  const config = new SwaggerDocBuilder()
    .setTitle('NestJS Learn API')
    .setDescription('NestJS 系统化学习项目 API 文档')
    .setVersion('1.0')
    .setContact('开发者', 'https://example.com', 'dev@example.com')
    .addBearerAuth(
      { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' },
      'JWT',
    )
    .addTag('users', '用户相关接口')
    .addTag('posts', '文章相关接口')
    .addTag('auth', '认证相关接口')
    .build();

  return config;
};
console.log('Swagger 配置已创建');

// ============================================================
// ❌ 常见错误 1：忘记导入 reflect-metadata
// ============================================================

/**
 * 【错误现象】启动时报错：TypeError: Reflect.getMetadata is not a function
 * 【错误原因】reflect-metadata 是装饰器元数据系统的基础，必须在项目入口第一行导入
 * 【正确写法】在 main.ts 的第一行写：import 'reflect-metadata';
 */

// ❌ 错误写法：
// import { NestFactory } from '@nestjs/core';  // 忘记先导入 reflect-metadata

// ✅ 正确写法：
// import 'reflect-metadata';   // 必须在所有其他导入之前
// import { NestFactory } from '@nestjs/core';

// ============================================================
// ❌ 常见错误 2：@Injectable() 忘记写
// ============================================================

/**
 * 【错误现象】Nest can't resolve dependencies of the XxxController
 * 【错误原因】DI 容器只认识被 @Injectable() 标记的类，
 *            没有这个装饰器，容器无法创建实例和解析依赖
 * 【正确写法】所有需要被注入的类都必须加 @Injectable()
 */

// ❌ 错误写法：
// class UserService {        // 缺少 @Injectable()
//   findAll() { return []; }
// }

// ✅ 正确写法：
// @Injectable()              // 必须加这个装饰器
// class UserService {
//   findAll() { return []; }
// }

// ============================================================
// ❌ 常见错误 3：装饰器导入错包
// ============================================================

/**
 * 【错误现象】装饰器不生效或类型不匹配
 * 【错误原因】NestJS 的装饰器必须从 @nestjs/common 导入，不能从 express 或其他包导入
 * 【正确写法】统一从 @nestjs/common 导入
 */

// ❌ 错误写法：
// import { Get, Post } from 'express';  // Express 没有这些装饰器

// ✅ 正确写法：
// import { Get, Post, Controller, Module, Injectable } from '@nestjs/common';

// 引用所有 demo 变量以避免 unused-vars 警告
void bootstrap1;
void bootstrap2;
void bootstrap3;
void createSwaggerConfig;

console.log('=== 第 01 章示例代码结束 ===');

// ============================================================
// 本章小结
// ============================================================
/*
 * 【核心要点】
 *   - NestFactory.create() 是应用入口，返回平台无关的 INestApplication
 *   - 装饰器 = 声明式编程，背后是 TypeScript experimentalDecorators + reflect-metadata
 *   - nest-cli.json 控制编译和代码生成行为
 *   - NestJS 默认底层是 Express，可切换到 Fastify（通过适配器模式）
 *   - 项目结构遵循「模块化」原则，每个功能模块有自己的 module/controller/service/dto
 *
 * 【与前一章的关联】这是开篇章节，为后续所有章节奠定项目认知基础
 * 【与后一章的关联】第 02 章将深入模块系统 —— @Module() 是 NestJS 的组织核心
 *
 * 【常见面试题】
 *   Q: NestJS 和 Express 是什么关系？
 *   A: NestJS 默认底层使用 Express（通过 @nestjs/platform-express），
 *      但它在上层封装了模块化架构、DI 容器、装饰器等企业级特性。
 *      也可以通过 FastifyAdapter 切换到 Fastify。
 *
 *   Q: 什么是 decorator（装饰器）？为什么 NestJS 大量使用它？
 *   A: 装饰器是 TypeScript 的实验性特性，本质是函数，用于在类/方法/属性/参数
 *      上添加元数据和行为。NestJS 用它实现声明式编程（如 @Get() 定义路由），
 *      避免繁琐的配置文件和手动注册。
 *
 *   Q: reflect-metadata 的作用是什么？
 *   A: 它扩展了 Reflect API，允许在运行时存储和读取类的元数据（类型信息、
 *      自定义键值）。NestJS 的 DI 容器依赖它来解析构造函数参数类型。
 */

// ============================================================
// 🎯 通关检查清单
// ============================================================
/*
 * [ ] 能解释 NestJS 项目的标准目录结构
 * [ ] 能写一个完整的 main.ts（全局前缀、CORS、管道、Swagger）
 * [ ] 能解释装饰器实验性特性和 reflect-metadata 元数据机制
 * [ ] 能说出 NestJS 和 Express 的底层关系
 * [ ] 能指出 1 个常见错误及修复方法（忘记 import 'reflect-metadata'）
 */
