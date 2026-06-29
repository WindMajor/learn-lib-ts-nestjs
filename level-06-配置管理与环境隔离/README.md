# Level 06：配置管理与环境隔离

> **通关标准**：能使用 `@nestjs/config` 管理多环境配置，能用 Joi 做启动时配置校验，理解 Fail-Fast 原则。

---

## 核心概念

| 概念 | 说明 | 对比 |
|------|------|------|
| `ConfigModule.forRoot()` | 加载 .env 并注册全局 ConfigService | Spring `@ConfigurationProperties` |
| `load: [configuration]` | 配置命名空间——结构化分组 | Spring `prefix` 属性 |
| `Joi.object({...})` | 启动时校验环境变量（Fail-Fast） | Go `viper` 无内置校验 |
| `ConfigService.get('key')` | 读取配置项 | Go `viper.GetString()` |

---

## 本关实验

### 1. 启动应用

```bash
cd level-06-配置管理与环境隔离
npm install
npm run start:dev
```

### 2. 访问 Config 端点

```bash
curl http://localhost:3000/config
```

### 3. 测试 Fail-Fast

修改 `.env`，注释掉 `DATABASE_URL`，重启应用——应用会在启动时崩溃并告诉你缺少什么。

### 4. 修复 Bug

```bash
# 查看 bugs/ 目录中的故意错误
cat bugs/bug_01_JWT_SECRET硬编码导致安全漏洞.ts
```

---

## 环境变量说明

| 变量 | 必需 | 默认值 | 说明 |
|------|------|--------|------|
| `NODE_ENV` | 否 | `development` | 运行环境 |
| `PORT` | 否 | `3000` | 监听端口 |
| `DATABASE_URL` | **是** | — | PostgreSQL 连接串 |
| `REDIS_URL` | **是** | — | Redis 连接串 |
| `JWT_SECRET` | **是** | — | JWT 签名密钥（至少 16 字符） |
| `JWT_EXPIRES_IN` | 否 | `7d` | Token 过期时间 |
| `LOG_LEVEL` | 否 | `debug` | 日志级别 |
| `CORS_ORIGIN` | 否 | `*` | CORS 允许的源 |

---

## 对比要点

- **vs Spring Boot**: NestJS 的 `ConfigModule` 更简单，但 Spring 的 `application-{profile}.yml` 多环境自动合并更强大
- **vs Go (Viper)**: Viper 没有内置校验——需要手动 if/panic；NestJS 的 Joi 集成是开箱即用的
- **vs Rust**: Rust 的 `config` crate + `serde` 提供编译期类型安全，比 NestJS 的运行期验证更早发现问题
