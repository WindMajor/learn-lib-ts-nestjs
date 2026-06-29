// WHAT: DrizzleService——封装 Drizzle ORM + pg Pool，管理数据库连接生命周期
//
// 【核心原理——为什么需要封装？】
//   1. 生命周期管理：连接池必须正确 open/close
//      onModuleInit → 建立 pg Pool
//      onModuleDestroy → await pool.end() 释放所有连接
//   2. NestJS 集成：通过 @Injectable() 成为 Provider，可注入任何 Service
//   3. 可测试性：可以 mock DrizzleService
//
// 【对比 PrismaService（旧版）】
//   Prisma: extends PrismaClient，自动建立连接池
//   Drizzle: 手动创建 pg.Pool + drizzle(pool, { schema })
//   Drizzle 更底层——你需要理解 pg 连接池的工作方式
//
// 【对比 Go (GORM)】
//   Go: db, _ := gorm.Open(postgres.Open(dsn), &gorm.Config{})
//       sqlDB, _ := db.DB()
//       defer sqlDB.Close()
//   Drizzle 类似——有底层 pg Pool 和上层 Drizzle 实例两层

import { Injectable, OnModuleInit, OnModuleDestroy, Logger } from '@nestjs/common';
import { Pool } from 'pg';
import { drizzle, NodePgDatabase } from 'drizzle-orm/node-postgres';
import * as schema from './schema';

@Injectable()
export class DrizzleService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(DrizzleService.name);

  // WHAT: 暴露 Drizzle 实例给 Repository 使用
  // WHY: public readonly → Repository 通过 this.drizzle.{table} 操作数据库
  public db!: NodePgDatabase<typeof schema>;

  private pool!: Pool;

  constructor() {
    // Pool 在 onModuleInit 中创建（异步）
  }

  async onModuleInit() {
    this.logger.log('正在建立 PostgreSQL 连接池...');
    this.pool = new Pool({
      connectionString: process.env.DATABASE_URL ?? 'postgresql://nestjs_user:nestjs_pass@localhost:5432/nestjs_learn?schema=public',
    });
    this.db = drizzle(this.pool, { schema });
    this.logger.log('PostgreSQL 连接池已建立（Drizzle ORM）');
  }

  async onModuleDestroy() {
    this.logger.log('正在关闭 PostgreSQL 连接池...');
    if (this.pool) {
      await this.pool.end();
      this.logger.log('PostgreSQL 连接池已关闭');
    }
  }

  /**
   * WHAT: 事务辅助方法——封装 Drizzle 的事务 API
   *
   * 【Drizzle 事务语法】
   *   await db.transaction(async (tx) => {
   *     await tx.insert(cats).values({...});
   *     await tx.update(users).set({...}).where(...);
   *   });
   *   与 Prisma 的 $transaction 语法类似——都是回调模式
   *
   * 【对比 Prisma】
   *   Prisma: prisma.$transaction(async (tx) => { await tx.cat.create(...) })
   *   Drizzle: db.transaction(async (tx) => { await tx.insert(cats).values(...) })
   *   语法不同但概念一致——事务内的所有操作共享同一个数据库连接
   */
  async withTransaction<T>(
    fn: (tx: NodePgDatabase<typeof schema>) => Promise<T>,
  ): Promise<T> {
    return this.db.transaction(async (tx) => fn(tx));
  }
}
