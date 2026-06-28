import {
  Injectable,
  OnModuleInit,
  OnModuleDestroy,
  Logger,
} from "@nestjs/common";
import { PrismaClient } from "@prisma/client";

/**
 * WHAT: PrismaService——封装 PrismaClient，管理数据库连接生命周期
 *
 * 【核心原理——为什么需要封装 PrismaClient？】
 *   1. 生命周期管理：PrismaClient 使用连接池，必须正确关闭
 *      onModuleInit → $connect()（建立连接池）
 *      onModuleDestroy → $disconnect()（释放连接池）
 *   2. NestJS 集成：通过 @Injectable() 成为 NestJS Provider，可被注入
 *   3. 可测试性：可以 mock PrismaService 做单元测试
 *
 * 【对比 TypeORM】
 *   TypeORM 用 DataSource 管理连接：
 *   @Module({ imports: [TypeOrmModule.forRoot({...})] })
 *   绑定在 NestJS 模块层面，生命周期由 TypeOrmModule 管理。
 *   用 Prisma 需要手动管理——更灵活但需要显式处理生命周期。
 *
 * 【对比 Spring Boot + JPA】
 *   Spring 的 EntityManager 由 Spring 容器管理生命周期。
 *   PrismaService 的 onModuleInit/Destroy 相当于 Spring 的 @PostConstruct/@PreDestroy。
 *
 * 【对比 Go + GORM】
 *   Go 通常手动管理 DB 连接：
 *   db, _ := gorm.Open(...)
 *   defer sqlDB.Close()  // 在 main() 中手动关闭
 *   不享受 IoC 容器的生命周期管理
 *
 * LIFECYCLE 执行顺序:
 *   constructor() → onModuleInit() → 服务可用 → onModuleDestroy()
 *
 * WARNING: 如果不实现 onModuleDestroy → 应用关闭时连接池不释放
 *   → Prisma 进程可能成为僵尸进程 → 数据库连接泄漏
 *   → 多次重启后达到 max_connections 限制 → 数据库拒绝连接
 */
@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  private readonly logger = new Logger(PrismaService.name);

  constructor() {
    // WHAT: 传递给 PrismaClient 的配置
    super({
      log: [
        { emit: "event", level: "query" }, // 记录所有 SQL 查询
        { emit: "stdout", level: "info" },
        { emit: "stdout", level: "warn" },
        { emit: "stdout", level: "error" },
      ],
    });
  }

  /**
   * LIFECYCLE: 模块初始化时调用——建立数据库连接池
   *
   * 【核心原理——为什么是 async？】
   *   PrismaClient 的 $connect() 是真正的网络 I/O（TCP 连接到 PostgreSQL）。
   *   如果不 await → 后续查询可能在连接建立前执行 → 报错 "Can't reach database server"
   *   NestJS 会自动等待 onModuleInit 返回的 Promise 完成。
   */
  async onModuleInit() {
    this.logger.log("正在连接 PostgreSQL...");
    await this.$connect();
    this.logger.log("PostgreSQL 连接池已建立");

    // 监听查询事件——输出 SQL 日志（生产环境应关闭，性能敏感）
    (this as any).$on("query" as never, (e: any) => {
      this.logger.debug(`SQL: ${e.query} | 耗时: ${e.duration}ms`);
    });
  }

  /**
   * LIFECYCLE: 模块销毁时调用——释放数据库连接池
   *
   * WARNING: 必须实现！否则优雅关闭时连接泄漏
   */
  async onModuleDestroy() {
    this.logger.log("正在关闭 PostgreSQL 连接池...");
    await this.$disconnect();
    this.logger.log("PostgreSQL 连接池已关闭");
  }

  /**
   * WHAT: 事务辅助方法——封装 Prisma 的交互式事务 API
   *
   * 【Prisma 事务的三种方式】
   *   1. 嵌套写: prisma.$transaction([prisma.cat.create(...), prisma.user.create(...)])
   *      — 简单但无法在事务内查询（不能依赖前一步的结果）
   *   2. 交互式: prisma.$transaction(async (tx) => { const cat = await tx.cat.create(...); ... })
   *      — 可以在事务内使用查询结果，类似"回调式事务"
   *   3. 批量: prisma.$transaction([...]) 的批量模式，内部优化为单次 SQL
   *
   *   本方法使用"交互式事务"——最灵活的模式。
   *
   * 【对比 Spring JPA】
   *   Spring: @Transactional 注解——声明式，自动回滚
   *   Prisma: 交互式回调——命令式，需要显式调用 tx.xxx
   *   差异：Spring 的声明式更简洁但"魔法"感强，Prisma 更显式
   *
   * 【对比 Go GORM】
   *   GORM: db.Transaction(func(tx *gorm.DB) error { ... })
   *   与 Prisma 的交互式事务几乎一样——都是回调模式
   *
   * WARNING:
   *   - 事务中的操作必须全部使用 tx 而非 this（全局 PrismaClient）
   *   - 如果回调抛出异常 → 自动回滚
   *   - 事务有超时限制（默认无限，建议设置 timeout）
   */
  async withTransaction<T>(
    fn: (tx: Omit<PrismaService, "withTransaction">) => Promise<T>,
  ): Promise<T> {
    return this.$transaction(async (tx) => {
      return fn(tx as any);
    });
  }
}
