/**
 * ============================================================
 * 第 12 章：数据库集成（Drizzle ORM + PostgreSQL）
 * ============================================================
 *
 * 【学习目标】
 *   1. 掌握 DrizzleService 封装：drizzle-orm + pg Pool + 生命周期钩子
 *   2. 掌握 DrizzleService 作为全局 Provider 的注册方式
 *   3. 掌握 CRUD 操作：insert、select、update、delete
 *   4. 掌握事务：db.transaction() 交互式事务
 *   5. 掌握软删除：利用 deletedAt + 查询过滤
 *   6. 理解 Drizzle 迁移工作流
 *
 * 【与 Express/FastAPI/Spring/Django 的对比提示】
 *   - Express：通常手动写 SQL 或使用 Knex.js / Sequelize
 *   - FastAPI：SQLAlchemy + Alembic（迁移工具）与 Drizzle Kit 对应
 *   - Spring：JPA/Hibernate + Flyway — 概念上高度相似（ORM + 迁移）
 *   - Django：Django ORM + migrations — 与 Drizzle Kit 工作流相似
 *
 * 【与 Vue3 前端的协作关系】
 *   - Drizzle 自动推断的类型 = 前端 API 调用的返回类型基础
 *   - 可与前端共享 Drizzle 类型（通过 monorepo 导出 schema 类型）
 *   - Drizzle Studio = 后端的"管理后台"，查看数据用
 */

import {
  Injectable,
  Module,
  Global,
  OnModuleInit,
  OnModuleDestroy,
} from '@nestjs/common';

// ============================================================
// 示例 1：DrizzleService 封装
// ============================================================

/**
 * 【场景】封装 Drizzle ORM 为 NestJS 可注入的 Service
 * 【语法点】创建 pg Pool，通过 drizzle() 初始化，实现 OnModuleInit 和 OnModuleDestroy
 * 【NestJS 设计意图】利用生命周期钩子管理数据库连接的生命周期
 *                   OnModuleInit：模块初始化时连接数据库
 *                   OnModuleDestroy：模块销毁时断开连接
 * 【与 PostgreSQL 的衔接】Drizzle 在底层使用 pg 库连接 PostgreSQL，
 *                         生成的 SQL 质量高，支持事务和连接池
 */

// ---- 模拟 Drizzle 类型 ----
// 实际项目中：import { users, posts } from '../db/schema';
//            import { eq, like, and, or, desc, asc, count, sql } from 'drizzle-orm';

// 模拟 User 类型（实际由 Drizzle 从 schema 推断）
interface User_12 {
  id: number;
  email: string;
  name: string | null;
  password: string;
  role: 'USER' | 'EDITOR' | 'ADMIN';
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

// 模拟 Post 类型
interface Post_12 {
  id: number;
  title: string;
  content: string | null;
  published: boolean;
  viewCount: number;
  authorId: number;
  deletedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

// ---- 模拟 Drizzle 查询构建器 ----
// 实际项目使用 drizzle-orm 的真实 API

const eq = <T>(_col: unknown, _val: T) =>
  ({ _type: 'eq', _val }) as Record<string, unknown>;
const sql = (strings: TemplateStringsArray, ..._values: unknown[]) =>
  strings.join('?');

const mockDb = {
  // User CRUD
  query: {
    users: {
      findFirst: async (args: {
        where: (fields: Record<string, unknown>) => Record<string, unknown>;
      }): Promise<User_12 | null> => {
        console.log('[Drizzle] SELECT * FROM users WHERE ... LIMIT 1');
        return null;
      },
    },
  },
  select: (fields?: Record<string, unknown>) => ({
    from: <T>(table: T) => ({
      where: (_condition: Record<string, unknown>) => ({
        limit: (_n: number) => ({
          offset: (_n: number) => ({
            orderBy: (_fn: unknown) => Promise.resolve([] as User_12[]),
          }),
        }),
        orderBy: (_fn: unknown) => Promise.resolve([] as User_12[]),
      }),
    }),
  }),
  insert: <T>(_table: T) => ({
    values: (_data: Partial<User_12>) => ({
      returning: () => Promise.resolve({ id: 1 } as User_12),
    }),
  }),
  update: <T>(_table: T) => ({
    set: (_data: Partial<User_12>) => ({
      where: (_condition: Record<string, unknown>) => ({
        returning: () => Promise.resolve({ id: 1 } as User_12),
      }),
    }),
  }),
  delete: <T>(_table: T) => ({
    where: (_condition: Record<string, unknown>) => ({
      returning: () => Promise.resolve({ id: 1 } as User_12),
    }),
  }),
  $count: async (
    _table: Record<string, unknown>,
    _condition?: Record<string, unknown>,
  ) => 0,
  transaction: async <T>(fn: (tx: typeof mockDb) => Promise<T>): Promise<T> => {
    console.log('[Drizzle] 开始事务');
    const result = await fn(mockDb);
    console.log('[Drizzle] 事务提交');
    return result;
  },
  connect: async () => {
    console.log('[Drizzle] 连接数据库');
  },
  disconnect: async () => {
    console.log('[Drizzle] 断开数据库连接');
  },
};

// ---- DrizzleService 封装 ----
@Injectable()
class DrizzleService implements OnModuleInit, OnModuleDestroy {
  public db = mockDb;

