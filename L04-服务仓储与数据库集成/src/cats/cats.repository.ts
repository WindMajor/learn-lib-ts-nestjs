import { Injectable, Logger } from "@nestjs/common";
import { eq, isNull, isNotNull, desc } from "drizzle-orm";
import { DrizzleService } from "../db/drizzle.service";
import { cats, catOnUsers } from "../db/schema";

/**
 * WHAT: CatsRepository——数据访问层（Drizzle ORM 版本）
 *
 * 【Drizzle API 关键差异】
 *   Prisma: prisma.cat.findMany({ where: { deletedAt: null } })
 *   Drizzle: db.select().from(cats).where(isNull(cats.deletedAt))
 *
 *   Drizzle 更接近原生 SQL——select/from/where/orderBy 链式调用
 *   而没有 Prisma 的嵌套对象查询语法。
 *
 * 【操作符对比】
 *   Prisma          Drizzle
 *   { name: "Mimi" }  → eq(cats.name, "Mimi")
 *   { not: null }     → isNotNull(cats.deletedAt)
 *   { deletedAt: null } → isNull(cats.deletedAt)
 *   orderBy: { createdAt: "desc" } → orderBy(desc(cats.createdAt))
 */

// WHAT: 类型别名——Drizzle 自动推导的 Row 类型
// WHY: 使用 InferSelectModel 获得完整的类型安全
type Cat = typeof cats.$inferSelect;

@Injectable()
export class CatsRepository {
  private readonly logger = new Logger(CatsRepository.name);

  constructor(private readonly drizzle: DrizzleService) {}

  // ====================================
  // 查询操作（自动过滤软删除记录）
  // ====================================
  async findAll(onlyActive = true): Promise<Cat[]> {
    this.logger.log(`查询猫列表 (onlyActive=${onlyActive})`);
    return this.drizzle.db
      .select()
      .from(cats)
      .where(onlyActive ? isNull(cats.deletedAt) : undefined)
      .orderBy(desc(cats.createdAt));
  }

  async findById(id: number): Promise<Cat | null> {
    const results = await this.drizzle.db
      .select()
      .from(cats)
      .where(eq(cats.id, id))
      .limit(1);
    return results[0] ?? null;
  }

  async findDeleted(): Promise<Cat[]> {
    return this.drizzle.db
      .select()
      .from(cats)
      .where(isNotNull(cats.deletedAt))
      .orderBy(desc(cats.deletedAt));
  }

  // ====================================
  // 写操作
  // ====================================
  async create(data: { name: string; age: number; breed: string }): Promise<Cat> {
    this.logger.log(`创建猫: ${data.name}`);
    const results = await this.drizzle.db
      .insert(cats)
      .values(data)
      .returning();
    return results[0];
  }

  async update(
    id: number,
    data: Partial<{ name: string; age: number; breed: string }>,
  ): Promise<Cat> {
    this.logger.log(`更新猫 id=${id}`);
    const results = await this.drizzle.db
      .update(cats)
      .set(data)
      .where(eq(cats.id, id))
      .returning();
    return results[0];
  }

  // ====================================
  // 软删除
  // ====================================
  async softDelete(id: number): Promise<Cat> {
    this.logger.log(`软删除猫 id=${id}`);
    const results = await this.drizzle.db
      .update(cats)
      .set({ deletedAt: new Date() })
      .where(eq(cats.id, id))
      .returning();
    return results[0];
  }

  async restore(id: number): Promise<Cat> {
    const results = await this.drizzle.db
      .update(cats)
      .set({ deletedAt: null })
      .where(eq(cats.id, id))
      .returning();
    return results[0];
  }

  // ====================================
  // 事务操作
  // ====================================
  async transferOwnership(
    catId: number,
    fromUserId: number,
    toUserId: number,
  ): Promise<void> {
    // Drizzle 事务语法：db.transaction(async (tx) => { ... })
    // 与 Prisma 的 $transaction 语法类似——都是回调模式
    await this.drizzle.db.transaction(async (tx) => {
      // 步骤 1: 删除旧关系
      await tx
        .delete(catOnUsers)
        .where(eq(catOnUsers.catId, catId));

      // 步骤 2: 创建新关系
      await tx
        .insert(catOnUsers)
        .values({ catId, userId: toUserId });
    });

    this.logger.log(
      `猫 id=${catId} 从用户 ${fromUserId} 转移给用户 ${toUserId}`,
    );
  }
}
