/**
 * ============================================================
 * 第 18 章：测试（Jest + Supertest）
 * ============================================================
 *
 * 【学习目标】
 *   1. 理解 NestJS 测试哲学：单元测试（隔离 Service）+ E2E 测试（完整 HTTP 请求）
 *   2. 掌握 Test.createTestingModule() 创建测试模块
 *   3. 掌握依赖模拟：jest.spyOn()、自定义 Mock Provider（useValue）
 *   4. 掌握 E2E 测试：supertest 模拟 HTTP 请求
 *   5. 理解数据库测试策略：独立测试库或事务回滚
 *
 * 【与 Express/FastAPI/Spring/Django 的对比提示】
 *   - Express：supertest + jest 手动组装
 *   - FastAPI：TestClient + pytest
 *   - Spring：@SpringBootTest + MockMvc + JUnit / Mockito
 *   - Django：APITestCase + Client
 *
 * 【与 Vue3 前端的协作关系】
 *   - 后端测试关注数据一致性和边界条件
 *   - 前端 Vitest 测试关注 UI 交互和组件渲染
 *   - E2E 测试（Playwright/Cypress）连接前后端的完整链路测试
 */

// ============================================================
// 示例 1：单元测试 —— Test.createTestingModule()
// ============================================================

/**
 * 【场景】测试 Service 的业务逻辑，隔离化测试
 * 【语法点】Test.createTestingModule() 创建独立的测试 DI 模块
 * 【NestJS 设计意图】@nestjs/testing 提供了 TestModuleBuilder，
 *                   可以覆盖真实 Provider 为 Mock，实现隔离测试
 */

// 这是测试代码的示例，不会在生产代码中运行
// 实际放在 src/users/users.service.spec.ts 中

/*
// ---- 被测 Service ----
@Injectable()
class UsersService {
  constructor(private readonly drizzle: DrizzleService) {}

  async findById(id: number): Promise<User | null> {
    return this.drizzle.user.findUnique({ where: { id } });
  }
}

// ---- 测试文件：users.service.spec.ts ----

import { Test, TestingModule } from '@nestjs/testing';
import { UsersService } from './users.service';
import { DrizzleService } from '../db/drizzle.service';

describe('UsersService', () => {
  let service: UsersService;
  let drizzle: DrizzleService;

  beforeEach(async () => {
    // 创建测试模块：覆盖真实的 DrizzleService
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UsersService,
        {
          provide: DrizzleService,
          // useValue: 提供 Mock 对象
          useValue: {
            user: {
              findUnique: jest.fn(),
              findMany: jest.fn(),
              create: jest.fn(),
              update: jest.fn(),
              delete: jest.fn(),
            },
          },
        },
      ],
    }).compile();

    service = module.get<UsersService>(UsersService);
    drizzle = module.get<DrizzleService>(DrizzleService);
  });

  describe('findById', () => {
    it('应该返回用户当用户存在时', async () => {
      const mockUser = { id: 1, name: '张三', email: 'zhang@example.com' };
      jest.spyOn(drizzle.user, 'findUnique').mockResolvedValue(mockUser);

      const result = await service.findById(1);
      expect(result).toEqual(mockUser);
      expect(drizzle.user.findUnique).toHaveBeenCalledWith({ where: { id: 1 } });
    });

    it('应该返回 null 当用户不存在时', async () => {
      jest.spyOn(drizzle.user, 'findUnique').mockResolvedValue(null);

      const result = await service.findById(999);
      expect(result).toBeNull();
    });

    it('应该抛出异常当数据库查询失败时', async () => {
      jest.spyOn(drizzle.user, 'findUnique').mockRejectedValue(new Error('数据库连接失败'));

      await expect(service.findById(1)).rejects.toThrow('数据库连接失败');
    });
  });
});
*/

// ============================================================
// 示例 2：Mock Provider 策略 —— useValue 和 jest.spyOn()
// ============================================================

/**
 * 【场景】不同的 Mock 策略选择
 * 【语法点】
 *   - useValue：提供完整的 Mock 对象（最常用）
 *   - jest.spyOn()：监视真实对象上的方法
 *   - jest.fn()：创建 Mock 函数
 * 【NestJS 设计意图】DI 容器让替换依赖变得极其简单，
 *                   测试时注入 Mock 对象即可
 */