  /**
   * 模块初始化时连接数据库
   * NestJS 生命周期钩子：在模块的 Provider 实例化后调用
   */
  public async onModuleInit(): Promise<void> {
    // 实际项目：
    // const pool = new Pool({ connectionString: process.env.DATABASE_URL });
    // this.db = drizzle(pool, { schema });
    await mockDb.connect();
    console.log('[DrizzleService] 数据库连接已建立');
  }

  /**
   * 模块销毁时断开连接
   * 优雅关机：等待当前请求完成后再断开连接
   */
  public async onModuleDestroy(): Promise<void> {
    // 实际项目：await this.pool.end();
    await mockDb.disconnect();
    console.log('[DrizzleService] 数据库连接已关闭');
  }

  /**
   * 清除所有数据（仅用于测试）
   */
  public async cleanDatabase(): Promise<void> {
    // 实际项目：await this.db.delete(users);
    console.log('[DrizzleService] 清理测试数据');
  }
}

// ============================================================
// 示例 2：DrizzleModule —— 全局注册
// ============================================================

/**
 * 【场景】将 DrizzleService 注册为全局 Provider
 * 【语法点】@Global() + exports: [DrizzleService]
 * 【NestJS 设计意图】数据库连接是基础设施，所有模块都需要，
 *                   注册为全局模块避免在每个子模块中 imports
 */
@Global()
@Module({
  providers: [DrizzleService],
  exports: [DrizzleService],
})
class DrizzleModule_12 {}

// 在 AppModule 中导入一次，全局可用
// @Module({
//   imports: [DrizzleModule],
// })
// class AppModule {}

// ============================================================
// 示例 3：CRUD 操作完整示例
// ============================================================

/**
 * 【场景】在 Service 中使用 DrizzleService 进行完整的 CRUD 操作
 * 【语法点】Drizzle 的查询 API：insert/select/update/delete + where 条件
 * 【NestJS 设计意图】Service 不写 SQL，通过类型安全的 Drizzle API 操作数据库
 */

// 模拟 bcryptjs 用于密码哈希
const bcrypt = {
  hash: async (password: string, _rounds: number): Promise<string> => {
    return `hashed_${password}`;
  },
  compare: async (password: string, hash: string): Promise<boolean> => {
    return hash === `hashed_${password}`;
  },
};

@Injectable()
class UserService_12 {
  constructor(private readonly drizzle: DrizzleService) {}

  // CREATE：创建用户
  public async create(data: {
    email: string;
    name: string;
    password: string;
  }): Promise<User_12> {
    const hashedPassword: string = await bcrypt.hash(data.password, 10);
    // 实际项目：
    // const [user] = await this.drizzle.db.insert(users).values({
    //   email: data.email,
    //   name: data.name,
    //   password: hashedPassword,
    // }).returning();
    // return user;
    return this.drizzle.db
      .insert(null)
      .values({
        email: data.email,
        name: data.name,
        password: hashedPassword,
      })
      .returning();
  }

