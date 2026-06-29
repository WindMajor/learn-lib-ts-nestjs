/**
 * ============================================================
 * 第 05 章：服务层与业务逻辑
 * ============================================================
 *
 * 【学习目标】
 *   1. 掌握 Service 类的设计原则：纯业务逻辑，无 HTTP 相关代码
 *   2. 理解贫血模型 vs 充血模型在 NestJS 中的实践
 *   3. 掌握跨服务调用：通过 DI 注入而非直接 new
 *   4. 掌握事务封装：Drizzle 的 db.transaction() 在 Service 层的使用
 *   5. 理解数据映射：数据库模型 → DTO → VO（View Object）
 *
 * 【与 Express/FastAPI/Spring/Django 的对比提示】
 *   - Express：没有 Service 层概念，业务逻辑通常写在路由回调中
 *   - FastAPI：Depends 可以模拟 Service 注入
 *   - Spring：@Service 注解的类，与 NestJS 的 @Injectable() Service 几乎一致
 *   - Django：ORM Model 的 Manager 和 QuerySet 承担了部分 Service 职责
 *
 * 【与 Vue3 前端的协作关系】
 *   - Service 层 = Vue3 的 Pinia Store Actions（业务逻辑 + 状态管理）
 *   - 数据映射 DTO → VO = Vue3 中 API 返回数据 → 前端展示模型的转换
 *   - Service 的纯函数特性 = Vue3 Composables 的可测试性设计
 */

import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';

// ============================================================
// 示例 1：Service 类的设计原则 —— 纯业务逻辑
// ============================================================

/**
 * 【场景】用户服务：只包含业务逻辑，不接触 HTTP 请求/响应对象
 * 【语法点】Service 是纯 TypeScript 类，不依赖 express 的任何类型
 * 【NestJS 设计意图】分层架构：Controller 处理 HTTP → Service 处理业务 → Repository 处理数据
 *                   这种分离让 Service 可以脱离 HTTP 上下文被测试和复用
 */

// 模拟 Drizzle 用户模型类型（实际由 Drizzle 从 schema 自动推断）
interface User {
  id: number;
  email: string;
  name: string | null;
  password: string;
  role: 'USER' | 'EDITOR' | 'ADMIN';
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

// 模拟 Drizzle DB（实际项目中由 DrizzleService 提供）
interface PrismaTransaction {
  user: {
    findUnique: (args: { where: { id: number } }) => Promise<User | null>;
    findMany: (args: object) => Promise<User[]>;
    create: (args: { data: Partial<User> }) => Promise<User>;
    update: (args: {
      where: { id: number };
      data: Partial<User>;
    }) => Promise<User>;
    delete: (args: { where: { id: number } }) => Promise<User>;
  };
}

@Injectable()
class UsersService_05 {
  // ✅ 注入 DrizzleService（或其他 Repository），而非创建 HTTP 相关依赖
  constructor(
    private readonly prisma: PrismaTransaction,
    private readonly emailService: EmailService_05, // 注入其他 Service
  ) {}

  // ✅ 纯业务方法：接收参数，返回数据，不操作 req/res
  public async findById(id: number): Promise<User> {
    const user: User | null = await this.prisma.user.findUnique({
      where: { id },
    });
    if (!user) {
      // ✅ 使用 NestJS 异常类（而非 res.status().json()）
      throw new NotFoundException(`用户 ${id} 不存在`);
    }
    return user;
  }

  // ✅ 业务逻辑复用：多个 Controller 方法可以调用同一个 Service 方法
  public async findActiveUsers(page: number, limit: number): Promise<User[]> {
    const skip: number = (page - 1) * limit;
    return this.prisma.user.findMany({
      where: { isActive: true },
      skip,
      take: limit,
    });
  }

