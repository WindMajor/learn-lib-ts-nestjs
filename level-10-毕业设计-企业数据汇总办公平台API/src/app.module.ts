import { Module } from "@nestjs/common";
import { ConfigModule, ConfigService } from "@nestjs/config";
import { CacheModule } from "@nestjs/cache-manager";
import { redisStore } from "cache-manager-redis-yet";
import { ScheduleModule } from "@nestjs/schedule";
import { EventEmitterModule } from "@nestjs/event-emitter";
import { BullModule } from "@nestjs/bull";
import { PrismaModule } from "./database/prisma.module";
import { AuthModule } from "./auth/auth.module";
import { UserModule } from "./modules/users/user.module";
import { DepartmentModule } from "./modules/departments/department.module";
import { ReportModule } from "./modules/reports/report.module";
import { ApprovalModule } from "./modules/approvals/approval.module";
import { NotificationModule } from "./modules/notifications/notification.module";
import { DashboardModule } from "./modules/dashboard/dashboard.module";
import configuration from "./config/configuration";
import * as Joi from "joi";

@Module({
  imports: [
    // 配置管理
    ConfigModule.forRoot({
      isGlobal: true, load: [configuration], envFilePath: [".env"],
      validationSchema: Joi.object({
        NODE_ENV: Joi.string().valid("development", "production", "test").default("development"),
        PORT: Joi.number().default(3000),
        DATABASE_URL: Joi.string().required(),
        REDIS_URL: Joi.string().required(),
        JWT_SECRET: Joi.string().required().min(16),
      }),
    }),

    // Redis 缓存
    CacheModule.registerAsync({
      isGlobal: true,
      useFactory: async (cfg: ConfigService) => ({
        store: await redisStore({ url: cfg.get("REDIS_URL") }),
        ttl: 60000,
      }),
      inject: [ConfigService],
    }),

    // Bull 消息队列
    BullModule.forRootAsync({
      useFactory: (cfg: ConfigService) => ({
        redis: cfg.get("REDIS_URL"),
      }),
      inject: [ConfigService],
    }),

    // 定时任务 + 事件
    ScheduleModule.forRoot(),
    EventEmitterModule.forRoot(),

    // 业务模块
    PrismaModule,
    AuthModule,
    UserModule,
    DepartmentModule,
    ReportModule,
    ApprovalModule,
    NotificationModule,
    DashboardModule,
  ],
})
export class AppModule {}