  // READ（单个）：按 ID 查找
  public async findById(id: number): Promise<User_12 | null> {
    // 实际项目：
    // return this.drizzle.db.query.users.findFirst({
    //   where: (users, { eq }) => eq(users.id, id),
    // });
    return this.drizzle.db.query.users.findFirst({
      where: () => eq(null, id),
    });
  }

  // READ（列表）：分页 + 条件过滤 + 排序
  public async findMany(params: {
    page?: number;
    limit?: number;
    isActive?: boolean;
    role?: 'USER' | 'EDITOR' | 'ADMIN';
  }): Promise<{ items: User_12[]; total: number }> {
    const page: number = params.page ?? 1;
    const limit: number = params.limit ?? 10;

    // 实际项目使用 drizzle-zod 或其他方式构建条件查询
    console.log(`[Drizzle] 分页查询: page=${page}, limit=${limit}`);

    const items: User_12[] = [];
    const total: number = 0;

    return { items, total };
  }

  // UPDATE：更新用户
  public async update(
    id: number,
    data: { name?: string; email?: string },
  ): Promise<User_12> {
    // 实际项目：
    // const [user] = await this.drizzle.db.update(users)
    //   .set(data)
    //   .where(eq(users.id, id))
    //   .returning();
    // return user;
    void data;
    return this.drizzle.db.update(null).set({}).where(eq(null, id)).returning();
  }

  // DELETE：物理删除（实际项目建议使用软删除，见示例 5）
  public async delete(id: number): Promise<User_12> {
    // 实际项目：
    // const [user] = await this.drizzle.db.delete(users)
    //   .where(eq(users.id, id))
    //   .returning();
    // return user;
    return this.drizzle.db.delete(null).where(eq(null, id)).returning();
  }
}

// ============================================================
// 示例 4：事务操作 —— 创建文章并更新用户统计
// ============================================================

/**
 * 【场景】创建文章 + 更新用户的文章计数必须原子执行
 * 【语法点】db.transaction(async (tx) => {...}) 交互式事务
 * 【NestJS 设计意图】事务确保数据一致性，是 Service 层的重要职责
 *
 * Drizzle 事务 vs Prisma 事务：
 * - Drizzle：db.transaction(async (tx) => { await tx.insert(...).values(...); await tx.update(...); })
 * - 概念完全一致，都是交互式事务（在回调中使用事务对象操作）
 */

@Injectable()
class PostService_12 {
  constructor(private readonly drizzle: DrizzleService) {}

  public async createPostWithTransaction(
    userId: number,
    title: string,
    content: string,
  ): Promise<Post_12> {
    // 使用 Drizzle 交互式事务
    const post = await this.drizzle.db.transaction(async (tx) => {
      // 实际项目：
      // const [newPost] = await tx.insert(posts).values({
      //   title,
      //   content,
      //   published: false,
      //   authorId: userId,
      // }).returning();
      const [newPost] = await tx
        .insert(null)
        .values({
          title,
          content,
          published: false,
          authorId: userId,
        })
        .returning();

      // 假设有一个 userStats 表更新文章计数
      // await tx.update(userStats).set({ postCount: sql`post_count + 1` }).where(...);

      return newPost;
    });

    return post;
  }

