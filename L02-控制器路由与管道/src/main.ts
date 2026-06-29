import { NestFactory } from "@nestjs/core";
import { Logger, ValidationPipe } from "@nestjs/common";
import { AppModule } from "./app.module";

/**
 * WHAT: 应用入口——启用全局 ValidationPipe
 *
 * WHY: 在 main.ts 中使用 app.useGlobalPipes(new ValidationPipe()) 全局注册 Pipe，
 *   所有请求进入任何 Controller 前都会经过 ValidationPipe 的处理。
 *
 * 【核心原理——全局 Pipe 的注册位置】
 *   NestJS 的请求管线：Middleware → Guard → Interceptor → Pipe → Controller
 *   全局 Pipe 注册到管线中的"Pipe"位置，对每个请求都会执行。
 *   你也可以在方法参数级别注册 Pipe（如 @Body(MyPipe)），
 *   方法级 Pipe 优先于全局 Pipe 执行。
 *
 * 【对比 Spring】
 *   NestJS 的全局 ValidationPipe 相当于 Spring 的 @ControllerAdvice + @InitBinder
 *   都可以全局配置参数验证和转换。
 *
 * 【对比 Express】
 *   Express 没有内置的"参数验证管道"——你需要在每个路由中手动检查 req.params.id
 *   NestJS 的 Pipe 抽象统一了这个过程。
 */
async function bootstrap() {
  const logger = new Logger("Bootstrap");
  const app = await NestFactory.create(AppModule);

  // WHAT: 注册全局 ValidationPipe——所有 Controller 的 @Body() 都会自动验证
  // WHY: whitelist: true → 自动过滤 DTO 中未定义的字段（安全！）
  //      transform: true → 自动将普通对象转为 DTO 类实例（配合 class-transformer）
  //      forbidNonWhitelisted: true → 出现未定义字段时抛出 400 错误
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
    }),
  );

  const port = 3000;
  await app.listen(port);
  logger.log(`应用已启动: http://localhost:${port}`);
  logger.log("实验路线：");
  logger.log(`  GET  /cats             — 获取所有猫`);
  logger.log(`  GET  /cats/:id         — 获取指定猫（ParseIntPipe 自动转换）`);
  logger.log(`  POST /cats             — 创建猫（ValidationPipe 自动验证）`);
  logger.log(`  GET  /cats/breed/:breed — 测试自定义 UppercasePipe`);
  logger.log(`  GET  /cats/search?name=咪咪 — 测试 @Query() 参数绑定`);
}

bootstrap();
