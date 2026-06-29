# learn-lib-ts-nestjs：闯关式 NestJS 商业级后端开发

> **目标**：11 关内，以"玩框架"的心态打通 NestJS 在企业软件中的核心架构能力。
> **最终产出**：一个可部署、可交付的完整 REST API 服务——企业内部数据汇总办公平台。

---

## 学习者画像（难度锚点）

| 维度 | 已有基础 |
|------|---------|
| TypeScript | 深度使用，熟悉类型体操、编译配置、Node.js 生态 |
| 后端框架 | Express（中间件/路由/请求响应周期） |
| 强类型语言 | Rust（所有权/生命周期/Tokio）、Go（goroutine/Gin）、Java（Spring Boot/JPA）、Kotlin（Ktor/协程） |
| 脚本语言 | Python（Django/FastAPI） |
| 数据库 | PostgreSQL（MVCC/索引优化）、Redis（缓存/分布式锁/Stream） |
| 编程范式 | 全栈开发，算法扎实（Java 700+ 题），追求原理理解 |

**核心诉求**：不是学 NestJS 语法，而是建立 NestJS 与 Express/Spring/FastAPI/Go Gin/Rust Axum 的"**差异地图**"。

---

## 关卡路线图

| 关卡 | 主题 | 核心能力 | 预估时间 |
|------|------|---------|---------|
| [Level 00](./L00-前置学习/) | 前置学习：NestJS 全面入门 | 项目结构、模块/控制器/服务、AOP 全链路、数据库/认证/Vue3联调 | 8~12 h |
| [Level 01](./L01-模块系统与依赖注入容器/) | 模块系统与依赖注入容器 | IoC 容器直觉、Provider 注册、Scope 理解 | 60 min |
| [Level 02](./L02-控制器路由与管道/) | 控制器、路由与管道 | 请求参数绑定、内置 Pipe、自定义 Pipe | 45 min |
| [Level 03](./L03-DTO验证与类型安全/) | DTO、验证与类型安全 | class-validator、ValidationPipe 配置、嵌套验证 | 60 min |
| [Level 04](./L04-服务仓储与数据库集成/) | 服务、仓储与数据库集成 | Drizzle 集成、事务、软删除、审计字段 | 75 min |
| [Level 05](./L05-AOP切面/) | AOP 切面：Guard/Interceptor/Filter | AOP 执行链、全局 vs 局部、统一响应 | 90 min |
| [Level 06](./L06-配置管理与环境隔离/) | 配置管理与环境隔离 | ConfigModule、Joi 校验、多环境 | 45 min |
| [Level 07](./L07-认证授权与自定义装饰器/) | 认证、授权与自定义装饰器 | JWT + Passport、RBAC、自定义装饰器、Reflector | 75 min |
| [Level 08](./L08-缓存队列与外部集成/) | 缓存、队列与外部集成 | Redis 缓存、Bull 队列、定时任务、EventEmitter | 60 min |
| [Level 09](./L09-测试策略与可测试性/) | 测试策略与可测试性 | 单元测试、集成测试、E2E、测试隔离 | 60 min |
| [Level 10](./L10-毕业设计-企业数据汇总办公平台API/) | 毕业设计：企业内部数据办公平台 | 完整企业级 API 交付 | 90+ min |

---

## 环境要求

```bash
Node.js >= 20.x
pnpm >= 8.x
TypeScript >= 5.3
Docker (Level 04+ 用于 PostgreSQL/Redis)
```

---

## 快速开始

```bash
# 克隆后进入任意关卡
cd L01-模块系统与依赖注入容器

# 安装依赖
pnpm install

# 开发模式启动（热重载）
pnpm run start:dev

# 运行测试
pnpm run test
```

---

## 学习建议

1. **按顺序闯关**：每关是下一关的台阶，跳关会在毕业设计中遭遇概念断层。
2. **先跑通，再改错**：每关的 `src/` 是正确答案，`bugs/` 是故意写错的——先跑通 `src/`，再尝试修复 `bugs/`。
3. **对比学习**：代码注释中的 `【对比 XXX】` 标记是核心价值，它们建立了 NestJS 与你已有知识的桥梁。
4. **沙盒实验**：每关的 `playground.ts` 可以随意修改、破坏、实验，不用担心搞坏任何东西。
5. **Logger 是关键**：NestJS 内部大量使用 Logger，学会看日志就学会了诊断问题。

---

## 跨框架速查表（Mind Map）

| 概念 | NestJS | Spring Boot | Express | Go (Gin) | Rust (Axum) | FastAPI |
|------|--------|-------------|---------|----------|-------------|---------|
| IoC/DI | @Injectable + 构造函数注入 | @Service + @Autowired | 无（手动） | wire/工厂函数 | 显式构造 | Depends() |
| 模块化 | @Module({}) | @Configuration | 无 | 按包组织 | 按模块组织 | 按文件组织 |
| 路由 | @Controller + 装饰器 | @RestController + @RequestMapping | app.get() | r.GET() | Router::route() | @app.get() |
| 验证 | class-validator + ValidationPipe | @Valid + @Validated | 手动/joi | binding tag | serde+validator | Pydantic |
| AOP | Guard/Interceptor/Pipe/Filter | @Aspect + @Around | 中间件 | 中间件 | Tower Layer | 中间件/Depends |
| ORM | TypeORM/Prisma | Spring Data JPA | 手动/sequelize | GORM | Diesel/SeaORM | SQLAlchemy |
| 认证 | @nestjs/passport + JWT | Spring Security | passport.js | JWT 中间件 | jsonwebtoken | OAuth2 |
| 配置 | @nestjs/config + Joi | application.yml | dotenv | Viper | config crate | pydantic-settings |
| 测试 | Jest + supertest | JUnit + MockMvc | jest/mocha | testify | tokio-test | pytest |
| 文档 | @nestjs/swagger | SpringDoc/OpenAPI | swagger-jsdoc | swaggo | utoipa | 自动 OpenAPI |

---

## 项目结构总览

```
learn-lib-ts-nestjs/
├── README.md                          # 本文件
├── docker-compose.yml                 # 全局 PG + Redis
├── pnpm-workspace.yaml                # pnpm monorepo 配置
├── L00-前置学习/                  # 第 0 关（前置入门）
├── L01-模块系统与依赖注入容器/    # 第 1 关
├── L02-控制器路由与管道/          # 第 2 关
├── L03-DTO验证与类型安全/         # 第 3 关
├── L04-服务仓储与数据库集成/      # 第 4 关
├── L05-AOP切面/                  # 第 5 关
├── L06-配置管理与环境隔离/        # 第 6 关
├── L07-认证授权与自定义装饰器/    # 第 7 关
├── L08-缓存队列与外部集成/        # 第 8 关
├── L09-测试策略与可测试性/        # 第 9 关
└── L10-毕业设计-企业数据汇总办公平台API/  # 第 10 关（最终关卡）
```

---

## 通关标准（全局）

完成全部 11 关后，你将能够：

- [ ] 独立设计企业级 NestJS 后端架构（模块划分、分层、AOP 切面）
- [ ] 写出可测试的模块化代码（DI + Mock）
- [ ] 诊断 NestJS 应用的内存泄漏和性能瓶颈（Scope/Queue/连接池）
- [ ] 向只用 Express 的团队解释"为什么 NestJS 值得引入"
- [ ] 向 Spring/Go/Rust 开发者准确描述 NestJS 的差异和优劣
- [ ] 交付一个包含认证授权、缓存队列、Swagger 文档、测试覆盖的完整 API 服务

---

**Let's dive in. 从 Level 01 开始你的 NestJS 之旅。**
