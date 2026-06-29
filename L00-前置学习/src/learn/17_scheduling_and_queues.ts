/**
 * ============================================================
 * 第 17 章：定时任务与队列概念
 * ============================================================
 *
 * 【学习目标】
 *   1. 掌握 @Cron() 定时任务的配置
 *   2. 掌握 @Interval() 和 @Timeout() 的使用
 *   3. 理解动态定时任务的添加和删除
 *   4. 理解分布式定时任务的问题及分布式锁概念
 *   5. 了解 @nestjs/bull 队列的基本概念
 *
 * 【与 Express/FastAPI/Spring/Django 的对比提示】
 *   - Express：node-cron 或 bull（队列）
 *   - FastAPI：BackgroundTasks + Celery
 *   - Spring：@Scheduled 注解 + Spring Batch / Quartz
 *   - Django：Celery + django-celery-beat
 *
 * 【与 Vue3 前端的协作关系】
 *   - 定时任务 = 后端自动执行的后台任务，前端通过 API 查看执行状态/日志
 *   - 队列 = 异步处理耗时任务（如发邮件、生成报表），前端只需提交任务
 *   - 前端轮询 API 获取任务进度（配合 WebSocket 更好）
 */

import { Injectable, Logger } from '@nestjs/common';

// 模拟 @nestjs/schedule 的装饰器（实际使用需安装 @nestjs/schedule）
// 实际导入：import { Cron, Interval, Timeout } from '@nestjs/schedule';
const Cron = (
  cronExpr: string,
  _options?: { name?: string; timeZone?: string },
): MethodDecorator => {
  return (
    _target: object,
    propertyKey: string | symbol | undefined,
    _descriptor: PropertyDescriptor,
  ) => {
    console.log(
      `[Scheduler] 注册 Cron 任务: ${String(propertyKey)} (${cronExpr})`,
    );
  };
};
const Interval = (nameOrMs: string | number, ms?: number): MethodDecorator => {
  const intervalMs: number =
    typeof nameOrMs === 'number' ? nameOrMs : (ms ?? 0);
  return (
    _target: object,
    propertyKey: string | symbol | undefined,
    _descriptor: PropertyDescriptor,
  ) => {
    console.log(
      `[Scheduler] 注册 Interval 任务: ${String(propertyKey)} (${intervalMs}ms)`,
    );
  };
};
const Timeout = (nameOrMs: string | number, ms?: number): MethodDecorator => {
  const timeoutMs: number = typeof nameOrMs === 'number' ? nameOrMs : (ms ?? 0);
  return (
    _target: object,
    propertyKey: string | symbol | undefined,
    _descriptor: PropertyDescriptor,
  ) => {
    console.log(
      `[Scheduler] 注册 Timeout 任务: ${String(propertyKey)} (${timeoutMs}ms)`,
    );
  };
};

// ============================================================
// 示例 1：@Cron() 定时任务
// ============================================================

/**
 * 【场景】每天凌晨 2 点生成日报、每周一清理过期数据
 * 【语法点】@Cron('cronExpression') 定义定时执行
 * 【NestJS 设计意图】@nestjs/schedule 封装 node-cron，提供声明式定时任务
 *                   与 Spring @Scheduled 几乎一一对应
 */

@Injectable()
class ScheduledTasks {
  private readonly logger: Logger = new Logger(ScheduledTasks.name);

  /**
   * Cron 表达式格式：秒 分 时 日 月 星期
   * ┌───────────── 秒 (0-59)
   * │ ┌─────────── 分 (0-59)
   * │ │ ┌───────── 时 (0-23)
   * │ │ │ ┌─────── 日 (1-31)
   * │ │ │ │ ┌───── 月 (1-12)
   * │ │ │ │ │ ┌─── 星期 (0-7, 0 和 7 都是周日)
   * │ │ │ │ │ │
   * * * * * * *
   */

  // 每天凌晨 2:00，生成日报统计
  // 注意：@Cron() 默认使用 UTC 时区！
  @Cron('0 0 2 * * *', { name: 'dailyReport' })
  public async generateDailyReport(): Promise<void> {
    this.logger.log('开始生成每日报表...');
    // 实际逻辑：查询今天的文章数、用户注册数、访问量
    await this.simulateWork(2000);
    this.logger.log('每日报表生成完毕');
  }

  // 每小时第 30 分钟，同步缓存（如清理过期 Redis 键）
  @Cron('0 30 * * * *')
  public async syncCache(): Promise<void> {
    this.logger.log('同步缓存...');
  }