// Mock 对象策略对比

// 策略 1：useValue + 预定义 Mock（适合简单场景）
const mockDrizzleService = {
  user: {
    findUnique: jest.fn().mockResolvedValue({ id: 1, name: 'test' }),
    findMany: jest.fn().mockResolvedValue([]),
    create: jest
      .fn()
      .mockImplementation((args) => ({ id: Date.now(), ...args.data })),
  },
};

// 策略 2：jest.spyOn + 真实对象（适合需要部分真实的场景）
// const realService = module.get(UserService);
// jest.spyOn(realService, 'findById').mockResolvedValue(mockUser);

// 策略 3：Auto Mock（保持接口类型但不需要实现）
const createAutoMock = <T extends object>(): T => {
  return new Proxy({} as T, {
    get: (_target, prop: string | symbol) => {
      if (typeof prop === 'string') {
        return jest.fn();
      }
      return undefined;
    },
  });
};

// ============================================================
// 示例 3：E2E 测试 —— Supertest 完整链路测试
// ============================================================

/**
 * 【场景】测试完整的 HTTP 请求-响应链路
 * 【语法点】supertest 的 request(app).get().expect()
 * 【NestJS 设计意图】E2E 测试验证所有层（Middleware → Guard → Pipe → Controller → Service → DB）的协作
 *                   使用 TestingModule 获取 NestJS 应用实例
 */

// E2E 测试示例（实际放在 test/app.e2e-spec.ts）

/*
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';

describe('AppController (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],  // 导入真实的 AppModule
    }).compile();

    app = moduleFixture.createNestApplication();
    // 复制 main.ts 中的全局配置
    app.setGlobalPrefix('api/v1');
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    app.useGlobalFilters(new AllExceptionsFilter());

    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  describe('GET /api/v1/health', () => {
    it('应该返回 200', () => {
      return request(app.getHttpServer())
        .get('/api/v1/health')
        .expect(200)
        .expect((res) => {
          expect(res.body).toHaveProperty('code', 200);
        });
    });
  });

  describe('POST /api/v1/auth/register', () => {
    it('应该成功注册新用户', () => {
      return request(app.getHttpServer())
        .post('/api/v1/auth/register')
        .send({ email: 'test@example.com', password: 'Password123', name: '测试' })
        .expect(201)
        .expect((res) => {
          expect(res.body.data).toHaveProperty('accessToken');
          expect(res.body.data).toHaveProperty('refreshToken');
        });
    });

    it('应该返回 400 当参数不合法', () => {
      return request(app.getHttpServer())
        .post('/api/v1/auth/register')
        .send({ email: 'invalid', password: '12' })  // 无效参数
        .expect(400);
    });
  });

  describe('认证后的请求', () => {
    let accessToken: string;

    // 先登录获取 Token
    beforeAll(async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .send({ email: 'test@example.com', password: 'Password123' });
      accessToken = res.body.data.accessToken;
    });

    it('应该返回当前用户信息', () => {
      return request(app.getHttpServer())
        .get('/api/v1/users/me')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);
    });

    it('应该返回 401 当 Token 无效', () => {
      return request(app.getHttpServer())
        .get('/api/v1/users/me')
        .set('Authorization', 'Bearer invalid-token')
        .expect(401);
    });
  });
});
*/

// ============================================================
// 示例 4：数据库测试策略
// ============================================================

/**
 * 【场景】测试需要真实的数据库交互时
 * 【策略选择】
 *
 * 策略 1：独立测试数据库（推荐）
 *   配置单独的 DATABASE_URL → 测试前 migrate → 测试后清理
 *   优点：最接近生产环境
 *   缺点：速度较慢
 *
 * 策略 2：事务回滚（适合 ORM 支持的工具）
 *   beforeEach 开事务 → 测试执行 → afterEach 回滚
 *   Drizzle 可使用 transaction rollback 或手动控制
 *   优点：快，不需要清理数据
 *   缺点：无法测试事务相关的逻辑
 *
 * 策略 3：内存数据库（快速反馈）
 *   SQLite :memory: 或 pg-mem
 *   优点：极快，CI 友好
 *   缺点：与 PostgreSQL 有细微差异
 */

