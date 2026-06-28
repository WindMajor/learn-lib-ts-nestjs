import { Module } from "@nestjs/common";
import { ConfigModule, ConfigService } from "@nestjs/config";
import configuration from "./config/configuration";
import * as Joi from "joi";

/**
 * WHAT: 根模块——演示生产级 ConfigModule 配置
 *
 * 【Joi 配置校验的原理】
 *   Joi 定义了一个 schema（环境变量的"Schema"）：
 *   - 每个变量是什么类型（string/number）
 *   - 是否必需（.required()）
 *   - 默认值（.default()）
 *   - 允许的值（.valid()）
 *
 *   应用启动时，ConfigModule 用 Joi schema 校验 process.env：
 *   - 通过 → 启动成功
 *   - 失败 → 应用崩溃，输出详细的缺失/不合规项
 *   → 这避免了"应用启动后才发现缺少环境变量"的问题
 *
 * 【对比 Spring Boot】
 *   Spring 用 @Validated + @NotNull 在 @ConfigurationProperties 类上做验证：
 *   相同目的——启动时检查配置有效性，非法配置立即崩溃（Fail-Fast）
 *
 * 【对比 Go (Viper)】
 *   Viper 没有内置校验——你需要手动 if viper.Get(...) == "" { panic(...) }
 *
 * 【对比 Rust (config crate)】
 *   config crate 用 #[serde(deny_unknown_fields)] + #[validate(...)] 宏
 *   编译期/运行期双重校验——比 NestJS 更安全
 */
@Module({
  imports: [
    ConfigModule.forRoot({
      // 是否全局可用（任何模块无需 import 即可注入 ConfigService）
      isGlobal: true,

      // 加载自定义配置命名空间
      load: [configuration],

      // 环境文件（开发用 .env，生产用 .env.production）
      envFilePath: [".env", ".env.production"],

      // Joi 校验——启动时失败（Fail-Fast）
      validationSchema: Joi.object({
        NODE_ENV: Joi.string()
          .valid("development", "production", "test")
          .default("development"),
        PORT: Joi.number().default(3000),
        DATABASE_URL: Joi.string().required(),
        REDIS_URL: Joi.string().required(),
        JWT_SECRET: Joi.string().required().min(16),
        JWT_EXPIRES_IN: Joi.string().default("7d"),
        LOG_LEVEL: Joi.string()
          .valid("error", "warn", "log", "debug")
          .default("debug"),
        CORS_ORIGIN: Joi.string().default("*"),
      }),

      // 如果校验失败 → 阻止启动
      validationOptions: {
        allowUnknown: true, // 允许未在 schema 中定义的其他环境变量
        abortEarly: true,   // 遇到第一个错误就停止（而非列出所有错误）
      },
    }),
  ],
})
export class AppModule {}
