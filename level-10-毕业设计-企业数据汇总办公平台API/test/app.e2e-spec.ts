/**
 * WHAT: E2E 测试——启动完整 NestJS 应用，通过 HTTP 请求测试
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
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it("/auth/login (POST) - 登录", async () => {
    const res = await request(app.getHttpServer())
      .post("/auth/login")
      .send({ username: "admin", password: "admin123" });

    expect(res.status).toBe(201);
    expect(res.body.data).toHaveProperty("access_token");
  });

  it("/auth/login (POST) - 错误的密码返回 401", async () => {
    const res = await request(app.getHttpServer())
      .post("/auth/login")
      .send({ username: "admin", password: "wrong" });

    expect(res.status).toBe(401);
  });

  it("/auth/profile (GET) - 无 Token 返回 401", async () => {
    const res = await request(app.getHttpServer()).get("/auth/profile");
    expect(res.status).toBe(401);
  });
});
