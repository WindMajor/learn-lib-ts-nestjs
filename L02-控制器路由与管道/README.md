# Level 02：控制器、路由与管道

> **通关标准**：能手写出完整的 CRUD Controller（含参数校验和类型转换的 Pipe），并解释 NestJS 的请求处理管线的执行顺序。

---

## 核心概念速查

| 概念 | 一句话解释 | 你熟悉的对照物 |
|------|-----------|---------------|
| `@Param('id')` | 提取 URL 路径参数 | Express 的 `req.params.id` |
| `@Query('name')` | 提取 URL 查询参数 | Express 的 `req.query.name` |
| `@Body()` | 提取请求体 JSON | Express 的 `req.body` |
| `@Headers('Authorization')` | 提取请求头 | Express 的 `req.headers.authorization` |
| `ParseIntPipe` | 内置 Pipe，将字符串参数转为 number | Express 需要手动 `parseInt()` |
| `ValidationPipe` | 内置 Pipe，自动验证 DTO | Spring 的 `@Valid` |
| `@HttpCode(201)` | 自定义响应状态码 | Express 的 `res.status(201)` |
| `@Redirect()` | 返回 302 重定向 | Express 的 `res.redirect()` |
| 自定义 Pipe | 实现 `PipeTransform` 接口，插入请求管线 | Express 中间件的作用 |

---

## 与 Express/Spring/Go/FastAPI 的核心差异

### 【对比 Express】
Express 的参数提取是手动+命令式的：
```typescript
app.get('/cats/:id', (req, res) => {
  const id = parseInt(req.params.id);  // 手动提取 + 手动转换
  if (isNaN(id)) return res.status(400).json({ error: 'Invalid ID' });
  // ...
});
```
NestJS 是声明式的：
```typescript
@Get(':id')
findOne(@Param('id', ParseIntPipe) id: number) {
  // id 已经是 number 类型，且保证有效
}
```
差异：NestJS 把"提取参数"和"验证转换"分离到装饰器和 Pipe 中，Controller 方法只处理业务逻辑。

### 【对比 Spring Boot】
Spring 的 `@PathVariable`/`@RequestParam`/`@RequestBody` 与 NestJS 的 `@Param`/`@Query`/`@Body` 几乎是 1:1 映射。核心差异在于：
- Spring 的类型转换基于 Converter SPI（可插拔）
- NestJS 用 Pipe 接口（更灵活，可以做验证、转换、清理）

### 【对比 Go Gin】
Gin 使用 `c.Param()`/`c.Query()`/`c.ShouldBindJSON()` ——全部是命令式的。
NestJS 的声明式在复杂场景中优势很明显：一个方法有 5 个参数时，装饰器让你清楚看到每个参数来自哪里。

### 【对比 FastAPI】
FastAPI 的 Pydantic + 类型注解自动解析最接近 NestJS 的 DTO + ValidationPipe。
但 FastAPI 的类型系统更强——Python 的 Pydantic 支持更丰富的类型约束。

---

## 请求处理管线（Request Pipeline）

```
HTTP 请求到达
  → Middleware（Express 层，Level 05 详讲）
  → Guard（认证/授权，Level 07 详讲）
  → Interceptor (前)
  → Pipe（参数转换+验证）         ← 本关重点
  → Controller 方法执行
  → Interceptor (后)
  → ExceptionFilter（如有异常，Level 05 详讲）
  → HTTP 响应
```

---

## 运行命令

```bash
cd L02-控制器路由与管道
npm install
npm run start:dev
```

---

## 自检清单

- [ ] 能手写出含 `@Param/@Query/@Body/@Headers` 的 Controller 方法
- [ ] 能实现自定义 Pipe（`PipeTransform` 接口）
- [ ] 能描述 NestJS 请求管线中 Pipe 的执行位置和时机
- [ ] 能独立修复 `bugs/` 目录下的 2 个错误
- [ ] 能向只用 Express 的开发者解释"Pipe 和中间件在职责上有什么区别"
