import { NestFactory } from "@nestjs/core";
import { Logger, ValidationPipe } from "@nestjs/common";
import { SwaggerModule, DocumentBuilder } from "@nestjs/swagger";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import { AppModule } from "./app.module";
import { AllExceptionsFilter } from "./common/filters/all-exceptions.filter";
import { TransformInterceptor } from "./common/interceptors/transform.interceptor";
import { LoggingInterceptor } from "./common/interceptors/logging.interceptor";
import { ConfigService } from "@nestjs/config";

async function bootstrap() {
  const logger = new Logger("Bootstrap");
  const app = await NestFactory.create(AppModule);
  const config = app.get(ConfigService);

  // ===== 安全中间件 =====
  app.use(helmet());
  app.enableCors({ origin: config.get("corsOrigin", "*"), credentials: true });
  app.use(
    rateLimit({
      windowMs: config.get("THROTTLE_TTL", 60000),
      max: config.get("THROTTLE_LIMIT", 20),
      message: { code: 429, message: "请求太频繁，请稍后再试" },
    }),
  );

  // ===== 全局 AOP 组件 =====
  app.useGlobalFilters(new AllExceptionsFilter());
  app.useGlobalInterceptors(new LoggingInterceptor(), new TransformInterceptor());
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true, forbidNonWhitelisted: true, transform: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );

  // ===== Swagger 文档 =====
  const swaggerConfig = new DocumentBuilder()
    .setTitle("企业数据汇总办公平台 API")
    .setDescription("内部数据汇总、审批流、统计报表系统")
    .setVersion("1.0")
    .addBearerAuth()
    .build();
  const document = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup("api/docs", app, document);

  const port = config.get("PORT", 3000);
  await app.listen(port);
  logger.log(`🚀 企业数据汇总办公平台已启动: http://localhost:${port}`);
  logger.log(`📚 Swagger 文档: http://localhost:${port}/api/docs`);
}

bootstrap();
