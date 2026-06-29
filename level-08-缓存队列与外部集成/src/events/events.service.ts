import { Injectable, Logger } from "@nestjs/common";
import { OnEvent } from "@nestjs/event-emitter";

/**
 * WHAT: EventsService——监听并响应进程内事件
 *
 * 【核心原理——@OnEvent 装饰器】
 *   @OnEvent('cat.created') → 当 'cat.created' 事件被发射时自动调用
 *
 *   事件流：
 *   CatsController.create()
 *     → eventEmitter.emit('cat.created', cat)
 *       → @OnEvent('cat.created') handleCatCreated(cat)
 *
 * 【使用场景】
 *   - 解耦模块：创建用户后 → 发送欢迎邮件、初始化权限、记录审计日志
 *   - 多步骤通知：报表生成完成 → 更新缓存 + 发送通知 + 记录操作日志
 *
 * 【对比 Spring】
 *   @EventListener + ApplicationEventPublisher
 *   原理一致——Observer 模式的框架实现
 *
 * 【对比 Go】
 *   Go 的 channel 可以实现同样效果：
 *   eventCh := make(chan Event, 100)
 *   go func() { for e := range eventCh { handle(e) } }()
 *   但 NestJS 的 EventEmitter 更声明式——通过装饰器绑定监听器
 *
 * 【对比 Node.js EventEmitter】
 *   NestJS 的 @nestjs/event-emitter 底层就是 Node.js EventEmitter——
 *   但加了装饰器绑定 + DI 注入支持。
 */
@Injectable()
export class EventsService {
  private readonly logger = new Logger(EventsService.name);

  @OnEvent("cat.created")
  handleCatCreated(cat: { id: number; name: string }) {
    this.logger.log(`📢 事件: 新猫创建 → ${cat.name} (ID=${cat.id})`);
  }

  @OnEvent("report.queued")
  handleReportQueued(data: { jobId: string; reportId: number }) {
    this.logger.log(`📢 事件: 报表任务入队 → ID=${data.reportId}, Job=${data.jobId}`);
  }

  @OnEvent("report.generated")
  handleReportGenerated(data: { reportId: number; completedAt: string }) {
    this.logger.log(`📢 事件: 报表生成完成 → ID=${data.reportId}, 时间=${data.completedAt}`);
  }
}
