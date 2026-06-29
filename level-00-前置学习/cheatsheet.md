# NestJS CLI & 概念速查表

---

## 🛠️ NestJS CLI 命令速查

| 命令 | 用途 |
|------|------|
| `nest new <项目名>` | 创建新项目 |
| `nest g resource <名称>` | 一键生成完整 CRUD 资源（Module + Controller + Service + DTO） |
| `nest g module <名称>` | 生成模块 |
| `nest g controller <名称>` | 生成控制器 |
| `nest g service <名称>` | 生成服务 |
| `nest g guard <名称>` | 生成守卫 |
| `nest g interceptor <名称>` | 生成拦截器 |
| `nest g pipe <名称>` | 生成管道 |
| `nest g filter <名称>` | 生成异常过滤器 |
| `nest g middleware <名称>` | 生成中间件 |
| `nest g decorator <名称>` | 生成自定义装饰器 |
| `nest build` | 编译项目 |
| `nest start --watch` | 开发模式启动（热重载） |
| `nest info` | 查看 NestJS 版本信息 |

---

## 📎 装饰器速查

### Controller 装饰器

| 装饰器 | 用途 | 示例 |
|--------|------|------|
| `@Controller('path')` | 定义控制器 + 路由前缀 | `@Controller('users')` |
| `@Get()` / `@Post()` / `@Put()` / `@Patch()` / `@Delete()` | HTTP 方法路由 | `@Get(':id')` |
| `@All()` | 匹配所有 HTTP 方法 | `@All('wildcard')` |
| `@HttpCode(204)` | 设置响应状态码 | `@HttpCode(HttpStatus.NO_CONTENT)` |
| `@Redirect(url, 301)` | 重定向 | `@Redirect('https://example.com', 301)` |
| `@Header('key', 'val')` | 设置响应头 | `@Header('Cache-Control', 'no-cache')` |
| `@Render('view')` | 渲染模板（SSR） | `@Render('index')` |

### 参数装饰器

| 装饰器 | 用途 | 示例 |
|--------|------|------|
| `@Param('id')` | 路径参数 | `@Param('id') id: string` |
| `@Query('search')` | 查询参数 | `@Query('page') page: number` |
| `@Body()` | 请求体 | `@Body() createDto: CreateUserDto` |
| `@Headers('authorization')` | 请求头 | `@Headers() headers: IncomingHttpHeaders` |
| `@Ip()` | 客户端 IP | `@Ip() ip: string` |
| `@Req()` | 原始 Express Request 对象 | `@Req() req: Request` |
| `@Res()` | 原始 Express Response 对象 | `@Res() res: Response` |
| `@Session()` | Session 对象 | `@Session() session: Record<string, any>` |
| `@UploadedFile()` | 单个上传文件 | `@UploadedFile() file: Express.Multer.File` |
| `@UploadedFiles()` | 多个上传文件 | `@UploadedFiles() files: Express.Multer.File[]` |

### Provider 装饰器

| 装饰器 | 用途 | 示例 |
|--------|------|------|
| `@Injectable()` | 标记类为可注入的 Provider | `@Injectable()` |
| `@Inject(token)` | 按 Token 注入依赖 | `@Inject('CONFIG') config: Config` |
| `@Optional()` | 依赖可选（不存在不报错） | `@Optional() @Inject('LOG') log?: Logger` |
| `@Global()` | 标记模块为全局模块 | `@Global() @Module({...})` |

### 方法增强装饰器

| 装饰器 | 用途 | 示例 |
|--------|------|------|
| `@UseGuards(AuthGuard)` | 应用守卫 | `@UseGuards(JwtAuthGuard)` |
| `@UseInterceptors(LogInterceptor)` | 应用拦截器 | `@UseInterceptors(TransformInterceptor)` |
| `@UsePipes(ValidationPipe)` | 应用管道 | `@UsePipes(new ValidationPipe())` |
| `@UseFilters(HttpExceptionFilter)` | 应用异常过滤器 | `@UseFilters(AllExceptionFilter)` |
| `@SetMetadata('key', 'val')` | 设置路由元数据 | `@SetMetadata('roles', ['admin'])` |

---

## 🔄 请求处理生命周期

