/**
 * WHAT: 配置命名空间——为相关配置分组，提供类型安全
 *
 * 【核心原理——为什么需要命名空间？】
 *   直接用 configService.get('KEY') 返回 any → 没有类型安全、IDE 无智能提示
 *   命名空间将相关配置分组，返回带类型的对象：
 *     configService.get('database.host') → 类型为 string
 *     configService.get<DatabaseConfig>('database') → 类型为 DatabaseConfig
 *
 * 【对比 Spring Boot】
 *   @ConfigurationProperties(prefix = "database")
 *   class DatabaseProperties { String host; int port; }
 *   原理一样——将扁平的 Key-Value 配置映射到结构化对象
 *
 * 【对比 Go (Viper)】
 *   viper.Sub("database")  → 返回配置子树
 *   然后用 viper.Unmarshal(&dbConfig) → 映射到 struct
 */
export interface DatabaseConfig {
  url: string;
}

export interface RedisConfig {
  url: string;
}

export interface JwtConfig {
  secret: string;
  expiresIn: string;
}

export interface AppConfig {
  port: number;
  nodeEnv: string;
  logLevel: string;
  corsOrigin: string;
}

/**
 * WHAT: 配置工厂函数——返回结构化配置对象
 * WHY: 在 ConfigModule.forRoot({ load: [databaseConfig, ...] }) 中注册
 *   ConfigService 自动合并所有 load 函数的结果
 */
export default () => ({
  port: parseInt(process.env.PORT || "3000", 10),
  nodeEnv: process.env.NODE_ENV || "development",
  logLevel: process.env.LOG_LEVEL || "debug",
  corsOrigin: process.env.CORS_ORIGIN || "*",

  database: {
    url: process.env.DATABASE_URL || "postgresql://localhost:5432/nestjs",
  } satisfies DatabaseConfig,

  redis: {
    url: process.env.REDIS_URL || "redis://localhost:6379",
  } satisfies RedisConfig,

  jwt: {
    secret: process.env.JWT_SECRET || "fallback-secret",
    expiresIn: process.env.JWT_EXPIRES_IN || "7d",
  } satisfies JwtConfig,
});
