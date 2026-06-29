import { Module } from "@nestjs/common";
import { CacheModule } from "@nestjs/cache-manager";
import { ScheduleModule } from "@nestjs/schedule";
import { EventEmitterModule } from "@nestjs/event-emitter";
import { BullModule } from "@nestjs/bull";
import { redisStore } from "cache-manager-redis-yet";
import { CatsModule } from "./cats/cats.module";
import { QueueModule } from "./queue/queue.module";
import { EventsModule } from "./events/events.module";
import { TasksService } from "./schedule/tasks.service";

@Module({
  imports: [
    // Redis 缓存（API 响应缓存）
    CacheModule.registerAsync({
      isGlobal: true,
      useFactory: async () => ({
        store: await redisStore({
          url: process.env.REDIS_URL || "redis://:redis_pass@localhost:6379",
        }),
        ttl: 30000, // 默认 TTL 30 秒
      }),
    }),

    // Bull 消息队列
    BullModule.forRootAsync({
      useFactory: () => ({
        redis: process.env.REDIS_URL || "redis://:redis_pass@localhost:6379",
      }),
    }),

    // 定时任务
    ScheduleModule.forRoot(),

    // 进程内事件总线
    EventEmitterModule.forRoot(),

    // 业务模块
    CatsModule,
    QueueModule,
    EventsModule,
  ],
  providers: [TasksService],
})
export class AppModule {}
