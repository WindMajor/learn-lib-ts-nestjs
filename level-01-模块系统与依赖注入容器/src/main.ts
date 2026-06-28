import { NestFactory } from "@nestjs/core";
import { Logger } from "@nestjs/common";
import { AppModule } from "./app.module";

/**
 * WHAT: NestJS 应用入口——这里是整个 IoC 容器的起点
 *
 * WHY: NestFactory.create(AppModule) 做了三件事：
 *   1. 扫描 AppModule 的装饰器元数据（@Module 参数）
 *   2. 递归分析所有 imports → 构建完整的 Provider 依赖图（DependencyGraph）
 *   3. 初始化 Express（默认适配器）并挂载所有 Controller 路由
 *
 * LIFECYCLE: create() → 所有 Module 的构造函数 → onModuleInit() → listen()
 *
 * 【对比 Express】
 *   Express: const app = express(); app.listen(3000);
 *   NestJS:  const app = await NestFactory.create(AppModule); await app.listen(3000);
 *   差异：Express 是手动挂载，NestJS 是声明式——你只告诉容器"根模块是谁"，
 *   容器自动完成一切。这是 IoC 的核心理念：不要调用我们，我们会调用你。
 *
 * 【对比 Spring Boot】
 *   Spring: SpringApplication.run(Application.class, args);
 *   NestJS: NestFactory.create(AppModule);
 *   本质相同——都是通过"根配置类/根模块"启动 IoC 容器。
 *   但 Spring 用 Java 注解处理器 + 字节码增强（编译期），
 *   NestJS 用 TypeScript 装饰器 + reflect-metadata（运行期）。
 *
 * 【对比 Rust (Axum)】
 *   Rust 没有"容器"概念——所有依赖在编译期就确定好了。
 *   NestJS 的 IoC 容器多了一层运行期反射，代价是启动稍慢，
 *   但换来的是极致的解耦和可测试性（你可以 mock 任何 Provider）。
 *
 * WARNING:
 *   - 必须 import 'reflect-metadata'（或 tsconfig 中 emitDecoratorMetadata: true）
 *     否则装饰器产生的类型元数据会丢失 → 构造函数参数类型变成 Object
 *     → NestJS 无法判断该注入什么 Provider → 抛出 UnknownDependenciesException
 *   - NestFactory.create() 是 async——必须 await，否则 app 可能未完全初始化
 */
async function bootstrap() {
  const logger = new Logger("Bootstrap");

  // STEP 1: 创建 IoC 容器，传入根模块
  logger.log("正在创建 NestJS IoC 容器...");
  const app = await NestFactory.create(AppModule);

  // STEP 2: 监听端口
  const port = 3000;
  await app.listen(port);

  logger.log(`IoC 容器已启动，监听端口 ${port}`);
  logger.log(
    `访问 http://localhost:${port}/cats 查看 Cats 模块（验证依赖注入）`,
  );
  logger.log(
    `访问 http://localhost:${port}/database/info 查看 Database 模块（验证自定义 Provider）`,
  );
}
bootstrap();
