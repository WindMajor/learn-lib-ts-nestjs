# Level 04：服务、仓储与数据库集成

> **通关标准**：能独立搭建 Prisma + NestJS 的数据访问层，实现完整 CRUD + 事务 + 软删除，并理解 Repository 模式的价值。

---

## 核心概念

| 概念 | 说明 | 对比 |
|------|------|------|
| PrismaService | 封装 PrismaClient，实现 `OnModuleInit/Destroy` 生命周期管理 | TypeORM 的 DataSource |
| Repository 模式 | Service → Repository → PrismaClient（三层抽象） | Spring Data JPA 的 Repository 接口 |
| `$transaction` | 交互式事务 API，支持依赖查询 | Spring 的 `@Transactional` |
| 软删除 | `deletedAt` 字段标记删除，查询时自动过滤 | TypeORM 的 `@DeleteDateColumn` |
| 审计字段 | `createdAt`/`updatedAt` 自动记录 | Spring JPA Auditing |
| `onModuleDestroy` | 模块销毁时关闭数据库连接（防止连接泄漏） | Spring 的 `@PreDestroy` |

---

## 架构分层

```
Controller (HTTP 适配)
  → Service (业务逻辑)
    → Repository (数据访问抽象)    ← 本关重点
      → PrismaService (数据库连接) ← 本关重点
```

为什么需要 Repository 层？
1. Service 不直接依赖 PrismaClient → 切换 ORM 只需换 Repository
2. 可以 mock Repository 做单元测试
3. 集中管理查询逻辑（如软删除过滤、分页、排序）

---

## 环境准备

```bash
# 1. 启动 PostgreSQL（使用项目根目录的 docker-compose）
cd ../.. && docker-compose up -d postgres

# 2. 安装依赖
cd level-04-服务仓储与数据库集成
npm install

# 3. 生成 Prisma Client
npx prisma generate

# 4. 执行数据库迁移（创建表）
npx prisma migrate dev --name init

# 5. 启动应用
npm run start:dev
```

---

## 与 Spring/Go/Django 的差异

| 特性 | NestJS + Prisma | Spring Data JPA | Go + GORM | Django ORM |
|------|----------------|-----------------|-----------|------------|
| Schema 定义 | Prisma DSL（独立文件） | Java Entity 类 | Go struct + tag | Python Model 类 |
| 类型安全 | 极高（生成的 Client 精确到关联字段） | 高（泛型擦除） | 中（interface{}） | 中（动态类型） |
| 迁移 | `prisma migrate dev` | Flyway/Liquibase | AutoMigrate | Django Migrations |
| 事务 | `$transaction` 交互式 API | `@Transactional` 声明式 | `db.Transaction` | `transaction.atomic()` |
| 软删除 | 手动（deletedAt字段） | `@SQLDelete` | `gorm.DeletedAt` | 手动 |

---

## 自检清单

- [ ] 能手写 PrismaService（含 `onModuleInit`/`onModuleDestroy`）
- [ ] 能用 `$transaction` 实现转账类事务（A扣钱+B加钱，失败回滚）
- [ ] 能实现软删除 + 查询自动过滤已删除记录
- [ ] 能独立修复 `bugs/` 目录下的错误
- [ ] 能向 Spring JPA 开发者解释 Prisma 的设计差异