  // 如果事务中任何一步失败，所有操作自动回滚
  public async transferPostOwnership(
    postId: number,
    toUserId: number,
  ): Promise<void> {
    await this.drizzle.db.transaction(async (tx) => {
      // 1. 验证文章存在
      // const post = await tx.select().from(posts).where(eq(posts.id, postId)).limit(1);
      // 2. 转移所有权
      // await tx.update(posts).set({ authorId: toUserId }).where(eq(posts.id, postId));
      // 3. 发送通知（如果需要）
      console.log(`[Drizzle] 转移文章 ${postId} 所有权给用户 ${toUserId}`);
    });
  }
}

// ============================================================
// 示例 5：软删除 —— deletedAt + 查询过滤
// ============================================================

/**
 * 【场景】删除文章不物理删除，而是设置 deletedAt 时间戳
 *        所有查询自动排除已删除的记录
 * 【语法点】在查询时添加 deletedAt IS NULL 条件（Drizzle 方式）
 * 【NestJS 设计意图】软删除是业务需求，通过在 Repository 层统一封装过滤条件实现
 *
 * 与 Prisma 的区别：
 * - Prisma：使用 $use 中间件全局注入过滤条件
 * - Drizzle：在 Repository 方法中显式添加 where 条件（更直观，但需手动添加）
 */

@Injectable()
class SoftDeleteService {
  constructor(private readonly drizzle: DrizzleService) {}

  /**
   * Drizzle 不使用中间件，通过在查询中显式添加 deletedAt: null 条件实现软删除过滤。
   * 推荐做法：在 Repository 基类或 helper 函数中封装通用软删除过滤条件。
   *
   * // 封装软删除过滤 helper
   * function notDeleted() {
   *   return isNull(posts.deletedAt);
   * }
   *
   * // 使用：
   * await db.select().from(posts).where(and(eq(posts.authorId, 1), notDeleted()));
   */
  public getSoftDeleteGuide(): void {
    console.log(
      '[SoftDelete] Drizzle 软删除策略：在查询中显式添加 deletedAt IS NULL 条件',
    );
  }

  /**
   * 软删除：设置 deletedAt 而非物理删除
   */
  public async softDelete(postId: number): Promise<Post_12> {
    // 实际项目：
    // const [post] = await this.drizzle.db.update(posts)
    //   .set({ deletedAt: new Date() })
    //   .where(eq(posts.id, postId))
    //   .returning();
    // return post;
    return this.drizzle.db
      .update(null)
      .set({ deletedAt: new Date() })
      .where(eq(null, postId))
      .returning();
  }

  /**
   * 恢复已删除的文章
   */
  public async restore(postId: number): Promise<Post_12> {
    // 实际项目：
    // return this.drizzle.db.update(posts)
    //   .set({ deletedAt: null })
    //   .where(eq(posts.id, postId))
    //   .returning();
    return this.drizzle.db
      .update(null)
      .set({ deletedAt: null })
      .where(eq(null, postId))
      .returning();
  }

  /**
   * 物理删除（彻底清除，如 GDPR 合规需求）
   */
  public async hardDelete(postId: number): Promise<Post_12> {
    // 实际项目：
    // return this.drizzle.db.delete(posts).where(eq(posts.id, postId)).returning();
    return this.drizzle.db.delete(null).where(eq(null, postId)).returning();
  }
}

// ============================================================
// 示例 6：复杂查询 —— 关联查询、聚合、条件过滤
// ============================================================

/**
 * 【场景】查询文章及其作者信息、按条件聚合统计
 * 【语法点】Drizzle Relations API（关联查询）、select、where（高级过滤）
 * 【NestJS 设计意图】Drizzle 是类型安全的 SQL Builder，
 *                   比写原生 SQL 更安全，比 ORM HQL 更接近 SQL 思维
 *
 * Drizzle 关联查询方式：
 * 1. Drizzle Relations（定义 relations，用 with: 查询）
 * 2. 手动 JOIN（更灵活，写法接近原生 SQL）
 */

@Injectable()
class ComplexQueryService {
  constructor(private readonly drizzle: DrizzleService) {}

  // 关联查询：使用 Drizzle Relations API
  public async getPostsWithAuthors(): Promise<
    Array<Post_12 & { author: User_12 }>
  > {
    // 实际项目使用 Drizzle Relations：
    // 1. 在 schema.ts 中定义 relations：
    //    export const postsRelations = relations(posts, ({ one }) => ({
    //      author: one(users, { fields: [posts.authorId], references: [users.id] }),
    //    }));
    // 2. 查询时使用 with：
    //    return this.drizzle.db.query.posts.findMany({
    //      where: isNull(posts.deletedAt),
    //      with: { author: true },
    //      orderBy: desc(posts.createdAt),
    //    });
    console.log(
      '[Drizzle] 关联查询：SELECT posts.*, users.* FROM posts JOIN users ON ...',
    );
    return [] as Array<Post_12 & { author: User_12 }>;
  }

