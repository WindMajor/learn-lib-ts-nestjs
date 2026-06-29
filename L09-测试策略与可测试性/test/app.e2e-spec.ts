/**
 * WHAT: E2E 测试——启动完整 NestJS 应用，通过 HTTP 请求测试
 *
 * 【测试金字塔——E2E 位于最顶端】
 *   - 最少、最慢、最全面
 *   - 测试完整 HTTP 请求→响应管线
 *   - 覆盖所有 AOP 层（Guard/Pipe/Interceptor/Filter）
 *
 * 【核心原理——supertest + NestJS】
 *   supertest 创建 HTTP 客户端，向 in-memory 的 NestJS 应用发送请求。
 *   不需要真实的 HTTP 端口——supertest 直接调用 app.getHttpServer()。
 *
 * 【对比 Spring Boot】
 *   @SpringBootTest(webEnvironment = RANDOM_PORT) + TestRestTemplate
 *   相同的思路——启动完整应用，通过 HTTP 请求测试完整链路
 *
 * 【对比 Go】
 *   httptest.NewServer(handler) + http.Get()
 *   同样启动测试服务器，通过 real HTTP 请求测试
 *
 * 【对比 Rust (Axum)】
 *   let app = Router::new().route("/", get(handler));
 *   let res = app.oneshot(Request::builder().uri("/").body(Body::empty())?).await;
 *   Axum 的 oneshot() 更轻量——不需要 HTTP 服务器，直接模拟请求
 *
 * 运行：npm run test:e2e
 */
import { Test, TestingModule } from "@nestjs/testing";
import { INestApplication, ValidationPipe } from "@nestjs/common";
import * as request from "supertest";
import { AppModule } from "../src/app.module";

describe("App E2E", () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    // E2E 测试也要设置与生产一致的全局管道
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, transform: true }),
    );
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  // ==========================================
  // GET /users —— 查询用户列表
  // ==========================================
  describe("GET /users", () => {
    it("应该返回用户列表（200）", async () => {
      const res = await request(app.getHttpServer()).get("/users");
      expect(res.status).toBe(200);
      expect(res.body).toHaveLength(2);
      expect(res.body[0]).toHaveProperty("name");
      expect(res.body[0]).toHaveProperty("email");
    });
  });

  // ==========================================
  // GET /users/:id —— 查询单个用户
  // ==========================================
  describe("GET /users/:id", () => {
    it("应该返回指定用户（200）", async () => {
      const res = await request(app.getHttpServer()).get("/users/1");
      expect(res.status).toBe(200);
      expect(res.body.name).toBe("张三");
      expect(res.body.email).toBe("zhangsan@test.com");
    });

    it("应该在用户不存在时返回 404", async () => {
      const res = await request(app.getHttpServer()).get("/users/999");
      expect(res.status).toBe(404);
    });

    it("应该在 ID 格式不正确时返回 400", async () => {
      const res = await request(app.getHttpServer()).get("/users/abc");
      expect(res.status).toBe(400);
    });
  });

  // ==========================================
  // POST /users —— 创建用户
  // ==========================================
  describe("POST /users", () => {
    it("应该创建用户（201）", async () => {
      const res = await request(app.getHttpServer())
        .post("/users")
        .send({ name: "王五", email: "wangwu@test.com", age: 25 });

      expect(res.status).toBe(201);
      expect(res.body.name).toBe("王五");
      expect(res.body.id).toBe(3);
    });

    it("应该在缺少必填字段时返回 400", async () => {
      const res = await request(app.getHttpServer())
        .post("/users")
        .send({ name: "无邮箱用户" }); // 缺少 email 和 age

      expect(res.status).toBe(400);
    });

    it("应该在邮箱格式错误时返回 400", async () => {
      const res = await request(app.getHttpServer())
        .post("/users")
        .send({ name: "测试", email: "not-an-email", age: 20 });

      expect(res.status).toBe(400);
    });
  });

  // ==========================================
  // PATCH /users/:id —— 更新用户
  // ==========================================
  describe("PATCH /users/:id", () => {
    it("应该更新用户（200）", async () => {
      const res = await request(app.getHttpServer())
        .patch("/users/1")
        .send({ name: "张三三" });

      expect(res.status).toBe(200);
      expect(res.body.name).toBe("张三三");
      expect(res.body.email).toBe("zhangsan@test.com"); // 未改
    });

    it("应该在用户不存在时返回 404", async () => {
      const res = await request(app.getHttpServer())
        .patch("/users/999")
        .send({ name: "不存在" });

      expect(res.status).toBe(404);
    });
  });

  // ==========================================
  // DELETE /users/:id —— 删除用户
  // ==========================================
  describe("DELETE /users/:id", () => {
    it("应该删除用户（200）", async () => {
      const res = await request(app.getHttpServer()).delete("/users/2");
      expect(res.status).toBe(200);
      expect(res.body.message).toBe("删除成功");

      // 确认已删除
      const res2 = await request(app.getHttpServer()).get("/users/2");
      expect(res2.status).toBe(404);
    });

    it("应该在用户不存在时返回 404", async () => {
      const res = await request(app.getHttpServer()).delete("/users/999");
      expect(res.status).toBe(404);
    });
  });
});
