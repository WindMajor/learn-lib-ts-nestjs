import { NestFactory } from "@nestjs/core";
import { Logger, ValidationPipe } from "@nestjs/common";
import { AppModule } from "./app.module";

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
  
  await app.listen(3000);
  Logger.log("Level 07 已启动: http://localhost:3000");
  Logger.log("🔐 JWT 认证 + 自定义装饰器实验:");
  Logger.log("  POST /auth/login   — 登录获取 Token");
  Logger.log("  GET  /auth/profile — 获取当前用户（需 JWT）");
  Logger.log("  GET  /auth/admin   — 仅 admin 角色可访问");
}
bootstrap();