  // ✅ 跨服务调用：通过 DI 注入 EmailService，而非 new EmailService()
  public async register(
    email: string,
    name: string,
    password: string,
  ): Promise<User> {
    // 1. 业务验证
    const existing: User | null = await this.prisma.user.findUnique({
      where: { id: 0 }, // 简化：实际按 email 查找
    });
    if (existing) {
      throw new BadRequestException('邮箱已被注册');
    }

    // 2. 创建用户
    const user: User = await this.prisma.user.create({
      data: { email, name, password },
    });

    // 3. 发送欢迎邮件（调用其他 Service）
    await this.emailService.sendWelcomeEmail(email, name ?? '用户');

    return user;
  }
}

@Injectable()
class EmailService_05 {
  public async sendWelcomeEmail(to: string, name: string): Promise<void> {
    // 实际项目中连接邮件服务（如 nodemailer）
    console.log(`发送欢迎邮件给 ${name} <${to}>`);
  }
}

// ============================================================
// 示例 2：贫血模型 vs 充血模型
// ============================================================

/**
 * 【场景】讨论两种业务逻辑组织方式的取舍
 * 【语法点】NestJS 默认是贫血模型，但可以实践充血模型
 * 【设计意图对比】
 *   贫血模型：数据对象只包含属性，业务逻辑全在 Service 中
 *     - 优点：职责清晰、便于复用、Service 可独立测试
 *     - 缺点：Service 可能膨胀成上帝类
 *   充血模型：数据对象包含属性和自身的行为方法
 *     - 优点：符合面向对象、逻辑局部性好
 *     - 缺点：与 Drizzle 等 ORM 的生成模型冲突
 */

// 贫血模型示例（NestJS 默认风格，推荐）
@Injectable()
class AnemicUserService {
  public async getUserFullName(user: User): Promise<string> {
    // 业务逻辑在 Service 中处理
    return `${user.name ?? '匿名'} <${user.email}>`;
  }
  public async isAdmin(user: User): Promise<boolean> {
    return user.role === 'ADMIN';
  }
}

// 充血模型示例（Domain-Driven Design 风格）
class RichUserModel {
  constructor(
    public readonly id: number,
    public readonly email: string,
    public readonly name: string | null,
    public readonly role: 'USER' | 'EDITOR' | 'ADMIN',
    public readonly isActive: boolean,
  ) {}

  // 行为方法在模型内部
  public getDisplayName(): string {
    return this.name ?? '匿名用户';
  }

  public canEditPosts(): boolean {
    return this.role === 'EDITOR' || this.role === 'ADMIN';
  }

  public canManageUsers(): boolean {
    return this.role === 'ADMIN';
  }

  // 将数据库 User 转换为充血模型
  public static fromPrisma(prismaUser: User): RichUserModel {
    return new RichUserModel(
      prismaUser.id,
      prismaUser.email,
      prismaUser.name,
      prismaUser.role,
      prismaUser.isActive,
    );
  }
}

// 使用充血模型
@Injectable()
class RichUserService {
  public async getUser(
    id: number,
    prisma: PrismaTransaction,
  ): Promise<RichUserModel> {
    const user: User | null = await prisma.user.findUnique({ where: { id } });
    if (!user) throw new NotFoundException(`用户 ${id} 不存在`);
    return RichUserModel.fromPrisma(user);
  }
}

// ============================================================
// 示例 3：跨服务调用 —— 通过 DI 注入，而非直接 new
// ============================================================

/**
 * 【场景】PostService 需要 UserService 来验证作者是否存在
 * 【语法点】通过构造函数注入其他 Service
 * 【NestJS 设计意图】DI 容器管理所有 Service 的单例实例，new 会创建不受容器管理的新对象
 *                   直接 new 无法获得依赖注入（被 new 的对象内部依赖为空）
 */

// ❌ 错误写法（手动 new）：
// @Injectable()
// class BadPostService {
//   createPost() {
//     const userService = new UsersService_05(???); // 无法传递 prisma
//     // userService.findById(1);  // prisma 为 undefined → 崩溃
//   }
// }

// ✅ 正确写法（DI 注入）：
@Injectable()
class PostService_05 {
  constructor(
    private readonly prisma: PrismaTransaction,
    private readonly userService: UsersService_05, // DI 容器自动注入
    private readonly notificationService: NotificationService_05,
  ) {}

