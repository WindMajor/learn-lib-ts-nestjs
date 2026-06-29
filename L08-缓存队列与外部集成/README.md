# Level 08：缓存、队列与外部集成

> **通关标准**：能使用 Redis 缓存减少数据库查询，能使用 Bull 队列异步处理耗时任务，能使用定时任务执行周期性工作。

---

## 核心概念

| 概念 | 说明 | 对比 |
|------|------|------|
| `@nestjs/cache-manager` | NestJS 缓存模块——支持 Redis/memcached/内存 | Spring Cache Abstraction |
| `CacheInterceptor` | 自动缓存 Controller 响应 | Spring 的 `@Cacheable` |
| `@nestjs/bull` + `@Processor` | Bull 队列——异步任务处理 | Spring 的 `@Async` + RabbitMQ |
| `@nestjs/schedule` + `@Cron` | 定时任务——周期性执行 | Spring `@Scheduled`、Go `robfig/cron` |
| `@nestjs/event-emitter` | 进程内事件总线——解耦模块 | Go 的 channel、 Spring 的 ApplicationEvent |

---

## 缓存策略

```typescript
// 方式 1: 自动缓存（拦截器）
@UseInterceptors(CacheInterceptor)
@Get()
findAll() { return this.svc.findAll(); }  // 第二次请求命中缓存

// 方式 2: 手动缓存
@Inject(CACHE_MANAGER) private cacheManager: Cache;
await this.cacheManager.set('key', data, 60000); // TTL 60秒
const cached = await this.cacheManager.get('key');
```

## Bull 队列示例

```typescript
// 注入队列
@InjectQueue('report') private reportQueue: Queue;
// 添加任务
await this.reportQueue.add('generate', { reportId: 1 });
// 处理任务
@Processor('report')
class ReportProcessor {
  @Process('generate')
  async handleGenerate(job: Job) { /* 耗时操作 */ }
}
```

## 定时任务

```typescript
@Cron('0 0 * * * *') // 每小时执行
handleCron() { this.logger.log('定时任务执行'); }

@Interval(10000) // 每 10 秒
handleInterval() { /* ... */ }
```

## 对比要点

- **vs Spring**: NestJS 的 Cache/Bull/Schedule 生态接近 Spring 的 Cache/Async/Scheduled，但依赖社区包而非 Spring 全家桶
- **vs Go**: Go 的 `robfig/cron` 比 NestJS 的 ScheduleModule 更轻量——Go 直接 import 库，NestJS 需要 Module 注册
- **vs Rust**: Rust 的 `tokio-cron-scheduler` 同样简单直接，不需要 IoC 容器包装