  // 每周一凌晨 3:00，清理 90 天前的软删除记录
  @Cron('0 0 3 * * 1', { name: 'weeklyCleanup' }) // 1 = 周一
  public async weeklyCleanUp(): Promise<void> {
    this.logger.log('开始清理过期数据...');
    // await this.db.delete(posts).where(isNotNull(posts.deletedAt));
    //   where: { deletedAt: { lt: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000) } },
    // });
    this.logger.log('过期数据清理完毕');
  }

  // 每分钟执行（仅用于调试/健康检查）
  @Cron('*/1 * * * *')
  public async heartbeat(): Promise<void> {
    // 不要在生产环境频繁输出日志
    // this.logger.debug('心跳检测...');
  }

  private async simulateWork(ms: number): Promise<void> {
    await new Promise<void>((resolve) => setTimeout(resolve, ms));
  }
}

// ============================================================
// 示例 2：@Interval() 和 @Timeout()
// ============================================================

/**
 * 【场景】需要简单间隔执行或延迟执行时使用
 * 【语法点】@Interval(ms) 固定间隔执行，@Timeout(ms) 延迟一次执行
 * 【NestJS 设计意图】@Interval 和 @Timeout 是 Cron 的简化版，
 *                   不需要记 Cron 表达式，适合简单场景
 */

@Injectable()
class IntervalTasks {
  private readonly logger: Logger = new Logger(IntervalTasks.name);

  // 每 30 秒执行一次缓存预热
  @Interval('cacheWarmUp', 30000) // 第一个参数是任务名称（用于后续取消）
  public warmUpCache(): void {
    this.logger.debug('预热缓存...');
  }

  // 每 5 分钟检查外部服务可用性
  @Interval(300000)
  public async checkExternalServiceHealth(): Promise<void> {
    this.logger.log('检查外部服务健康状态...');
  }

  // 应用启动 10 秒后执行一次初始化操作
  @Timeout('initialSetup', 10000)
  public async initialSetup(): Promise<void> {
    this.logger.log('应用启动后的初始化...');
    // 加载默认配置、预热数据库连接池等
  }

  // 延迟 5 分钟后自动解锁超时的数据
  @Timeout(300000)
  public async unlockStaleResources(): Promise<void> {
    this.logger.log('解锁超时资源...');
  }
}

// ============================================================
// 示例 3：动态定时任务（运行时添加/删除）
// ============================================================

/**
 * 【场景】用户自定义提醒时间，需要动态创建定时任务
 * 【语法点】注入 SchedulerRegistry，动态管理 CronJob
 * 【NestJS 设计意图】静态装饰器适合应用级定时任务，
 *                   动态注册适合用户级业务需求
 */

// 模拟 SchedulerRegistry
@Injectable()
class MockSchedulerRegistry {
  private readonly cronJobs: Map<string, { stop: () => void }> = new Map();

  public addCronJob(name: string, cronJob: { stop: () => void }): void {
    this.cronJobs.set(name, cronJob);
    console.log(`[Scheduler] 添加定时任务: ${name}`);
  }

  public deleteCronJob(name: string): void {
    this.cronJobs.delete(name);
    console.log(`[Scheduler] 删除定时任务: ${name}`);
  }

  public getCronJob(name: string): { stop: () => void } | undefined {
    return this.cronJobs.get(name);
  }

  public getCronJobs(): Map<string, { stop: () => void }> {
    return this.cronJobs;
  }
}

// 动态任务管理 Service
@Injectable()
class DynamicScheduleService {
  constructor(private readonly schedulerRegistry: MockSchedulerRegistry) {}

  /**
   * 为用户创建自定义提醒
   */
  public async createReminder(
    userId: number,
    remindAt: Date,
    message: string,
  ): Promise<void> {
    const jobName: string = `reminder:${userId}:${remindAt.getTime()}`;

    // 检查是否已存在同名任务
    if (this.schedulerRegistry.getCronJob(jobName)) {
      console.log(`[DynamicSchedule] 提醒已存在: ${jobName}`);
      return;
    }

    const now: Date = new Date();
    const delay: number = remindAt.getTime() - now.getTime();

    if (delay <= 0) {
      console.log(`[DynamicSchedule] 提醒时间已过: ${jobName}`);
      return;
    }

    // 创建一次性定时任务
    const timeout = setTimeout(async () => {
      console.log(`[DynamicSchedule] 触发提醒: ${userId} - ${message}`);
      // 发送推送通知
      await this.sendNotification(userId, message);
      // 执行完毕后删除
      this.schedulerRegistry.deleteCronJob(jobName);
    }, delay);

    this.schedulerRegistry.addCronJob(jobName, {
      stop: () => clearTimeout(timeout),
    });
  }

