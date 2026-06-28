import { Injectable, Logger } from "@nestjs/common";
import { PrismaService } from "../database/prisma.service";
import type { Cat, Prisma } from "@prisma/client";

/**
 * WHAT: CatsRepository——数据访问层，封装所有数据库操作
 *
 * 【核心原理——Repository 模式的价值】
 *   1. 隔离数据库细节：Service 不需要知道用的是 Prisma 还是 TypeORM
 *   2. 集中查询逻辑：软删除过滤、默认排序、分页 都沉淀在 Repository
 *   3. 可测试性：mock CatsRepository 比 mock PrismaClient 容易得多
 *   4. 复用性：不同 Service 可以共享同一个 Repository
 *
 * 【对比 Spring Data JPA】
 *   Spring 的 Repository 是接口 + 方法名约定（findByNameAndAge）:
 *     interface CatRepository extends JpaRepository<Cat, Long> {
 *       List<Cat> findByNameAndAge(String name, int age);
 *     }
 *   NestJS 的 Repository 是手写类——更灵活但不那么"魔法"
 *
 * 【对比 Go】
 *   Go 的 Repository 通常是一个 struct：
 *     type CatRepository struct { db *gorm.DB }
 *     func (r *CatRepository) FindAll() []Cat { ... }
 *   与 NestJS 的写法几乎一样——但 Go 没有 IoC 容器，需要手动创建
 *
 * WARNING: @Injectable() 必须加上——Repository 需要被 IoC 容器管理
 *   如果忘记 → "Nest can't resolve dependencies of the CatsService"
 */
@Injectable()
export class CatsRepository {
  private readonly logger = new Logger(CatsRepository.name);

  /**
   * WHAT: 构造函数注入 PrismaService
   * WHY: Repository 不直接实例化 PrismaClient，而是通过注入获得
   *   这样可以在测试中注入 mock PrismaService
   */
  constructor(private readonly prisma: PrismaService) {}

  // ====================================
  // 查询操作（自动过滤已软删除的记录）
  // ====================================

  /**
   * WHAT: 查询所有未删除的猫
   *
   * 【软删除的核心查询】
   *   deletedAt: null → 未被删除
   *   每次查询都加上这个条件——相当于"默认过滤已删除"
   *
   * 【对比 TypeORM】
   *   TypeORM 的 SoftDelete 自动在查询中添加 WHERE deleted_at IS NULL
   *   不需要手动写——但需要 @DeleteDateColumn() 装饰器
   *
   * 【对比 Spring JPA + Hibernate】
   *   @SQLDelete(sql = "UPDATE cats SET deleted_at = NOW() WHERE id = ?")
   *   @Where(clause = "deleted_at IS NULL")
   *   几乎一样的机制——都是"软删除 + 查询自动过滤"
   */
  async findAll(onlyActive = true): Promise<Cat[]> {
    this.logger.log(`查询猫列表 (onlyActive=${onlyActive})`);
    return this.prisma.cat.findMany({
      where: onlyActive ? { deletedAt: null } : {},
      orderBy: { createdAt: "desc" },
    });
  }

  /**
   * WHAT: 按 ID 查询——同时验证软删除状态
   */
  async findById(id: number): Promise<Cat | null> {
    return this.prisma.cat.findFirst({
      where: { id, deletedAt: null },
    });
  }

  /**
   * WHAT: 查询已删除的猫（用于审计/恢复）
   */
  async findDeleted(): Promise<Cat[]> {
    return this.prisma.cat.findMany({
      where: { deletedAt: { not: null } },
    });
  }

  // ====================================
  // 写操作
  // ====================================

  async create(data: Prisma.CatCreateInput): Promise<Cat> {
    this.logger.log(`创建猫: ${data.name}`);
    return this.prisma.cat.create({ data });
  }

  async update(id: number, data: Prisma.CatUpdateInput): Promise<Cat> {
    this.logger.log(`更新猫 id=${id}`);
    return this.prisma.cat.update({
      where: { id },
      data,
    });
  }

  // ====================================
  // 软删除
  // ====================================

  /**
   * WHAT: 软删除——设置 deletedAt 时间戳，而非物理删除
   *
   * WHY: 商业应用中几乎不物理删除：
   *   1. 审计合规——保留所有操作记录
   *   2. 误删恢复——用户可以"撤销"删除
   *   3. 关联数据保护——关联到被删记录的数据不会出错
   *
   * 【对比 Django】
   *   Django 不内建软删除，需要第三方库如 django-safedelete
   *
   * WARNING: 软删除后，所有查询需要加 deletedAt: null 条件
   *   如果某个查询忘记了这个条件 → 会查出"已删除"的数据
   *   → 这就是为什么查询逻辑要集中在 Repository 中！
   */
  async softDelete(id: number): Promise<Cat> {
    this.logger.log(`软删除猫 id=${id}`);
    return this.prisma.cat.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
  }

  /**
   * WHAT: 恢复已软删除的记录
   */
  async restore(id: number): Promise<Cat> {
    return this.prisma.cat.update({
      where: { id },
      data: { deletedAt: null },
    });
  }

  // ====================================
  // 事务操作
  // ====================================

  /**
   * WHAT: 事务示例——在两个操作之间保持原子性
   *
   * 【场景】把猫从一个用户转移到另一个用户
   *   1. 删除旧的 CatOnUser 关系
   *   2. 创建新的 CatOnUser 关系
   *   两步必须在同一个事务中——否则可能"删除了旧关系但新关系没创建成功"
   *
   * 【对比 Spring】
   *   @Transactional
   *   public void transferCat(int catId, int fromUserId, int toUserId) {
   *     catOnUserRepo.deleteByCatIdAndUserId(catId, fromUserId);
   *     catOnUserRepo.save(new CatOnUser(catId, toUserId));
   *   }
   *   Prisma 同样的逻辑但需要显式使用 tx 而非 this
   */
  async transferOwnership(
    catId: number,
    fromUserId: number,
    toUserId: number,
  ): Promise<void> {
    // WARNING: 必须使用 this.prisma.$transaction，
    // 不能用外部变量——因为需要事务内的 Client
    await this.prisma.$transaction(async (tx) => {
      // 步骤 1: 删除旧关系
      await tx.catOnUser.delete({
        where: { catId_userId: { catId, userId: fromUserId } },
      });

      // 步骤 2: 创建新关系
      await tx.catOnUser.create({
        data: { catId, userId: toUserId },
      });
    });

    this.logger.log(
      `猫 id=${catId} 从用户 ${fromUserId} 转移给用户 ${toUserId}`,
    );
  }
}