// 事务回滚测试策略示例
class TransactionalTestStrategy {
  // beforeEach() {
  //   // 1. 开启事务
  //   await drizzle.db.execute(sql`BEGIN`);
  // }
  // afterEach() {
  //   // 2. 回滚事务（自动清理所有测试数据）
  //   await drizzle.db.execute(sql`ROLLBACK`);
  // }
  // it('应该创建用户', async () => {
  //   const user = await service.create({ name: 'test', email: 'test@test.com', password: '123456' });
  //   expect(user.id).toBeDefined();
  //   // afterEach 回滚后，数据库中不会有这个用户
  // });
}

// ============================================================
// 示例 5：测试覆盖率
// ============================================================

/**
 * 【场景】确保测试覆盖了足够的代码路径
 * 【命令】npm run test:cov
 * 【配置】jest.config 中的 collectCoverageFrom
 *
 * 常见覆盖率指标：
 *   - 语句覆盖率（Statements）：执行的代码行比例
 *   - 分支覆盖率（Branches）：if/else 分支的覆盖比例
 *   - 函数覆盖率（Functions）：被调用的函数比例
 *   - 行覆盖率（Lines）：被执行的代码行比例
 *
 * 推荐目标：
 *   - Service 层：≥ 80% （核心业务逻辑）
 *   - Controller 层：≥ 60% （主要是路由+参数提取，业务逻辑已下沉到 Service）
 *   - E2E 测试：覆盖所有核心 API 端点
 */

// jest 配置中的覆盖率设置
const coverageConfig = {
  collectCoverageFrom: [
    'src/**/*.ts',
    '!src/main.ts', // 入口文件不需要测试
    '!src/**/*.module.ts', // 模块定义不需要测试（类型检查已覆盖）
    '!src/**/*.dto.ts', // DTO 装饰器不需要测试
    '!src/learn/**', // 学习文件不需要测试
  ],
  coverageThreshold: {
    global: {
      branches: 70,
      functions: 80,
      lines: 80,
      statements: 80,
    },
  },
};

// ============================================================
// 示例 6：测试守卫和管道
// ============================================================

/**
 * 【场景】单独测试守卫和管道的逻辑
 * 【语法点】构造函数直接传参，不依赖 NestJS 测试模块
 */
class TestGuardsAndPipes {
  /*
  // 测试守卫
  describe('RolesGuard', () => {
    let guard: RolesGuard;
    let reflector: Reflector;

    beforeEach(() => {
      reflector = new Reflector();
      guard = new RolesGuard(reflector);
    });

    it('应该允许有正确角色的用户', () => {
      jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(['ADMIN']);

      const context = createMock<ExecutionContext>();
      context.switchToHttp().getRequest.mockReturnValue({
        user: { id: 1, role: 'ADMIN' },
      });

      expect(guard.canActivate(context)).toBe(true);
    });

    it('应该拒绝没有权限的用户', () => {
      jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(['ADMIN']);

      const context = createMock<ExecutionContext>();
      context.switchToHttp().getRequest.mockReturnValue({
        user: { id: 2, role: 'USER' },
      });

      expect(guard.canActivate(context)).toBe(false);
    });
  });

  // 测试自定义管道
  describe('TrimAndLengthPipe', () => {
    const pipe = new TrimAndLengthPipe(1, 100);

    it('应该 trim 空格并返回', () => {
      expect(pipe.transform('  hello  ', { type: 'query', data: 'test' })).toBe('hello');
    });

    it('应该抛出异常当字符串过长', () => {
      expect(() => pipe.transform('a'.repeat(101), { type: 'query', data: 'test' })).toThrow(BadRequestException);
    });
  });
  */
}

// ============================================================
// ❌ 常见错误 1：未关闭数据库连接导致测试挂起
// ============================================================

/**
 * 【错误现象】测试执行完毕后进程不退出，一直挂起
 * 【错误原因】DrizzleService 的连接池未关闭，Node.js 事件循环中还有活跃句柄
 *             Jest 的 --forceExit 是临时方案，不应依赖
 * 【正确写法】afterAll 中调用 app.close() 或 drizzle.onModuleDestroy()
 */

