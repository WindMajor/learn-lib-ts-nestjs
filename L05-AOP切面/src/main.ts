import { NestFactory } from "@nestjs/core";
import { Logger, ValidationPipe } from "@nestjs/common";
import { AppModule } from "./app.module";
import { AllExceptionsFilter } from "./common/filters/all-exceptions.filter";
import { TransformInterceptor } from "./common/interceptors/transform.interceptor";
import { LoggingInterceptor } from "./common/interceptors/logging.interceptor";

async function bootstrap() {
  const logger = new Logger("Bootstrap");
  const app = await NestFactory.create(AppModule);

  /**
   * WHAT: 全局注册 AOP 组件
   *
   * 【绑定顺序即执行顺序】
   *   全局注册的 Guard/Interceptor/Filter 在模块级、控制器级、方法级之前执行。
   *
   *   【实际执行链路（本关配置）】
   *   1. LoggingInterceptor (前) — 记录请求开始时间
   *   2. TransformInterceptor (前) — 包装响应
   *   3. AuthGuard (全局) — 检查请求头
   *   4. 方法级 RoleGuard — 检查角色
   *   5. ValidationPipe — 验证参数
   *   6. Controller 方法 — 执行业务
   *   7. TransformInterceptor (后) — 统一响应格式
   *   8. LoggingInterceptor (后) — 输出请求耗时
   *   9. AllExceptionsFilter — 捕获异常（如果有）
   *
   * 【对比 Spring Boot】
   *   Spring 的 AOP 执行顺序通过 @Order 注解控制。
   *   NestJS 通过绑定位置控制——更直观但不如 @Order 灵活。
   *
   * 【对比 Express】
   *   Express 直接通过 app.use() 的顺序控制中间件执行。
   *   NestJS 的 AOP 比 Express 的中间件层级更细——Guard/Interceptor/Filter 各有明确的语义。
   */
  app.useGlobalFilters(new AllExceptionsFilter());
  app.useGlobalInterceptors(
    new LoggingInterceptor(),
    new TransformInterceptor(),
  );
  app.useGlobalPipes(
    new ValidationPipe({ whitelist: true, transform: true, forbidNonWhitelisted: true }),
  );

  await app.listen(3000);
  logger.log("Level 05 AOP 切面已启动: http://localhost:3000");
  logger.log("🔬 观察控制台日志——每个 AOP 层都会输出标记");
  logger.log("  GET  /cats                           — 无需认证（公开端点）");
  logger.log("  GET  /cats/admin                     — 需要 admin 角色（RoleGuard）");
  logger.log("  GET  /cats/admin?role=admin          — 验证角色通过");
  logger.log("  GET  /cats/error                     — 触发异常（测试 ExceptionFilter）");
  logger.log("  GET  /cats/slow                      — 慢请求（测试 LoggingInterceptor 耗时）");
}

bootstrap();
