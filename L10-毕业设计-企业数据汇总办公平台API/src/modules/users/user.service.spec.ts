import { Test, TestingModule } from '@nestjs/testing';
import { UserService } from './user.service';
import { DrizzleService } from '../../db/drizzle.service';

/**
 * WHAT: UserService 单元测试（Drizzle 版本）
 *
 * 【核心差异——mock Drizzle vs mock Prisma】
 *   Prisma: mock prisma.user.findMany.mockResolvedValue([...])
 *   Drizzle: mock drizzle.db.select().from(users) 返回的链式调用
 *
 *   Drizzle 的 mock 更复杂（链式调用），但类型推导向更透明
 */
describe('UserService', () => {
  let service: UserService;
  let mockDb: any;

  beforeEach(async () => {
    // 创建 mock DrizzleService
    const mockSelect = {
      from: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      limit: jest.fn().mockReturnThis(),
      returning: jest.fn(),
    };

    mockDb = {
      db: {
        select: jest.fn().mockReturnValue(mockSelect),
        update: jest.fn().mockReturnValue(mockSelect),
        insert: jest.fn().mockReturnValue(mockSelect),
        delete: jest.fn().mockReturnValue(mockSelect),
      },
    };

    // 设置默认返回值
    mockSelect.returning.mockResolvedValue([]);
    mockSelect.limit.mockResolvedValue([
      { id: 1, username: 'test', email: 'test@test.com', realName: '测试', role: 'USER', isActive: true, departmentId: null, createdAt: new Date() },
    ]);

    const module: TestingModule = await Test.createTestingModule({
      providers: [UserService, { provide: DrizzleService, useValue: mockDb }],
    }).compile();
    service = module.get<UserService>(UserService);
  });

  it('应该返回用户列表', async () => {
    mockDb.db.select().from().orderBy().limit = jest.fn().mockResolvedValue([
      { id: 1, username: 'test', email: 'test@test.com', realName: '测试', role: 'USER', isActive: true, departmentId: null, createdAt: new Date() },
    ]);
    const users = await service.findAll();
    expect(users).toHaveLength(1);
    expect(users[0].username).toBe('test');
  });
});