  public async createPost(
    title: string,
    content: string,
    authorId: number,
  ): Promise<object> {
    // 1. 验证作者存在（跨 Service 调用）
    const author: User = await this.userService.findById(authorId);

    // 2. 创建文章
    const post: object = { title, content, authorId };

    // 3. 发送通知（又一个跨 Service 调用）
    await this.notificationService.notifyFollowers(
      authorId,
      `发布了新文章《${title}》`,
    );

    return post;
  }
}

@Injectable()
class NotificationService_05 {
  public async notifyFollowers(userId: number, message: string): Promise<void> {
    console.log(`通知用户 ${userId} 的粉丝: ${message}`);
  }
}

// ============================================================
// 示例 4：事务封装 —— 数据库事务
// ============================================================

/**
 * 【场景】创建订单需要同时扣减库存和创建记录，必须原子执行
 * 【语法点】db.transaction(async (tx) => {...}) 确保所有操作要么全部成功，要么全部回滚
 * 【NestJS 设计意图】事务是业务逻辑层关注的问题，应在 Service 中封装
 */

// 模拟支持事务的完整类型
interface PrismaClientWithTransaction {
  $transaction: <T>(
    operations: (tx: PrismaTransaction) => Promise<T>,
  ) => Promise<T>;
  user: PrismaTransaction['user'];
}

@Injectable()
class OrderService {
  constructor(private readonly prisma: PrismaClientWithTransaction) {}

  // 交互式事务：通过回调函数获得事务 Client
  public async createOrder(
    userId: number,
    productId: number,
    quantity: number,
  ): Promise<object> {
    return this.prisma.$transaction(async (tx: PrismaTransaction) => {
      // 在事务中，所有操作使用 tx 而非 this.prisma
      const user: User | null = await tx.user.findUnique({
        where: { id: userId },
      });
      if (!user) throw new NotFoundException('用户不存在');
      if (!user.isActive) throw new BadRequestException('用户已被禁用');

      // 实际项目中的库存扣减：
      // const product = await tx.product.update({
      //   where: { id: productId },
      //   data: { stock: { decrement: quantity } },
      // });

      // 创建订单
      const order: object = {
        userId,
        productId,
        quantity,
        status: 'CREATED',
      };

      return order;
    });
    // 如果任何一步抛出异常，所有操作自动回滚
  }
}

// ============================================================
// 示例 5：数据映射 —— 数据库模型 → DTO → VO
// ============================================================

/**
 * 【场景】API 返回给前端的数据需要经过多层转换：
 *        数据库原始数据 → DTO（验证后） → Entity → VO（返回给前端）
 * 【语法点】每一步都是类型安全的函数映射
 * 【NestJS 设计意图】每一层有自己的数据类型，防止数据库结构泄露到 API 响应
 *                    也防止前端传过来的数据直接入库
 */
interface CreateUserDto {
  email: string;
  name: string;
  password: string;
}

interface UpdateUserDto {
  name?: string;
  email?: string;
}

interface UserVO {
  id: number;
  email: string;
  displayName: string; // 与数据库 name 字段名不同
  role: string;
  memberSince: string; // 数据库是 Date，VO 是格式化字符串
  postCount: number; // 聚合数据，不在 User 表中
}

@Injectable()
class UserMappingService {
  /**
   * DTO → 数据库模型：注册时，将前端传来的 DTO 转换为入库的数据
   */
  public dtoToCreateData(dto: CreateUserDto): {
    email: string;
    name: string;
    password: string;
  } {
    return {
      email: dto.email.toLowerCase().trim(),
      name: dto.name.trim(),
      password: dto.password, // 实际需要在这里做 bcrypt 哈希
    };
  }