// ❌ 错误写法：
// afterAll(() => {
//   // 忘记关闭连接
// });

// ✅ 正确写法：
// afterAll(async () => {
//   await app.close();
//   // 或
//   await drizzle.onModuleDestroy();
// });

// ============================================================
// ❌ 常见错误 2：模块依赖未在测试模块中导入
// ============================================================

/**
 * 【错误现象】Nest can't resolve dependencies of the XxxService
 * 【错误原因】测试模块只注册了被测 Service，但它的依赖没有注册
 * 【正确写法】要么导入完整的模块，要么 Mock 所有依赖
 */

// ❌ 错误写法：
// const module = await Test.createTestingModule({
//   providers: [UsersService],  // UsersService 需要 DrizzleService 但没注册！
// }).compile();

// ✅ 正确写法：
// const module = await Test.createTestingModule({
//   providers: [
//     UsersService,
//     { provide: DrizzleService, useValue: mockDrizzleService },  // Mock 依赖
//   ],
// }).compile();

// ============================================================
// ❌ 常见错误 3：异步测试未使用 async/await 或 done()
// ============================================================

/**
 * 【错误现象】异步测试通过但实际逻辑没有正确执行（假阳性）
 * 【错误原因】Jest 不知道测试是异步的，Promise 未等待就结束了
 * 【正确写法】使用 async/await 或返回 Promise
 */

// ❌ 错误写法：
// it('应该创建用户', () => {
//   service.create({ name: 'test' });  // 没有 await，Promise 未被等待
//   // 测试通过，但断言从未执行！
// });

// ✅ 正确写法：
// it('应该创建用户', async () => {
//   const user = await service.create({ name: 'test' });
//   expect(user.id).toBeDefined();
// });

console.log('=== 第 18 章示例代码结束 ===');

// ============================================================
// 本章小结
// ============================================================
/*
 * 【核心要点】
 *   - Test.createTestingModule() 替换真实 Provider 为 Mock
 *   - useValue 提供 Mock 对象，jest.spyOn() 监视方法调用
 *   - E2E 测试使用 supertest 模拟完整 HTTP 请求链路
 *   - 数据库测试策略：独立测试库 / 事务回滚 / 内存数据库
 *   - 始终在 afterAll 中关闭数据库连接和 app.close()
 *   - 测试覆盖率：Service ≥ 80%，Controller ≥ 60%，E2E 覆盖核心端点
 *
 * 【与前后章的关联】
 *   - 第 04 章：DI 容器的可替换性使测试隔离变得容易
 *   - 第 12 章：DrizzleService 的 Mock 替代真实数据库
 *   - 第 13 章：E2E 测试验证完整的认证流程
 *
 * 【常见面试题】
 *   Q: 单元测试和 E2E 测试在 NestJS 中如何区分？
 *   A: 单元测试：使用 createTestingModule 隔离测试单个 Provider，
 *      用 Mock 替代所有依赖，快、隔离性好。
 *      E2E 测试：使用 createNestApplication 启动完整应用，
 *      用 supertest 发送真实 HTTP 请求，测试完整链路。
 *      单元测试验证业务逻辑正确性，E2E 测试验证系统集成正确性。
 *
 *   Q: 如何处理数据库测试数据不互相影响？
 *   A: 1）独立测试数据库（DATABASE_URL 指向测试库）
 *      2）事务回滚（使用 Drizzle transaction 或在 beforeEach/afterEach 中 BEGIN/ROLLBACK）
 *      3）每个测试用例创建 unique 的数据并在 afterEach 清理
 */
// ============================================================
// 🎯 通关检查清单
// ============================================================
/*
 * [ ] 能使用 Test.createTestingModule 创建测试模块
 * [ ] 能 Mock DrizzleService 并写一个 Service 的单元测试
 * [ ] 能写一个 E2E 测试（HTTP 请求-响应完整链路）
 * [ ] 能说出单元测试和 E2E 测试的区别
 * [ ] 能指出 1 个常见错误及修复方法
 */