  /**
   * 取消提醒
   */
  public async cancelReminder(userId: number, remindAt: Date): Promise<void> {
    const jobName: string = `reminder:${userId}:${remindAt.getTime()}`;
    const job = this.schedulerRegistry.getCronJob(jobName);

    if (job) {
      job.stop();
      this.schedulerRegistry.deleteCronJob(jobName);
    }
  }

  /**
   * 获取所有活跃的定时任务（可用于管理后台展示）
   */
  public listAllJobs(): { name: string }[] {
    return Array.from(this.schedulerRegistry.getCronJobs().keys()).map(
      (name) => ({
        name,
      }),
    );
  }

  private async sendNotification(
    _userId: number,
    _message: string,
  ): Promise<void> {
    console.log(
      `[Notification] 发送通知: userId=${_userId}, message=${_message}`,
    );
  }
}

// ============================================================
// 示例 4：分布式定时任务问题
// ============================================================

/**
 * 【场景】多实例部署时，同一 Cron 任务会在每个实例上执行
 *        导致重复发送邮件、重复生成报表
 * 【解决方案】
 *   1. 分布式锁（Redis SETNX）—— 最常用
 *   2. 数据库行锁 —— 适合有 DB 的场景
 *   3. 使用 Bull Queue —— 天然支持分布式
 *   4. 外部调度器 —— 如 Kubernetes CronJob
 */

// 分布式锁示例（基于 Redis 的简化版）
@Injectable()
class DistributedLockService {
  private readonly locks: Map<string, { holder: string; expires: number }> =
    new Map();

  /**
   * 尝试获取锁
   * 实际使用 Redis：SET lock_key holder_value NX EX 30
   */
  public async acquireLock(
    lockKey: string,
    holder: string,
    ttlSeconds: number,
  ): Promise<boolean> {
    const existing = this.locks.get(lockKey);
    if (existing && existing.expires > Date.now()) {
      return false; // 锁被其他实例持有
    }
    this.locks.set(lockKey, {
      holder,
      expires: Date.now() + ttlSeconds * 1000,
    });
    return true;
  }

  /**
   * 释放锁（使用 Lua 脚本保证原子性）
   */
  public async releaseLock(lockKey: string, holder: string): Promise<void> {
    const existing = this.locks.get(lockKey);
    if (existing && existing.holder === holder) {
      this.locks.delete(lockKey);
    }
    // 只删除自己持有的锁
  }
}

// 使用分布式锁的定时任务
@Injectable()
class DistributedScheduledTask {
  constructor(private readonly lockService: DistributedLockService) {}

  @Cron('0 0 2 * * *')
  public async generateReportWithLock(): Promise<void> {
    const lockKey: string = 'schedule:dailyReport';
    const holder: string = `instance:${process.pid}`;

    const acquired: boolean = await this.lockService.acquireLock(
      lockKey,
      holder,
      300,
    );
    if (!acquired) {
      console.log('[DistributedScheduled] 其他实例正在执行日报任务，跳过');
      return;
    }

    try {
      console.log('[DistributedScheduled] 开始执行日报任务（获取锁成功）');
      // 执行任务...
    } finally {
      await this.lockService.releaseLock(lockKey, holder);
    }
  }
}

// ============================================================
// 示例 5：队列概念 —— Bull + Redis（简介）
// ============================================================

/**
 * 【场景】异步处理耗时任务（发送邮件、生成报表、图片处理）
 * 【为什么用队列】不要让用户等待非关键任务完成
 * 【Bull 队列架构】
 *   Producer（生产者）→ Redis（队列）→ Consumer（消费者）
 *
 * @nestjs/bull 的基本使用模式（注释，需安装 bull 和 @nestjs/bull）：
 *
 * // 注册队列模块
 * @Module({
 *   imports: [BullModule.registerQueue({ name: 'email' })],
 * })
 *
 * // 生产者（Controller/Service 中添加任务到队列）
 * constructor(@InjectQueue('email') private emailQueue: Queue) {}
 * await this.emailQueue.add('sendWelcome', { to: 'user@example.com', name: '张三' });
 *
 * // 消费者（Processor）
 * @Processor('email')
 * export class EmailProcessor {
 *   @Process('sendWelcome')
 *   async handleSendWelcome(job: Job<{ to: string; name: string }>) {
 *     await sendEmail(job.data.to, `欢迎 ${job.data.name}`, '...');
 *   }
 * }
 */