  /**
   * 数据库模型 → VO：将数据库查出的原始数据转换为前端需要的格式
   * 这个映射确保：
   *   1. 不会泄露 password 字段
   *   2. 日期格式化为前端可直接展示的字符串
   *   3. 可以添加计算字段
   */
  public toVO(user: User, postCount: number = 0): UserVO {
    return {
      id: user.id,
      email: user.email,
      displayName: user.name ?? `用户${user.id}`,
      role: user.role,
      memberSince: user.createdAt.toISOString().split('T')[0] ?? '未知',
      postCount,
    };
  }

  /**
   * DO（Domain Object，领域对象）→ VO 列表：批量转换
   */
  public toVOList(
    users: User[],
    postCounts: Map<number, number> = new Map(),
  ): UserVO[] {
    return users.map((user) => this.toVO(user, postCounts.get(user.id) ?? 0));
  }

  /**
   * DTO → DO（更新场景）：将 UpdateUserDto 中的可选字段映射到更新数据
   */
  public dtoToUpdateData(dto: UpdateUserDto): Partial<User> {
    const data: Partial<User> = {};
    if (dto.name !== undefined) data.name = dto.name.trim();
    if (dto.email !== undefined) data.email = dto.email.toLowerCase().trim();
    return data;
  }
}

// ============================================================
// 示例 6：Service 层的错误处理模式
// ============================================================

/**
 * 【场景】Service 中需要明确的错误处理策略
 * 【语法点】使用 NestJS 异常类抛出业务异常，由全局 ExceptionFilter 统一处理
 * 【NestJS 设计意图】Service 抛出语义化异常 → Controller 无需 try-catch → Filter 统一格式化
 */

@Injectable()
class RobustService {
  public async findResourceById(id: number): Promise<object> {
    // 模式 1：资源不存在 → NotFoundException
    const resource: object | null = { id }; // 模拟查找
    if (!resource) {
      throw new NotFoundException({
        code: 40401,
        message: `资源 ${id} 不存在`,
        resource: 'user',
      });
    }
    return resource;
  }

  public async validateBusinessRule(input: string): Promise<void> {
    // 模式 2：业务规则校验失败 → BadRequestException
    if (input.length < 3) {
      throw new BadRequestException('用户名至少需要 3 个字符');
    }
    if (!/^[a-zA-Z0-9_]+$/.test(input)) {
      throw new BadRequestException('用户名只能包含字母、数字和下划线');
    }
  }

  public async checkPermission(
    userId: number,
    resourceId: number,
  ): Promise<void> {
    // 模式 3：权限不足 → ForbiddenException
    const isOwner: boolean = false; // 模拟权限检查
    if (!isOwner) {
      throw new NotFoundException('无权访问此资源，请检查资源是否存在'); // 不能泄露资源存在性
    }
  }

