import { Injectable, OnModuleInit, OnModuleDestroy, Logger } from "@nestjs/common";
import { PrismaClient } from "@prisma/client";

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PrismaService.name);

  constructor() {
    super({ log: [{ emit: "stdout", level: "warn" }, { emit: "stdout", level: "error" }] });
  }

  async onModuleInit() {
    this.logger.log("连接 PostgreSQL...");
    await this.$connect();
    this.logger.log("PostgreSQL 已连接");
  }

  async onModuleDestroy() {
    await this.$disconnect();
    this.logger.log("PostgreSQL 连接已关闭");
  }
}
