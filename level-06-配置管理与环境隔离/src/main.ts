/**
 * WHAT: 使用 ConfigService 的应用入口
 * WHY: 演示如何在应用初始化阶段使用配置
 *
 * 【核心原理——ConfigModule.forRoot() 做了什么】
 *   1. 读取 .env 文件 → dotenv 将其加载到 process.env
 *   2. 根据 validationSchema → Joi 校验所有必需的环境变量
 *   3. 将校验后的配置注册为 ConfigService Singleton
 *   4. 其他模块通过注入 ConfigService 读取配置
 *
 * 【对比 Spring Boot】
 *   Spring:  application.yml → @Value("${...}") 或 @ConfigurationProperties
 *   NestJS:  .env → ConfigService.get('KEY')
 *   差异：Spring 支持 YAML 层级配置、多 profile 自动合并，NestJS 的 ConfigModule 更简单
 *
 * 【对比 Go (Viper)】
 *   Go:   viper.ReadInConfig() → viper.GetString("key")
 *   NestJS: ConfigModule.forRoot() → configService.get('key')
 *   几乎一样的 API——都基于"Key-Value 配置中心"模式
 *
 * 【对比 Rust (config crate)】
 *   Rust: Config::builder().add_source(File::with_name("config")).build()
 *   都是"构建配置 → 读取配置"的模式
 *
 * WARNING: ConfigService.get() 返回 any 类型！
 *   → 没有类型安全 → 拼错 KEY 运行时才发现
 *   → 推荐使用自定义配置命名空间提供类型安全（见 config/configuration.ts）
 */
import { NestFactory } from "@nestjs/core";
import { Logger } from "@nestjs/common";
import { AppModule } from "./app.module";
import { ConfigService } from "@nestjs/config";

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const configService = app.get(ConfigService);

  const port = configService.get<number>("PORT", 3000);
  const nodeEnv = configService.get<string>("NODE_ENV", "development");

  await app.listen(port);
  Logger.log(`应用已启动: http://localhost:${port} | 环境: ${nodeEnv}`);
  Logger.log(`数据库: ${configService.get("DATABASE_URL")}`);
}
bootstrap();
