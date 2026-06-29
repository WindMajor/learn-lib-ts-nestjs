# Level 07：认证、授权与自定义装饰器

> **通关标准**：能使用 JWT + Passport 实现认证，能用自定义装饰器 + Reflector 实现 RBAC 授权，理解 NestJS 的元数据反射机制。

---

## 核心概念

| 概念 | 说明 | 对比 |
|------|------|------|
| `@nestjs/passport` + `@nestjs/jwt` | JWT 认证——签发与验证 | Spring Security + JJWT |
| `PassportStrategy(Strategy)` | JWT 策略——从 Header 提取并验证 Token | Spring `OncePerRequestFilter` |
| `@UseGuards(JwtAuthGuard)` | 绑定认证守卫到端点 | Spring `@Secured` |
| `@Roles('admin')` + `RolesGuard` | 自定义装饰器 + Reflector 实现 RBAC | Spring `@PreAuthorize` |
| `@CurrentUser()` | 自定义参数装饰器——提取当前用户 | Spring `@AuthenticationPrincipal` |
| `SetMetadata()` / `Reflector` | 元数据反射——装饰器与 Guard 的桥梁 | Java 反射注解 |

---

## 快速开始

```bash
cd level-07-认证授权与自定义装饰器
npm install
cp .env.example .env   # 配置 JWT 密钥
npm run start:dev
```

---

## API 端点

### 登录获取 Token

```bash
# 管理员登录
curl -X POST http://localhost:3000/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"admin123"}'

# 普通用户登录
curl -X POST http://localhost:3000/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"user","password":"user123"}'

# 错误密码 → 401
curl -X POST http://localhost:3000/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"wrong"}'
```

### 获取当前用户资料（需 JWT）

```bash
TOKEN="<从登录响应中获取的 access_token>"
curl http://localhost:3000/auth/profile \
  -H "Authorization: Bearer $TOKEN"
```

### 管理员端点（需 admin 角色）

```bash
# admin 用户 → 200
curl http://localhost:3000/auth/admin \
  -H "Authorization: Bearer $ADMIN_TOKEN"

# user 用户 → 403 Forbidden
curl http://localhost:3000/auth/admin \
  -H "Authorization: Bearer $USER_TOKEN"
```

---

## 请求管线（认证相关部分）

```
HTTP Request
  → JwtAuthGuard（从 Authorization Header 提取 JWT）
    → JwtStrategy.validate()（验证签名 + 解析 payload）
      → request.user = { userId, username, role }
  → RolesGuard（通过 Reflector 读取 @Roles() 元数据）
    → 检查 request.user.role 是否在 requiredRoles 中
  → Controller（通过 @CurrentUser() 提取 request.user）
```

---

## 核心原理

### Passport + NestJS 的集成方式

1. `JwtStrategy extends PassportStrategy(Strategy)` —— 继承 passport-jwt 的 Strategy
2. `super({ jwtFromRequest, secretOrKey, ... })` —— 配置如何提取和验证 JWT
3. `validate(payload)` —— 验证通过后的回调，返回值赋给 `request.user`

### 自定义装饰器的元数据反射

```
@Roles('admin')                    → SetMetadata('roles', ['admin'])
  ↓                                   ↓
RolesGuard.canActivate()          → reflector.get('roles', handler)
  ↓                                   ↓
requiredRoles.includes(user.role) → true/false
```

---

## 对比要点

- **vs Spring Security**: NestJS 的认证默认不保护任何端点（需手动 `@UseGuards`），Spring 默认保护所有（需 `.permitAll()` 放行）
- **vs Express (passport.js)**: NestJS 用 Guard 模式封装 Passport——更声明式、更可组合
- **vs Go Gin**: Go 用中间件手动解析 JWT → `c.Set("user", claims)`——没有 Strategy 抽象层
