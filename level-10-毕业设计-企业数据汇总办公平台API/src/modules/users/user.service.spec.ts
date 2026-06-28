import { Test, TestingModule } from "@nestjs/testing";
import { UserService } from "./user.service";
import { PrismaService } from "../../database/prisma.service";

/**
 * WHAT: UserService 单元测试
 *
 * 【核心原理——NestJS Testing Module】
 *   Test.createTestingModule() 创建隔离的 NestJS IoC 容器：
 *   1. 不启动 HTTP 服务器（不需要监听端口）
 *   2. 可以 mock 任何 Provider（如 PrismaService）
 *   3. 测试速度极快——纯内存操作
 *
 * 【对比 Spring Boot Test】
 *   Spring 的 @SpringBootTest 启动完整容器（慢）
 *   @WebMvcTest 只启动 Controller 层（类似 NestJS 的 test module）
 *   但 NestJS 的 test module 更灵活——可以精确控制哪些 Provider 是真实的、哪些是 mock 的
 *
 * 【对比 Go】
 *   Go 的测试直接创建 struct 并注入 mock 依赖（不需要 IoC 容器）
 *   func TestUserService(t *testing.T) { svc := NewUserService(mockDB); ... }
 *   比 NestJS 的 test module 更简单直接——因为没有运行期 IoC
 *
 * 【对比 Rust】
 *   Rust 用 #[cfg(test)] + mock!() 宏做测试
 *   所有 mock 在编译期确定——零运行时开销
 */
describe("UserService", () => {
  let service: UserService;
  let prisma: any;

  beforeEach(async () => {
    // 创建 mock PrismaService
    prisma = {
      user: {
        findMany: jest.fn().mockResolvedValue([
          { id: 1, username: "test", email: "test@test.com", realName: "测试", role: "USER", isActive: true, createdAt: new Date() },
        ]),
        findUnique: jest.fn().mockImplementation(({ where }) =>
          where.id === 1 ? { id: 1, username: "test", email: "test@test.com", realName: "测试", role: "USER", isActive: true } : null
        ),
        findFirst: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockImplementation(({ data }) => ({
          id: 2, username: data.username, email: data.email, realName: data.realName, role: data.role || "USER",
        })),
        update: jest.fn().mockImplementation(({ where, data }) => ({ id: where.id, ...data })),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UserService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    service = module.get<UserService>(UserService);
  });

  describe("findAll", () => {
    it("应该返回用户列表", async () => {
      const users = await service.findAll();
      expect(users).toHaveLength(1);
      expect(users[0].username).toBe("test");
    });
  });

  describe("findById", () => {
    it("存在时应该返回用户", async () => {
      const user = await service.findById(1);
      expect(user.username).toBe("test");
    });

    it("不存在时应该抛出 NotFoundException", async () => {
      await expect(service.findById(999)).rejects.toThrow("用户 id=999 不存在");
    });
  });

  describe("create", () => {
    it("应该创建新用户", async () => {
      const dto = { username: "newuser", email: "new@test.com", password: "123456", realName: "新用户" };
      const user = await service.create(dto);
      expect(user.username).toBe("newuser");
    });
  });
});
