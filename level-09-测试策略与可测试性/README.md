# Level 09：测试策略与可测试性

> **通关标准**：能写出 Jest 单元测试（mock Provider）、集成测试（真实数据库）、E2E 测试（supertest），理解测试金字塔。

---

## 测试金字塔

```
        ┌──────┐
        │ E2E  │  ← 完整应用 + HTTP 请求（慢、少）
       ┌┴──────┴┐
       │ 集成测试 │  ← 真实数据库/Redis（中速）
      ┌┴─────────┴┐
      │  单元测试   │  ← mock 所有依赖（快、多）
     └─────────────┘
```

---

## 三类测试的 NestJS 写法

### 单元测试（mock Provider）

```typescript
const module = await Test.createTestingModule({
  providers: [
    MyService,
    { provide: PrismaService, useValue: mockPrisma },
  ],
}).compile();
```

### 集成测试（真实数据库）

```typescript
// 使用真实 PostgreSQL + 事务回滚
beforeEach(async () => { /* 插入测试数据 */ });
afterEach(async () => { /* 回滚/删除 */ });
```

### E2E 测试（supertest）

```typescript
const app = moduleFixture.createNestApplication();
await app.init();
return request(app.getHttpServer()).get('/users').expect(200);
```

---

## 对比要点

- **vs Spring Boot Test**: NestJS 的 `Test.createTestingModule()` 比 Spring 的 `@SpringBootTest` 更轻量——不需要启动完整的 Spring 容器
- **vs Go**: Go 用 `testify` + `httptest`——不需要 IoC 容器，测试设置更简单
- **vs Rust**: Rust 的 `#[cfg(test)]` + `#[tokio::test]`——所有 mock 在编译期确定，零运行时开销

---

## 有效 mock 的原则

1. Mock 边界（Controller → Service → Repository 的接口），而非内部实现
2. Mock 返回值应该模拟真实数据的样子（fake data, not random）
3. 测试"行为"而非"实现"——修改内部代码不应导致测试失败