  // 模式 4：第三方服务调用失败 → 包装为友好异常
  public async callExternalApi(): Promise<object> {
    try {
      // const response = await fetch('https://api.example.com/data');
      // return response.json();
      return { data: 'ok' };
    } catch (error) {
      // 不要让第三方的错误直接暴露给前端
      throw new NotFoundException({
        code: 50301,
        message: '外部服务暂时不可用，请稍后重试',
      });
    }
  }
}

// ============================================================
// ❌ 常见错误 1：在 Service 里直接操作 res 对象
// ============================================================

/**
 * 【错误现象】Service 直接调用 res.status().json()，导致 Service 与 HTTP 层耦合
 * 【错误原因】破坏了分层架构，Service 无法在非 HTTP 场景（如 CLI、队列 Worker）中复用
 * 【正确写法】Service 只返回数据或抛出异常，响应格式化完全由 Controller/Interceptor/Filter 负责
 */

// ❌ 错误写法：
// @Injectable()
// class BadService {
//   getUser(id: string, res: Response) {
//     const user = findUser(id);
//     return res.status(200).json(user);  // Service 不应操作 res！
//   }
// }

// ✅ 正确写法：
// @Injectable()
// class GoodService {
//   getUser(id: string): User {
//     const user = findUser(id);
//     if (!user) throw new NotFoundException();
//     return user;  // 纯数据返回
//   }
// }

// ============================================================
// ❌ 常见错误 2：忘记处理异步异常
// ============================================================

/**
 * 【错误现象】异步操作失败但没有 await 或 .catch，异常被静默吞掉
 * 【错误原因】Promise 未被处理的 rejection 在 Node.js 中只触发 unhandledRejection 警告
 * 【正确写法】所有异步调用都要 await，或使用 .catch() 处理
 */

// ❌ 错误写法：
// async createUser(data: CreateUserDto) {
//   this.prisma.user.create({ data });  // 忘记 await！
//   return { success: true };  // 实际上用户可能创建失败
// }

// ✅ 正确写法：
// async createUser(data: CreateUserDto) {
//   const user = await this.prisma.user.create({ data });  // 必须 await
//   return user;
// }

// ============================================================
// ❌ 常见错误 3：业务逻辑泄露到 Controller
// ============================================================

/**
 * 【错误现象】Controller 中包含大量 if-else 业务判断
 * 【错误原因】Controller 只应负责路由分发和请求参数提取，业务逻辑应在 Service 中
 * 【正确写法】Controller 瘦身：只做参数提取 → 调用 Service → 返回结果
 */

// ❌ 错误写法（业务逻辑在 Controller 中）：
// @Controller('users')
// class FatController {
//   @Post()
//   async create(@Body() body) {
//     if (!body.email.includes('@')) { ... }  // 验证应在 DTO/Pipe 中
//     if (body.age < 18) { ... }              // 业务规则应在 Service 中
//     const user = await this.prisma.user.create({ data: body });  // 数据库操作应在 Service 中
//     return { code: 200, data: user };       // 响应包装应在 Interceptor 中
//   }
// }

// ✅ 正确写法（Controller 只做分发）：
// @Controller('users')
// class SlimController {
//   constructor(private readonly userService: UsersService_05) {}
//
//   @Post()
//   async create(@Body() dto: CreateUserDto) {
//     return this.userService.register(dto.email, dto.name, dto.password);
//   }
// }

console.log('=== 第 05 章示例代码结束 ===');

// ============================================================
// 本章小结
// ============================================================
/*
 * 【核心要点】
 *   - Service 类应包含纯业务逻辑，不依赖 HTTP 上下文
 *   - 跨服务调用通过 DI 注入，不要直接 new
 *   - 使用 Drizzle 的 db.transaction() 封装数据库事务
 *   - 数据映射：数据库模型 → DTO → VO，每层保持独立类型
 *   - Service 抛出语义化异常，由上层统一处理
 *   - Controller 瘦身：只做路由分发和参数提取
 *
 * 【与前后章的关联】
 *   - 第 04 章：Service 通过 @Injectable() 注册为 Provider，由 DI 容器管理
 *   - 第 06 章：DTO 定义数据形状，Service 的输入类型由 DTO 保证
 *   - 第 12 章：DrizzleService 就是本章设计的典型 Service 实现
 *
 * 【常见面试题】
 *   Q: NestJS 中 Controller 和 Service 的职责如何划分？
 *   A: Controller 负责 HTTP 层（路由、参数提取、状态码），
 *      Service 负责业务逻辑层（数据验证、业务规则、数据库操作）。
 *      这样 Controller 可替换（如切换 REST → GraphQL），Service 完全不变。
 *
 *   Q: 如何处理跨多个表的事务操作？
 *   A: 使用 Drizzle 的 db.transaction() 方法，在回调中执行所有操作，
 *      任何一步失败都会自动回滚。事务逻辑应封装在 Service 方法中。
 */

// ============================================================
// 🎯 通关检查清单
// ============================================================
/*
 * [ ] 能写出纯业务逻辑的 Service 类（不依赖 HTTP 上下文）
 * [ ] 能使用 DI 注入其他 Service 而非直接 new
 * [ ] 能编写 Drizzle 事务并封装在 Service 方法中
 * [ ] 能完成 数据库模型 → DTO → VO 的数据映射
 * [ ] 能指出 1 个常见错误及修复方法
 */
