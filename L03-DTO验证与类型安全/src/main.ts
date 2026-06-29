import { NestFactory } from "@nestjs/core";
import { Logger, ValidationPipe } from "@nestjs/common";
import { AppModule } from "./app.module";

async function bootstrap() {
  const logger = new Logger("Bootstrap");
  const app = await NestFactory.create(AppModule);

  /**
   * WHAT: 生产级 ValidationPipe 配置——所有关键选项都要配
   *
   * [生产环境推荐配置]
   *   whitelist: true               → 自动删除 DTO 未定义的字段（防注入）
   *   forbidNonWhitelisted: true    → 发现未定义字段时报 400（对前端友好）
   *   transform: true               → 自动将 plain object 转为 class 实例
   *   transformOptions.enableImplicitConversion: true → 自动类型转换
   *     （如 query 参数 'age=2' 自动转 number，无需显式 @Type(() => Number)）
   *
   * WARNING: enableImplicitConversion 是全局开关，会尝试转换所有参数。
   *   某些场景下可能导致意外转换（如字符串 'true' 转 boolean）
   *   生产环境建议结合 @Type() 装饰器做显式转换
   */
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: {
        enableImplicitConversion: true,
      },
    }),
  );

  await app.listen(3000);
  logger.log("Level 03 应用已启动: http://localhost:3000");
  logger.log("实验 API:");
  logger.log("  POST /cats                — 创建猫（基础 DTO 验证）");
  logger.log("  POST /cats/with-owner     — 创建猫+主人（嵌套 DTO 验证）");
  logger.log("  PATCH /cats/:id           — 更新猫（Partial DTO）");
  logger.log("  POST /cats/bulk           — 批量创建（数组验证 @ValidateNested）");
}

bootstrap();
