import { NestFactory } from "@nestjs/core";
import { Logger, ValidationPipe } from "@nestjs/common";
import { AppModule } from "./app.module";

async function bootstrap() {
  const logger = new Logger("Bootstrap");
  const app = await NestFactory.create(AppModule);

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  await app.listen(3000);
  logger.log("Level 04 已启动: http://localhost:3000");
  logger.log("🔬 本关演示 Repository 模式 + Drizzle 事务 + 软删除");
  logger.log("  GET    /cats             — 查询所有猫（自动过滤已删除）");
  logger.log("  GET    /cats/:id         — 查询指定猫");
  logger.log("  POST   /cats             — 创建猫");
  logger.log("  PATCH  /cats/:id         — 更新猫");
  logger.log("  DELETE /cats/:id         — 软删除猫");
  logger.log("  POST   /cats/transfer    — 测试事务（转移猫的所有权）");
  logger.log("  GET    /cats/deleted     — 查看已删除的猫");
}

bootstrap();
