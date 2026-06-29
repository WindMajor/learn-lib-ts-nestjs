import { NestFactory } from "@nestjs/core";
import { Logger, ValidationPipe } from "@nestjs/common";
import { AppModule } from "./app.module";

async function bootstrap() {
  const logger = new Logger("Bootstrap");
  const app = await NestFactory.create(AppModule);

  app.useGlobalPipes(
    new ValidationPipe({ whitelist: true, transform: true }),
  );

  const port = process.env.PORT || 3000;
  await app.listen(port);
  logger.log(`Level 08 已启动: http://localhost:${port}`);
  logger.log("🔬 本关演示 缓存 / 队列 / 定时任务 / 事件：");
  logger.log("  GET  /cats            — 缓存示例（第二次请求命中缓存）");
  logger.log("  POST /cats            — 创建猫（触发事件通知）");
  logger.log("  POST /reports/generate — 加入报表生成队列（Bull）");
  logger.log("  定时任务：每 30 秒输出一次在线用户统计");
}
bootstrap();
