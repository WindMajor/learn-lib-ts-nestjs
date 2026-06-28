import { Injectable, Logger } from "@nestjs/common";
import { OnEvent } from "@nestjs/event-emitter";
import { NotificationService } from "./notification.service";

/**
 * WHAT: 事件监听器——响应审批事件，自动创建通知
 *
 * 【核心原理——OnEvent 装饰器】
 *   EventEmitter2 是 Node.js 的观察者模式实现。
 *   @OnEvent('approval.approved') 告诉 NestJS：
 *   "当有人 emit('approval.approved', payload) 时，调用这个方法"
 *
 *   这是一种发布/订阅模式的解耦方案：
 *   - 生产者（ApprovalService）只是 emit 事件
 *   - 消费者（本文件）订阅事件并创建通知
 *   - 双方不直接依赖——通过事件总线解耦
 *
 * 【对比 Spring】
 *   Spring 的 @EventListener 注解——几乎一样的机制
 *   @EventListener
 *   public void handleApproval(ApprovalEvent event) { ... }
 *
 * 【对比 Go】
 *   Go 通常用 channel 或消息队列（NATS/Kafka）实现事件
 *   channel 是进程内通信，卡夫卡是跨服务通信
 *   NestJS 的 EventEmitter 是进程内通信——类似 Go 的 channel
 */
@Injectable()
export class NotificationListener {
  private readonly logger = new Logger(NotificationListener.name);

  constructor(private readonly notificationService: NotificationService) {}

  @OnEvent("approval.approved")
  async handleApprovalApproved(payload: { approval: any; report: any }) {
    this.logger.log(`审批通过事件: 报表 #${payload.report.id}`);
    await this.notificationService.create({
      userId: payload.report.submitterId,
      title: "您的报表已通过审批",
      content: `报表"${payload.report.title}"已由审批人通过`,
      type: "APPROVAL_REMINDER",
      metadata: { reportId: payload.report.id, approvalId: payload.approval.id },
    });
  }

  @OnEvent("approval.rejected")
  async handleApprovalRejected(payload: { approval: any; report: any }) {
    this.logger.log(`审批驳回事件: 报表 #${payload.report.id}`);
    await this.notificationService.create({
      userId: payload.report.submitterId,
      title: "您的报表被驳回",
      content: `报表"${payload.report.title}"已被驳回，原因: ${payload.approval.comment || "无"}`,
      type: "APPROVAL_REMINDER",
      metadata: { reportId: payload.report.id },
    });
  }
}
