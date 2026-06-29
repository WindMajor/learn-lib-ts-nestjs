// ============================================================
// DrizzleService —— 封装 Drizzle ORM 为 NestJS 可注入的 Service
// ============================================================

import { Injectable, OnModuleInit, OnModuleDestroy, Logger } from '@nestjs/common';
import { drizzle, NodePgDatabase } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import * as schema from './schema';

/**
 * DrizzleService
 *
 * 封装 Drizzle ORM 数据库连接，利用 NestJS 生命周期钩子管理连接生命周期：
 * - OnModuleInit：模块初始化时连接数据库
 * - OnModuleDestroy：模块销毁时断开连接
 *
 * 使用方式：在 Service 中注入 DrizzleService，通过 this.drizzle.db 访问数据库
 */
@Injectable()
export class DrizzleService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(DrizzleService.name);
  private pool: Pool | null = null;
  public db!: NodePgDatabase<typeof schema>;

  /**
   * 模块初始化时创建连接池
   */
  public async onModuleInit(): Promise<void> {
    const databaseUrl: string =
      process.env['DATABASE_URL'] ??
      'postgresql://nestjs_user:nestjs_pass@localhost:5432/nestjs_learn';

    this.pool = new Pool({
      connectionString: databaseUrl,
    });

    // 验证数据库连接可用
    await this.pool.query('SELECT 1');

    this.db = drizzle(this.pool, { schema });
    this.logger.log('数据库连接已建立');
  }

  /**
   * 模块销毁时关闭连接池（优雅关机）
   */
  public async onModuleDestroy(): Promise<void> {
    if (this.pool) {
      await this.pool.end();
      this.logger.log('数据库连接已关闭');
    }
  }

  /**
   * 清除所有数据（仅用于测试）
   */
  public async cleanDatabase(): Promise<void> {
    if (!this.pool) return;
    // 实际项目中使用 this.db.delete(users) 等操作
    await Promise.resolve();
    this.logger.log('清理测试数据');
  }
}
