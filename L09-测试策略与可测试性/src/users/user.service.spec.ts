import { Test, TestingModule } from "@nestjs/testing";
import { NotFoundException } from "@nestjs/common";
import { UserService } from "./user.service";

/**
 * WHAT: UserService 单元测试
 *
 * 【核心原理——TestingModule】
 *   Test.createTestingModule() 创建隔离的 NestJS 模块：
 *   - 不启动 HTTP 服务器
 *   - 不连接数据库
 *   - 所有依赖可以通过 useValue 注入 mock
 *
 *   测试可以精确控制输入 → 验证输出和副作用。
 *
 * 【测试金字塔——单元测试位于最底层】
 *   - 最多、最快、最精确
 *   - 测试单个类的行为，不涉及 I/O
 *   - Mock 所有外部依赖
 *
 * 【对比 Spring Boot Test】
 *   NestJS 的 TestingModule 比 Spring 的 @SpringBootTest 轻量得多——
 *   不需要启动 Servlet 容器，测试启动时间 < 100ms。
 *
 * 【对比 Go】
 *   Go 的单元测试直接 new 对象 + 函数调用：
 *   svc := &UserService{users: []User{{...}}}
 *   result := svc.FindAll()
 *   不需要 TestingModule——Go 没有 IoC 容器
 *
 * 【对比 Rust】
 *   Rust 单元测试写在与源码同一文件中：
 *   #[cfg(test)]
 *   mod tests { use super::*; ... }
 *   编译期保证测试与源码一致性，无运行时成本
 */
describe("UserService (Unit Test)", () => {
  let service: UserService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [UserService],
    }).compile();

    service = module.get<UserService>(UserService);
  });

  // ==========================================
  // findAll 测试
  // ==========================================
  describe("findAll", () => {
    it("应该返回用户列表", () => {
      const users = service.findAll();
      expect(users).toHaveLength(2);
      expect(users[0].name).toBe("张三");
    });

    it("应该包含完整的用户字段", () => {
      const users = service.findAll();
      expect(users[0]).toHaveProperty("id");
      expect(users[0]).toHaveProperty("name");
      expect(users[0]).toHaveProperty("email");
      expect(users[0]).toHaveProperty("age");
    });
  });

  // ==========================================
  // findOne 测试
  // ==========================================
  describe("findOne", () => {
    it("应该返回指定 ID 的用户", () => {
      const user = service.findOne(1);
      expect(user.id).toBe(1);
      expect(user.name).toBe("张三");
    });

    it("应该在用户不存在时抛出 NotFoundException", () => {
      expect(() => service.findOne(999)).toThrow(NotFoundException);
      expect(() => service.findOne(999)).toThrow("用户 id=999 不存在");
    });
  });

  // ==========================================
  // create 测试
  // ==========================================
  describe("create", () => {
    it("应该创建并返回新用户", () => {
      const dto = { name: "王五", email: "wangwu@test.com", age: 25 };
      const user = service.create(dto);

      expect(user.id).toBe(3);
      expect(user.name).toBe("王五");
      expect(user.email).toBe("wangwu@test.com");

      // 验证已加入列表
      expect(service.findAll()).toHaveLength(3);
    });

    it("应该自动递增 ID", () => {
      const u1 = service.create({ name: "A", email: "a@test.com", age: 20 });
      const u2 = service.create({ name: "B", email: "b@test.com", age: 21 });
      expect(u2.id).toBe(u1.id + 1);
    });
  });

  // ==========================================
  // update 测试
  // ==========================================
  describe("update", () => {
    it("应该更新用户字段", () => {
      const updated = service.update(1, { name: "张三三" });
      expect(updated.name).toBe("张三三");
      expect(updated.email).toBe("zhangsan@test.com"); // 未改
    });

    it("应该在用户不存在时抛出 NotFoundException", () => {
      expect(() => service.update(999, { name: "不存在" })).toThrow(
        NotFoundException,
      );
    });
  });

  // ==========================================
  // remove 测试
  // ==========================================
  describe("remove", () => {
    it("应该删除用户", () => {
      const result = service.remove(1);
      expect(result).toEqual({ message: "删除成功" });
      expect(service.findAll()).toHaveLength(1);
    });

    it("应该在用户不存在时抛出 NotFoundException", () => {
      expect(() => service.remove(999)).toThrow(NotFoundException);
    });
  });
});
