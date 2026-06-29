import { Test, TestingModule } from "@nestjs/testing";
import { NotFoundException } from "@nestjs/common";
import { UserController } from "./user.controller";
import { UserService } from "./user.service";

/**
 * WHAT: UserController 单元测试——mock Service 层
 *
 * 【核心原理——使用 useValue 注入 mock】
 *   { provide: UserService, useValue: { findAll: jest.fn(), ... } }
 *   这样 Controller 的构造函数中注入的不是真实 Service，而是一个 mock 对象。
 *
 *   测试关注点：
 *   - Controller 是否调用了正确的 Service 方法
 *   - Controller 是否返回了正确的 HTTP 状态码
 *   - Service 抛出的异常是否被正确传播
 *
 * 【Mock 原则】
 *   1. Mock 边界接口（Service 的 public 方法），不 mock 内部实现
 *   2. Mock 返回值应模拟真实数据
 *   3. 测试"行为"而非"实现"
 */
describe("UserController (Unit Test)", () => {
  let controller: UserController;
  let service: UserService;

  const mockUsers = [
    { id: 1, name: "张三", email: "zhangsan@test.com", age: 28 },
    { id: 2, name: "李四", email: "lisi@test.com", age: 35 },
  ];

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [UserController],
      providers: [
        {
          provide: UserService,
          useValue: {
            findAll: jest.fn().mockReturnValue(mockUsers),
            findOne: jest.fn().mockImplementation((id: number) => {
              const user = mockUsers.find((u) => u.id === id);
              if (!user) throw new NotFoundException(`用户 id=${id} 不存在`);
              return user;
            }),
            create: jest
              .fn()
              .mockImplementation((dto) => ({ id: 3, ...dto })),
            update: jest
              .fn()
              .mockImplementation((id, dto) => ({
                ...mockUsers.find((u) => u.id === id)!,
                ...dto,
              })),
            remove: jest.fn().mockReturnValue({ message: "删除成功" }),
          },
        },
      ],
    }).compile();

    controller = module.get<UserController>(UserController);
    service = module.get<UserService>(UserService);
  });

  describe("findAll", () => {
    it("应该返回所有用户", () => {
      const users = controller.findAll();
      expect(users).toHaveLength(2);
      expect(service.findAll).toHaveBeenCalled();
    });
  });

  describe("findOne", () => {
    it("应该返回指定用户", () => {
      const user = controller.findOne(1);
      expect(user.name).toBe("张三");
    });

    it("应该在用户不存在时抛出异常", () => {
      expect(() => controller.findOne(999)).toThrow(NotFoundException);
    });
  });

  describe("create", () => {
    it("应该创建用户", () => {
      const dto = { name: "王五", email: "wangwu@test.com", age: 25 };
      const user = controller.create(dto);
      expect(user.name).toBe("王五");
      expect(service.create).toHaveBeenCalledWith(dto);
    });
  });

  describe("update", () => {
    it("应该调用 service.update", () => {
      const updated = controller.update(1, { name: "张三三" });
      expect(updated.name).toBe("张三三");
      expect(service.update).toHaveBeenCalledWith(1, { name: "张三三" });
    });
  });

  describe("remove", () => {
    it("应该删除用户", () => {
      const result = controller.remove(1);
      expect(result).toEqual({ message: "删除成功" });
      expect(service.remove).toHaveBeenCalledWith(1);
    });
  });
});