// ============================================================
// ❌ 常见错误 1：Cron 表达式格式错误
// ============================================================

/**
 * 【错误现象】定时任务不按预期时间执行
 * 【错误原因】Cron 表达式字段顺序或取值范围错误
 *            NestJS 的 @Cron() 使用 6 字段格式（秒 分 时 日 月 星期）
 *            而非 Linux 的 5 字段格式（分 时 日 月 星期）
 * 【正确写法】使用在线 Cron 验证工具确认表达式，
 *            推荐 crontab.guru
 */

// ❌ 错误写法：
// @Cron('0 2 * * *')       // 5 字段，NestJS 不认识！
// @Cron('60 * * * * *')    // 秒字段超出范围 (0-59)

// ✅ 正确写法：
// @Cron('0 0 2 * * *')     // 6 字段：每天 2:00:00
// @Cron('0 */15 * * * *')  // 每 15 分钟

// ============================================================
// ❌ 常见错误 2：定时任务阻塞主线程
// ============================================================

/**
 * 【错误现象】定时任务执行时整个应用变慢，HTTP 请求超时
 * 【错误原因】定时任务中执行 CPU 密集型同步操作，阻塞事件循环
 * 【正确写法】使用异步方法、Worker Threads 或外部队列系统
 */

// ❌ 错误写法（同步阻塞）：
// @Cron('0 * * * * *')
// handleTask() {
//   // 大量同步 JSON 解析、加密计算
//   const data = JSON.parse(hugeFile);
//   const encrypted = crypto.encrypt(data);  // 同步操作阻塞事件循环
// }

// ✅ 正确写法（使用异步队列）：
// @Cron('0 * * * * *')
// async handleTask() {
//   await this.queue.add('heavyTask', { data });
// }

// ============================================================
// ❌ 常见错误 3：时区问题（Cron 默认 UTC）
// ============================================================

/**
 * 【错误现象】设置凌晨 2 点执行，但实际是上午 10 点
 * 【错误原因】@Cron() 默认使用 UTC 时区
 * 【正确写法】使用 timeZone 选项指定时区
 */

// ❌ 错误写法（北京时间凌晨 2 点期望，但实际 UTC 凌晨 2 点 = 北京时间上午 10 点）：
// @Cron('0 0 2 * * *')

// ✅ 正确写法：
// @Cron('0 0 2 * * *', { timeZone: 'Asia/Shanghai' })  // 东八区凌晨 2 点

console.log('=== 第 17 章示例代码结束 ===');

// ============================================================
// 本章小结
// ============================================================
/*
 * 【核心要点】
 *   - @Cron() 使用 6 字段 Cron 表达式（秒 分 时 日 月 星期）
 *   - @Interval(ms) 固定间隔，@Timeout(ms) 延迟一次
 *   - 动态任务通过 SchedulerRegistry 运行时管理
 *   - 多实例部署需要分布式锁防止重复执行
 *   - Bull Queue（Redis）是异步任务处理的推荐方案
 *   - Cron 默认 UTC 时区，通过 timeZone 选项指定
 *
 * 【与前后章的关联】
 *   - 第 12 章：定时清理数据库中过期数据
 *   - 第 16 章：定时任务 + WebSocket = 定时推送通知
 *   - 第 19 章：微服务和队列的进阶方向
 *
 * 【常见面试题】
 *   Q: 多个实例部署时，如何防止 Cron 任务重复执行？
 *   A: 使用分布式锁（Redis SETNX）确保同一时刻只有一个实例执行；
 *      或使用 Bull Queue（基于 Redis）天然支持分布式调度；
 *      或使用 Kubernetes CronJob 在外部调度。
 *
 *   Q: Cron 和 Interval 的区别？
 *   A: Cron 基于绝对时间点（每天 2 点），Interval 基于相对间隔（每 30 秒）。
 *      Cron 适合日历相关任务，Interval 适合固定频率检查。
 *      Interval 不受应用启动时间影响，Cron 如果错过执行时间会立即执行。
 */
// ============================================================
// 🎯 通关检查清单
// ============================================================
/*
 * [ ] 能手写 3 种以上的 Cron 表达式
 * [ ] 能区分 @Cron、@Interval、@Timeout 的适用场景
 * [ ] 能解释分布式锁的原理和用途
 * [ ] 能说出 1 个与 Spring @Scheduled 的差异
 * [ ] 能指出 1 个常见错误及修复方法
 */
