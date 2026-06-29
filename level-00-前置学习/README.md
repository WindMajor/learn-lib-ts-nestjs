# NestJS 系统化学习项目

> 面向有 TypeScript + Vue3 + PostgreSQL + Docker 基础的全栈开发者，
> 系统掌握 NestJS 企业级后端架构的核心能力。

---

## 📋 前置要求

在开始本项目之前，建议你已掌握以下知识：

- ✅ **TypeScript 基础**：装饰器、泛型、类型系统、Promise/async-await
- ✅ **Vue3 基础**：Composition API、响应式系统、Axios 请求封装
- ✅ **PostgreSQL 基础**：SQL 查询、表设计、索引、外键约束
- ✅ **Docker 基础**：`docker compose` 命令、容器基本操作
- ✅ **RESTful API 基础概念**：HTTP 方法、状态码、资源设计

---

## 🗺️ 学习路线图

| 序号 | 文件                          | 核心概念                 | 对应 Express/Spring 概念           | 预计时间 |
| ---- | ----------------------------- | ------------------------ | ---------------------------------- | -------- |
| 01   | `01_project_structure.ts`     | 项目结构与装饰器本质     | Express app 配置                   | 30min    |
| 02   | `02_modules.ts`               | 模块系统                 | Spring `@Configuration`            | 45min    |
| 03   | `03_controllers.ts`           | 控制器与路由             | Express Router + `@RestController` | 45min    |
| 04   | `04_providers_di.ts`          | 依赖注入                 | Spring DI 容器                     | 60min    |
| 05   | `05_services_business.ts`     | 服务层与业务逻辑         | Spring `@Service`                  | 45min    |
| 06   | `06_dto_pipes.ts`             | DTO、验证与管道          | Java Bean Validation               | 45min    |
| 07   | `07_exception_filters.ts`     | 异常处理                 | Spring `@ControllerAdvice`         | 30min    |
| 08   | `08_middleware.ts`            | 中间件                   | Express Middleware                 | 30min    |
| 09   | `09_guards.ts`                | 守卫与权限控制           | Spring Security                    | 45min    |
| 10   | `10_interceptors.ts`          | 拦截器与切面             | Spring AOP                         | 45min    |
| 11   | `11_config_management.ts`     | 配置管理                 | Spring Boot `application.yml`      | 30min    |
| 12   | `12_database_integration.ts`  | 数据库集成（Drizzle+PG） | JPA / MyBatis                      | 60min    |
| 13   | `13_auth_jwt.ts`              | JWT 认证与授权           | Spring Security JWT                | 60min    |
| 14   | `14_cors_and_api_design.ts`   | CORS 与 RESTful 设计     | 通用                               | 30min    |
| 15   | `15_file_upload.ts`           | 文件上传与静态文件       | 通用                               | 30min    |
| 16   | `16_websocket_gateway.ts`     | WebSocket 实时通信       | 通用                               | 45min    |
| 17   | `17_scheduling_and_queues.ts` | 定时任务与队列           | Spring `@Scheduled`                | 30min    |
| 18   | `18_testing.ts`               | 测试（Jest + Supertest） | JUnit + MockMvc                    | 45min    |
| 19   | `19_advanced_patterns.ts`     | 进阶模式                 | Spring Boot 进阶                   | 45min    |
| 20   | `20_comprehensive_project.ts` | 综合实战：用户-文章系统  | 完整项目                           | 90min    |

---

## 创建新项目

推荐使用npx安装，全局安装@nestjs/cli的方式不可行，本地安装的方式更麻烦一些

```shell
npx @nestjs/cli new project-name
# 允许临时下载，然后选择pnpm

cd project-name
pnpm install # 报错，原因是pnpm 的安全策略——它阻止了某些包的构建脚本，需要你手动批准
pnpm approve-builds  # 手动批准
pnpm install 
```

## 🚀 启动步骤

### 1. 安装依赖

```bash
npm install
# 或
pnpm install
```

### 2. 启动基础设施

```bash
# 启动 PostgreSQL 和 Redis
docker compose up -d

# 验证服务状态
docker compose ps
```

### 3. 配置环境变量

```bash
# 复制环境变量模板
cp .env.example .env

# 根据实际情况修改 .env 中的配置
# 本地开发使用默认值即可
```

### 4. 初始化数据库

```bash
# 生成 Drizzle 迁移文件
npx drizzle-kit generate

# 执行数据库迁移（创建表结构）
npx drizzle-kit migrate

# （可选）打开 Drizzle Studio 查看数据
npx drizzle-kit studio
```

### 5. 启动开发服务器

```bash
npm run start:dev
# 服务运行在 http://localhost:3000
```

---

## 🔗 与前端 Vue3 联调说明

### 开发环境代理

在 Vue3 项目的 `vite.config.ts` 中配置代理：

```typescript
export default defineConfig({
  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true,
      },
    },
  },
});
```

### 统一错误处理

后端统一响应格式（由拦截器 + 异常过滤器保证）：

```typescript
// 成功响应
{ code: 200, data: {...}, message: 'success' }

// 错误响应
{ code: 400, data: null, message: '参数验证失败' }
```

前端 Axios 拦截器处理：

```typescript
// 响应拦截器
axios.interceptors.response.use(
  (res) => res.data, // 自动解包
  (error) => {
    if (error.response?.status === 401) {
      router.push('/login'); // Token 过期 → 跳转登录
    }
    return Promise.reject(error.response?.data);
  },
);
```

---

## 🗄️ 与 PostgreSQL + Drizzle 的工作流

```
1. 修改 src/db/schema.ts（定义表结构）
        ↓
2. npx drizzle-kit generate
   （生成迁移 SQL 文件 → drizzle/migrations/）
        ↓
3. npx drizzle-kit migrate （执行迁移）
        ↓
4. 在 Service 中使用 DrizzleService 操作数据库
   this.drizzle.db.select().from(users).where(...)
        ↓
5. npx drizzle-kit studio（可视化浏览数据）
```

---

## 🧪 测试命令

```bash
# 单元测试
npm run test

# E2E 测试
npm run test:e2e

# 测试覆盖率
npm run test:cov

# 监听模式
npm run test:watch
```

---

## 📁 项目结构

```
nestjs-basic-learn/
├── docker-compose.yml          # Docker 编排（PostgreSQL + Redis）
├── .env.example                # 环境变量模板
├── drizzle/                      # Drizzle 迁移文件
│   └── migrations/               # SQL 迁移
├── src/
│   ├── main.ts                 # 应用入口
│   ├── app.module.ts           # 根模块
│   ├── db/                     # 数据层
│   │   ├── schema.ts           # 表定义
│   │   ├── drizzle.service.ts  # Drizzle 服务
│   │   ├── drizzle.module.ts   # Drizzle 模块
│   │   └── index.ts            # 统一导出
│   └── learn/                  # 📚 系统化学习文件
│       ├── 01_project_structure.ts
│       ├── 02_modules.ts
│       ├── ...
│       └── 20_comprehensive_project.ts
├── package.json
├── tsconfig.json
├── nest-cli.json
├── README.md                   # 本文件
└── cheatsheet.md               # 速查表
```

---

## 💡 学习建议

1. **按序号阅读**：每个文件以 `XX_` 开头，按顺序递进
2. **动手实践**：每个代码示例都可以复制到实际项目中运行
3. **对比思考**：注意注释中与 Express/Spring/Django 的对比
4. **前端视角**：关注与 Vue3 协作的注释，理解全栈链路
5. **通关检查**：每章末尾的检查清单，确保真正掌握
