import { Injectable, Logger } from "@nestjs/common";
import { Cron, CronExpression, Interval } from "@nestjs/schedule";

/**
 * WHAT: TasksService——定时任务演示
 *
 * 【核心原理——@Cron 和 @Interval】
 *   @Cron('*/30 * * * * *')  → 每 30 秒执行（cron 表达式）
 *   @Cron(CronExpression.EVERY_HOUR) → 每小时执行（预定义表达式）
 *   @Interval(10000)          → 每 10 秒执行（毫秒间隔）
 *
 *   Cron 表达式格式（6 位：秒 分 时 日 月 周）：
 *   ┌─────────── 秒 (0-59)
 *   │ ┌───────── 分 (0-59)
 *   │ │ ┌─────── 时 (0-23)
 *   │ │ │ ┌───── 日 (1-31)
 *   │ │ │ │ ┌─── 月 (1-12)
 *   │ │ │ │ │ ┌─ 周 (0-7, 0 和 7 都是周日)
 *   │ │ │ │ │ │
 *   * * * * * *
 *
 * 【对比 Spring】
 *   @Scheduled(cron = "0 */30 * * * *")  —— 5 位 cron
 *   @Cron('*/30 * * * * *')              —— 6 位 cron（多了秒）
 *
 * 【对比 Go (robfig/cron)】
 *   c := cron.New()
 *   c.AddFunc("@every 30s", func() { ... })
 *   c.Start()
 *   更轻量——不需要 Module 注册，直接 import 库即可
 *
 * 【对比 Rust (tokio-cron-scheduler)】
 *   let sched = JobScheduler::new().await;
 *   sched.add(Job::new("*/30 * * * * *", || { ... }));
 *   同样是函数式 API——不需要 IoC 容器包装
 */
@Injectable()
export class TasksService {
  private readonly logger = new Logger(TasksService.name);
  private onlineCount = 0;

  /**
   * 每 30 秒执行一次：在线用户统计
   */
  @Cron("*/30 * * * * *")
  handleOnlineStats() {
    this.onlineCount = Math.floor(Math.random() * 100) + 10;
    this.logger.log(`⏰ 定时任务: 当前在线用户数 = ${this.onlineCount}`);
  }

  /**
   * 每 10 秒执行一次：心跳日志
   */
  @Interval(10000)
  handleHeartbeat() {
    this.logger.debug(`💓 心跳——系统运行正常`);
  }
}
