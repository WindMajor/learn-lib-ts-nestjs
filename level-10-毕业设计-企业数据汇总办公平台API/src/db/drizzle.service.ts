import { Injectable, OnModuleInit, OnModuleDestroy, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Pool } from 'pg';
import { drizzle, NodePgDatabase } from 'drizzle-orm/node-postgres';
import * as schema from './schema';

@Injectable()
export class DrizzleService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(DrizzleService.name);
  public db!: NodePgDatabase<typeof schema>;
  private pool!: Pool;

  constructor(private readonly config: ConfigService) {}

  async onModuleInit() {
    this.logger.log('建立 PostgreSQL 连接池...');
    this.pool = new Pool({
      connectionString: this.config.get('database.url'),
    });
    this.db = drizzle(this.pool, { schema });
    this.logger.log('PostgreSQL 连接池已建立');
  }

  async onModuleDestroy() {
    if (this.pool) {
      await this.pool.end();
      this.logger.log('PostgreSQL 连接池已关闭');
    }
  }
}
