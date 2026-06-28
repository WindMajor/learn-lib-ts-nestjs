# Level 10 毕业设计：企业内部数据汇总办公平台 API

> **通关标准**：交付一个完整的企业级 NestJS REST API 服务——包含认证、RBAC、CRUD、审批流、统计面板、Swagger 文档、测试和 Docker 部署。

---

## 业务场景

为企业的日常办公数据汇总需求构建后端 API 平台，涵盖：

| 模块 | 功能 | 技术要点 |
|------|------|---------|
| **认证授权** | 登录/注册/JWT Token/RBAC | Passport + JwtStrategy + @Roles() |
| **用户管理** | 用户 CRUD + 角色分配 + 部门归属 | Prisma ORM + bcrypt + ValidationPipe |
| **部门管理** | 部门层级树 + 成员管理 + 部门领导 | 自引用关系 (parentId) |
| **数据上报** | 创建/提交/查询报表 + 多类型内容 | JSONB 字段 + 无模式数据 |
| **审批流** | 多级审批 + 通过/驳回 + 自动通知 | EventEmitter + 状态机 |
| **通知消息** | 事件驱动通知 + 已读/未读 | @OnEvent + 事件解耦 |
| **仪表盘** | 数据统计 + 分类汇总 + 部门对比 | GROUP BY + 聚合查询 |

---

## 架构图

```
┌──────────────────────────────────────────────────────────┐
│                     HTTP Request                          │
├──────────────────────────────────────────────────────────┤
│  Helmet / CORS / RateLimit  (安全层)                      │
├──────────────────────────────────────────────────────────┤
│  Guard (JWT + Roles)                                     │
├──────────────────────────────────────────────────────────┤
│  Interceptor (Logging + Transform 统一响应)               │
├──────────────────────────────────────────────────────────┤
│  Pipe (ValidationPipe: whitelist + transform)            │
├──────────────────────────────────────────────────────────┤
│  Controller → Service → Repository → PrismaService       │
├──────────────────────────────────────────────────────────┤
│                  PostgreSQL  │  Redis  │  Bull Queue      │
└──────────────────────────────────────────────────────────┘
```

---

## 快速开始

```bash
# 1. 启动基础设施
docker-compose up -d

# 2. 安装依赖
npm install

# 3. 设置环境变量
cp .env.example .env

# 4. 生成 Prisma Client + 迁移
npx prisma generate
npx prisma migrate dev --name init

# 5. 填充种子数据
npm run db:seed

# 6. 启动开发服务器
npm run start:dev
```

访问 Swagger 文档: **http://localhost:3000/api/docs**

---

## 测试默认账号

| 用户名 | 密码 | 角色 |
|--------|------|------|
| admin | admin123 | ADMIN |
| manager | admin123 | DEPARTMENT_MANAGER |
| user | admin123 | USER |

---

## API 调用示例

```bash
# 登录获取 Token
TOKEN=$(curl -s -X POST http://localhost:3000/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"admin123"}' \
  | grep -o '"access_token":"[^"]*"' | cut -d'"' -f4)

# 获取用户列表
curl http://localhost:3000/users -H "Authorization: Bearer $TOKEN"

# 创建报表
curl -X POST http://localhost:3000/reports \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Q2各部门销售额",
    "category": "DATA_SUMMARY",
    "content": {"total": 5000000, "growth": "12%"},
    "departmentId": 1
  }'

# 查看仪表盘统计
curl http://localhost:3000/dashboard/stats -H "Authorization: Bearer $TOKEN"
```

---

## 运行测试

```bash
# 单元测试
npm run test

# 覆盖率报告
npm run test:cov

# E2E 测试
npm run test:e2e
```

---

## Docker 部署

```bash
docker-compose up -d --build
```

---

## 项目结构

```
src/
├── main.ts                    # 入口：安全/全局AOP/Swagger
├── app.module.ts              # 根模块：组装所有子模块
├── config/                    # 配置管理 (ConfigModule + Joi)
│   └── configuration.ts       # 结构化配置 + 命名空间
├── common/                    # 公共组件
│   ├── filters/               # 全局异常过滤器
│   ├── interceptors/          # 统一响应/日志拦截器
├── database/                  # 数据库层
│   ├── prisma.service.ts      # PrismaClient 封装（生命周期管理）
│   └── prisma.module.ts       # 全局 Prisma 模块
├── auth/                      # 认证模块
│   ├── auth.module.ts
│   ├── auth.service.ts        # 登录/注册/JWT
│   ├── jwt.strategy.ts        # Passport JWT 策略
│   ├── guards/                # JwtAuthGuard + RolesGuard
│   └── decorators/            # @CurrentUser + @Roles
└── modules/                   # 业务模块
    ├── users/                 # 用户管理
    ├── departments/           # 部门管理
    ├── reports/               # 数据上报
    ├── approvals/             # 审批流
    ├── notifications/         # 通知消息 + 事件监听
    └── dashboard/             # 仪表盘统计
```

---

## 技术栈清单

- **框架**: NestJS 10 + Express
- **语言**: TypeScript 5.3
- **数据库**: PostgreSQL 16 + Prisma 5
- **认证**: JWT + Passport + bcrypt
- **缓存**: Redis + @nestjs/cache-manager
- **队列**: Bull + @nestjs/bull
- **事件**: @nestjs/event-emitter
- **文档**: @nestjs/swagger (Swagger/OpenAPI)
- **安全**: Helmet + CORS + RateLimit
- **验证**: class-validator + class-transformer + Joi
- **测试**: Jest + supertest
- **部署**: Docker + Docker Compose

---

## 闯关完成自检

- [ ] `npm install && npm run start:dev` 可以直接启动
- [ ] Swagger 文档可以正常访问和测试 API
- [ ] 可以用 3 个测试账号分别登录，获得不同权限的 Token
- [ ] admin 用户可以调用所有接口，user 用户受 RBAC 限制
- [ ] 创建报表 → 提交 → 审批 → 查看通知的完整流程跑通
- [ ] 仪表盘各统计数据正确
- [ ] `npm run test` 所有单元测试通过
- [ ] `npm run test:e2e` E2E 测试通过
- [ ] 能用 `docker-compose up` 一键部署整个服务

---

**恭喜！从 Level 01 到 Level 10，你已完成 NestJS 商业级后端的完整通关。**

你现在有能力：
- 独立设计企业级 NestJS 后端架构
- 写出可测试的模块化代码
- 诊断 IoC/Scope/连接池等运行时问题
- 向 Spring/Go/Rust 开发者准确描述 NestJS 的设计哲学和差异
- 交付包含认证、授权、审批流、统计、文档、测试的完整 API 服务