  // select 字段选择：只取需要的字段（减少数据传输）
  public async getPostsSummary(): Promise<
    Array<{ id: number; title: string; viewCount: number }>
  > {
    // 实际项目：
    // return this.drizzle.db.select({
    //   id: posts.id,
    //   title: posts.title,
    //   viewCount: posts.viewCount,
    // }).from(posts).where(isNull(posts.deletedAt));
    console.log('[Drizzle] SELECT id, title, view_count FROM posts');
    return [];
  }

  // 高级过滤：组合条件
  public async searchPosts(params: {
    keyword?: string;
    authorId?: number;
    published?: boolean;
    startDate?: Date;
    endDate?: Date;
  }): Promise<Post_12[]> {
    // 实际项目使用 Drizzle 的 and/or/eq/like/gte/lte 运算符：
    // const conditions = [isNull(posts.deletedAt)];
    // if (params.keyword) conditions.push(or(like(posts.title, `%${keyword}%`), like(posts.content, `%${keyword}%`)));
    // if (params.authorId) conditions.push(eq(posts.authorId, authorId));
    // ...
    // return this.drizzle.db.select().from(posts).where(and(...conditions)).orderBy(desc(posts.createdAt));
    console.log(`[Drizzle] 高级搜索: ${JSON.stringify(params)}`);
    return [];
  }
}

// ============================================================
// 示例 7：Drizzle 迁移工作流
// ============================================================

/**
 * 【场景】数据库迁移的完整工作流
 * 【这不是可执行代码，而是命令指南】
 *
 * 工作流：
 *   1. 修改 src/db/schema.ts 中的表定义
 *   2. npx drizzle-kit generate
 *      → 生成迁移 SQL 文件（drizzle/migrations/）
 *   3. npx drizzle-kit migrate
 *      → 执行迁移，应用到数据库
 *   4. npx drizzle-kit studio
 *      → 打开可视化数据浏览器
 *   5. npx drizzle-kit push
 *      → 开发环境：直接推送 schema 到数据库（跳过迁移文件）
 *   6. npx drizzle-kit check
 *      → 检查 schema 与数据库是否一致
 *
 * 与 Prisma/TypeORM/JPA 的对比：
 *   - Drizzle Kit：schema.ts → drizzle-kit generate → migrate（两步工作流）
 *   - Prisma：schema.prisma → prisma migrate dev → generate
 *   - TypeORM：装饰器注解实体类 → synchronize（开发）/ migration（生产）
 *   - JPA/Hibernate：实体类 → ddl-auto（开发）/ Flyway（生产）
 */

// ============================================================
// ❌ 常见错误 1：Drizzle 迁移未执行
// ============================================================

/**
 * 【错误现象】启动报错：列不存在或表不存在
 * 【错误原因】修改 schema.ts 后忘记运行 npx drizzle-kit migrate
 * 【正确写法】每次修改 schema 后都要重新生成并执行迁移
 */

// ❌ 错误：
// 修改了 schema.ts 后直接运行应用
// → 数据库仍是旧结构，没有新的表/列

// ✅ 正确：
// npx drizzle-kit generate   # 生成迁移文件
// npx drizzle-kit migrate    # 执行迁移

// ============================================================
// ❌ 常见错误 2：连接池耗尽（未关闭连接）
// ============================================================

/**
 * 【错误现象】运行一段时间后：too many connections 或 timeout
 * 【错误原因】每次创建 Pool 但没有关闭连接
 * 【正确写法】Pool 应是单例，通过 OnModuleDestroy 关闭
 */

// ❌ 错误写法：
// class BadService {
//   async findUser(id: number) {
//     const pool = new Pool({ connectionString: '...' });
//     const db = drizzle(pool);
//     const user = await db.select().from(users).where(eq(users.id, id));
//     // 忘记 pool.end()  // 连接泄漏！
//     return user;
//   }
// }

// ✅ 正确写法：
// @Injectable()
// class GoodService {
//   constructor(private readonly drizzle: DrizzleService) {}  // 注入单例
//   async findUser(id: number) {
//     return this.drizzle.db.select().from(users).where(eq(users.id, id));
//   }
// }

// ============================================================
// ❌ 常见错误 3：事务中未处理异常导致部分提交
// ============================================================

/**
 * 【错误现象】事务中的某些操作失败但数据库状态不一致
 * 【错误原因】事务回调中捕获了异常但没有重新抛出
 * 【正确写法】事务内不要 try-catch，让异常传播到 transaction() 自动回滚
 */

// ❌ 错误写法：
// await db.transaction(async (tx) => {
//   try {
//     await tx.insert(users).values({ ... });
//   } catch (e) {
//     console.error(e);  // 异常被吞掉，事务不会回滚
//   }
// });

// ✅ 正确写法：
// await db.transaction(async (tx) => {
//   await tx.insert(users).values({ ... });  // 异常自然传播，触发回滚
// });

console.log('=== 第 12 章示例代码结束 ===');

// ============================================================
// 本章小结
// ============================================================
/*
 * 【核心要点】
 *   - DrizzleService 封装 drizzle-orm + pg Pool，实现 OnModuleInit/OnModuleDestroy
 *   - 注册为全局 Provider，所有 Service 通过 DI 注入使用
 *   - CRUD 操作通过类型安全的查询 API（insert、select、update、delete）
 *   - db.transaction() 确保批量操作的原子性
 *   - 软删除通过查询时显式添加 deletedAt 条件实现
 *   - 迁移工作流：修改 schema.ts → drizzle-kit generate → drizzle-kit migrate
 *
 * 【与前后章的关联】
 *   - 第 04 章：DrizzleService 作为 Provider 在 DI 容器中管理
 *   - 第 05 章：Service 中注入 DrizzleService 实现业务逻辑
 *   - 第 13 章：JWT 认证中的用户查询依赖本章的数据库集成
 *   - 第 20 章：综合实战将完整演示 Drizzle 的用户-文章建模
 *
 * 【常见面试题】
 *   Q: NestJS 中如何管理数据库连接的生命周期？
 *   A: 封装 DrizzleService，在 onModuleInit 中创建 pg Pool 并初始化 drizzle，
 *      在 onModuleDestroy 中关闭 pool，利用 NestJS 的生命周期钩子确保连接
 *      在模块初始化时建立、应用关闭时断开。
 *
 *   Q: Drizzle 的 transaction 与 Prisma 的 $transaction 有什么区别？
 *   A: 两者功能等价。Drizzle 使用 db.transaction(async (tx) => {...}) 的交互式事务，
 *      tx 对象在回调中代表事务上下文。Prisma 则支持批量事务 $transaction([...]) 和
 *      交互式事务两种模式。Drizzle 更贴近原生 SQL 事务语义。
 *
 *   Q: Drizzle 和 Prisma 的核心差异是什么？
 *   A:
 *      - Drizzle：SQL-like API，更接近原生 SQL 思维，零代码生成，schema 即 TypeScript 代码
 *      - Prisma：声明式 schema 文件，自动生成类型安全的 Client，Middleware 机制丰富
 *      - Drizzle 更轻量、bundle 更小；Prisma 功能更完善（Studio、Migration 体验更好）
 *      - 两者都是优秀的 TypeScript ORM，选择取决于团队偏好和项目需求
 */

// ============================================================
// 🎯 通关检查清单
// ============================================================
/*
 * [ ] 能封装一个完整的 DrizzleService（pg Pool + 生命周期钩子）
 * [ ] 能写出完整的 CRUD 操作（含分页和条件过滤）
 * [ ] 能编写事务代码（db.transaction()）
 * [ ] 能说出软删除的实现思路
 * [ ] 能指出 1 个常见错误及修复方法
 * [ ] 能对比 Drizzle 和 Prisma 的核心差异
 */