```
                     ┌──────────────┐
                     │   请求到达    │
                     └──────┬───────┘
                            │
                     ┌──────▼───────┐
                     │  Middleware   │  中间件（日志、CORS、Body 解析）
                     └──────┬───────┘
                            │
                     ┌──────▼───────┐
                     │    Guard      │  守卫（鉴权、权限验证）
                     └──────┬───────┘
                            │
                     ┌──────▼───────┐
                     │  Interceptor  │  拦截器（before 阶段：日志、缓存）
                     │   (Before)    │
                     └──────┬───────┘
                            │
                     ┌──────▼───────┐
                     │    Pipe       │  管道（数据验证、转换）
                     └──────┬───────┘
                            │
                     ┌──────▼───────┐
                     │  Controller   │  控制器（路由分发）
                     └──────┬───────┘
                            │
                     ┌──────▼───────┐
                     │   Service     │  服务层（业务逻辑）
                     └──────┬───────┘
                            │
                     ┌──────▼───────┐
                     │  Interceptor  │  拦截器（after 阶段：响应包装）
                     │   (After)     │
                     └──────┬───────┘
                            │
                     ┌──────▼───────┐
                     │ ExceptionFilter│ 异常过滤器（错误统一处理）
                     │  (如有异常)   │
                     └──────┬───────┘
                            │
                     ┌──────▼───────┐
                     │   响应返回    │
                     └──────────────┘
```

---

## 🔄 应用生命周期钩子执行顺序

```
1. OnModuleInit         —— 模块初始化（依赖模块先执行）
2. OnApplicationBootstrap —— 所有模块初始化后
3. 应用运行中…
4. BeforeApplicationShutdown —— 收到关闭信号时
5. OnModuleDestroy      —— 模块销毁（依赖模块后销毁）
6. OnApplicationShutdown —— 应用完全关闭
```

**典型用途：**
- `OnModuleInit`：DrizzleService 中连接数据库
- `OnApplicationBootstrap`：预热缓存、初始化默认数据
- `OnModuleDestroy`：关闭数据库连接、释放资源
- `BeforeApplicationShutdown`：等待正在处理的请求完成

---

## 🏗️ 模块、守卫、拦截器、过滤器的作用域

| 级别 | 写法 | 示例 |
|------|------|------|
| 全局（应用） | `app.useGlobalXxx()` | `app.useGlobalPipes(new ValidationPipe())` |
| 模块级 | `@Module({ providers: [...] })` | 模块 Provider 中注册 |
| 控制器级 | `@Controller() @UseGuards(...)` | 控制器上应用 |
| 方法级 | `@Get() @UseGuards(...)` | 单个路由上应用 |

**全局注册 vs 模块注册的区别：**
- 全局注册的组件**无法注入依赖**（因为它不在任何模块的上下文中）
- 模块注册的组件可以正常使用 DI

**解决方法：** 在根模块用自定义 Provider 注册全局组件：

```typescript
@Module({
  providers: [
    { provide: APP_PIPE, useClass: ValidationPipe },
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_INTERCEPTOR, useClass: TransformInterceptor },
    { provide: APP_FILTER, useClass: AllExceptionFilter },
  ],
})
export class AppModule {}
```

---

## 🔑 常用 Token 常量

```typescript
import { APP_PIPE, APP_GUARD, APP_INTERCEPTOR, APP_FILTER } from '@nestjs/core';
```

| Token | 用途 |
|-------|------|
| `APP_PIPE` | 全局管道注册 Token |
| `APP_GUARD` | 全局守卫注册 Token |
| `APP_INTERCEPTOR` | 全局拦截器注册 Token |
| `APP_FILTER` | 全局过滤器注册 Token |

---

## 📦 常用 NestJS 包

| 包名 | 用途 |
|------|------|
| `@nestjs/common` | 核心装饰器、接口、工具 |
| `@nestjs/core` | DI 容器、应用工厂 |
| `@nestjs/platform-express` | Express 平台适配器（默认） |
| `@nestjs/platform-fastify` | Fastify 平台适配器（高性能） |
| `@nestjs/config` | 环境变量 / 配置管理 |
| `@nestjs/jwt` | JWT 签发与验证 |
| `@nestjs/passport` | Passport 集成 |
| `@nestjs/swagger` | OpenAPI / Swagger 文档 |
| `@nestjs/schedule` | 定时任务 |
| `@nestjs/bull` | 队列（基于 Redis） |
| `@nestjs/websockets` | WebSocket / Socket.io |
| `@nestjs/microservices` | 微服务传输层 |
| `@nestjs/graphql` | GraphQL 集成 |
| `@nestjs/testing` | 测试工具 |
| `@nestjs/serve-static` | 静态文件服务 |
