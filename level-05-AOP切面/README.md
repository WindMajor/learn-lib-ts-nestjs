# Level 05：AOP 切面——Guard、Interceptor、Filter

> **通关标准**：能手写 Guard/Interceptor/ExceptionFilter，理解执行顺序，并能解释与 Spring AOP/Express 中间件的核心差异。

---

## AOP 执行链路（Request Pipeline）

```
HTTP Request
  ↓
[Middleware]          ← Express 层，最先执行（如 cors/helmet/body-parser）
  ↓
[Guard]               ← 守门员：认证/授权。返回 false → 直接拒绝（403）
  ↓
[Interceptor - BEFORE] ← 拦截器前半部分：日志记录、请求计时开始
  ↓
[Pipe]                ← 参数转换和验证（Level 02-03 已掌握）
  ↓
[Controller Method]   ← 业务处理
  ↓
[Interceptor - AFTER]  ← 拦截器后半部分：统一响应封装、日志结束
  ↓
[ExceptionFilter]      ← 异常捕手：捕获所有未被处理的异常（兜底）
  ↓
HTTP Response
```

---

## 四大 AOP 角色

| 角色 | 职责 | 接口 | 返回值语义 |
|------|------|------|-----------|
| **Guard** | 认证/授权（在方法执行前拦截） | `CanActivate` | `true`=放行，`false`=403 |
| **Interceptor** | 环绕通知（方法前后都可织入逻辑） | `NestInterceptor` | `Observable`/`Promise` |
| **Pipe** | 参数转换+验证（方法参数绑定前） | `PipeTransform` | 转换后的值 |
| **ExceptionFilter** | 捕获所有未处理的异常（兜底） | `ExceptionFilter` | 自定义响应 |

---

## 与 Spring/Express/Go/Rust 的对比

| 概念 | NestJS | Spring | Express | Go (Gin) | Rust (Axum) |
|------|--------|--------|---------|----------|-------------|
| 认证 Guard | `CanActivate` | `OncePerRequestFilter` | middleware `passport.authenticate` | middleware `authMiddleware` | Tower Layer |
| 环绕 Interceptor | `NestInterceptor` | `@Around` + `@Aspect` | 手动包装 | middleware 链 | Tower Layer |
| 异常 Filter | `ExceptionFilter` | `@ControllerAdvice` | `errorHandler(err,req,res,next)` | `c.Error(err)` + recovery | `IntoResponse` |
| 参数验证 Pipe | `PipeTransform` | `HandlerMethodArgumentResolver` | 手动 `if(isNaN` | `binding:"required"` | `Json<Validate<T>>` |

### 【关键差异：Interceptor 的 Observable 返回值】

NestJS 的 Interceptor 返回 `Observable`（基于 RxJS），这是与所有其他框架最大的不同：
- **原因**：NestJS 原生支持 GraphQL/WebSocket/微服务等多种传输层。Observable 是统一的流抽象。
- **影响**：你的 `intercept()` 方法返回 `Observable`，需要了解 `tap()`/`map()`/`catchError()` 等 RxJS 操作符。
- **对比 Spring**：Spring 的 @Around 返回 `Object`（可以是任何类型），不强制响应式。
- **对比 Go**：Go Gin 的中间件直接操作 `*gin.Context`，没有抽象层。

---

## 绑定方式（范围控制）

```
全局绑定:  app.useGlobalGuards(new AuthGuard())
模块绑定:  @Module({ providers: [{ provide: APP_GUARD, useClass: AuthGuard }] })
控制器绑定: @Controller() @UseGuards(AuthGuard)
方法绑定:  @Get() @UseGuards(AuthGuard)
参数绑定:  @Body(ValidationPipe) — Pipe 可以绑定到方法参数级别
```

---

## 运行命令

```bash
cd level-05-AOP切面
npm install && npm run start:dev
```

## 自检清单

- [ ] 能手写 Guard（CanActivate）做简单认证/授权
- [ ] 能手写 Interceptor（NestInterceptor）实现统一响应封装
- [ ] 能手写 ExceptionFilter 捕获所有异常
- [ ] 能准确画出 AOP 执行顺序：M → G → I前 → P → Ctrl → I后 → EF
- [ ] 能向 Spring 开发者解释 NestJS Interceptor 为什么返回 Observable 而非 Object
