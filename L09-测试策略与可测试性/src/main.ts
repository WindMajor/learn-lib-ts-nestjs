import { NestFactory } from "@nestjs/core";
import { Logger, ValidationPipe } from "@nestjs/common";
import { AppModule } from "./app.module";

async function bootstrap() {
  const logger = new Logger("Bootstrap");
  const app = await NestFactory.create(AppModule);

  app.useGlobalPipes(
    new ValidationPipe({ whitelist: true, transform: true }),
  );

  await app.listen(3000);
  logger.log("Level 09 已启动: http://localhost:3000");
  logger.log("🧪 本关演示测试策略：");
  logger.log("  npm run test         — 运行单元测试");
  logger.log("  npm run test:cov     — 测试覆盖率报告");
  logger.log("  npm run test:e2e     — E2E 测试");
  logger.log("  GET /users           — 用户列表");
  logger.log("  GET /users/:id       — 用户详情");
  logger.log("  POST /users          — 创建用户");
}
bootstrap();
