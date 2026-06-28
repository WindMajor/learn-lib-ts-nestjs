# Level 03：DTO、验证与类型安全

> **通关标准**：能手写出嵌套 DTO（含 `@ValidateNested`）、自定义验证装饰器，并正确配置 ValidationPipe 的 `whitelist/forbidNonWhitelisted/transform`。

---

## 核心概念

| 概念 | 一句话解释 | 对比 |
|------|-----------|------|
| `@ValidateNested()` | DTO 内部引用另一个 DTO → 自动递归验证 | Pydantic 的嵌套 Model、Spring 的 `@Valid` |
| `@Type(() => Class)` | 告诉 `class-transformer` 嵌套对象的类型（运行期需要） | Go 的 struct tag `json:"nested"` |
| `@Transform()` | 自定义值转换（如 trim、类型转换） | FastAPI 的 Pydantic validator |
| 自定义装饰器 | 实现 `ValidatorConstraintInterface` + `@ValidatorConstraint` | Spring 的 `@Constraint` |
| `PartialType()` | 从已有 DTO 创建可选版本（用于 Update） | Spring 的继承 + `@NotNull` |
| `OmitType()/PickType()` | 从已有 DTO 中选取/排除字段 | TypeScript Utility Types |

---

## 关键差异：NestJS vs FastAPI(Pydantic)

FastAPI 的 Pydantic 是 Python 原生类型系统的一部分——Model 定义即验证规则。  
NestJS 的 `class-validator` 是第三方库，需要显式装饰器。这意味着：
- NestJS 更啰嗦，但更灵活（可以混合使用不同验证库）
- Pydantic 的验证在 C 扩展中运行（快），class-validator 纯 JS（慢但够用）
- Pydantic 有 `root_validator`（跨字段验证），NestJS 需要自定义 `@ValidateConstraint`

## 关键差异：NestJS vs Go (struct tag)

Go 用 struct tag 做验证：
```go
type CreateCatDto struct {
    Name  string `json:"name" validate:"required,min=1,max=50"`
}
```
差异：Go 的 tag 是字符串协议——库在运行时解析字符串做验证。  
NestJS 的装饰器是函数——编译时类型检查，运行时有装饰器元数据。  
本质都是声明式验证，只是语法不同。

## 运行命令

```bash
cd level-03-DTO验证与类型安全
npm install && npm run start:dev
```

## 自检清单

- [ ] 能手写带 `@ValidateNested()` 的嵌套 DTO
- [ ] 能实现自定义 `@IsCatBreed()` 验证装饰器
- [ ] 能正确使用 `PartialType()` 创建 Update DTO
- [ ] 能独立修复 `bugs/` 目录下的 2 个错误
- [ ] 能向 FastAPI/Go 开发者解释 NestJS DTO 验证的原理和局限
