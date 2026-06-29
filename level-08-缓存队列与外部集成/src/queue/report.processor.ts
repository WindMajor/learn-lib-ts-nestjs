import { Processor, Process } from "@nestjs/bull";
import { Logger } from "@nestjs/common";
import { Job } from "bull";
import { EventEmitter2 } from "@nestjs/event-emitter";

/**
 * WHAT: ReportProcessor——Bull 队列消费者
 *
 * 【核心原理——@Processor + @Process】
 *   @Processor('report') → 绑定到名为 'report' 的队列
 *   @Process('generate')  → 处理名为 'generate' 的任务
 *
 *   运行模型：
 *   - 任务入队（Producer 端）→ Bull 存到 Redis → Worker 拉取执行
 *   - 失败自动重试（根据 attempts 配置）
 *   - 支持并发（concurrency 参数控制并行 Worker 数量）
 *
 * 【对比 Go】
 *   Go 的异步任务通常用 goroutine + channel：
 *   go func() { processReport(data); done <- true }()
 *   没有持久化——进程崩溃则任务丢失。
 *   Bull 基于 Redis 持久化——任务不丢失。
 *
 * 【对比 Spring】
 *   Spring: @Async + @EnableAsync + TaskExecutor
 *   Bull 更重但更可靠（持久化 + 重试 + 监控 Dashboard）
 */
@Processor("report")
export class ReportProcessor {
  private readonly logger = new Logger(ReportProcessor.name);

  constructor(private readonly eventEmitter: EventEmitter2) {}

  @Process("generate")
  async handleGenerate(job: Job<{ reportId: number; type: string }>) {
    const { reportId, type } = job.data;
    this.logger.log(`📊 开始生成报表 [ID=${reportId}, type=${type}]`);

    // 模拟耗时的报表生成（如：聚合查询 + 图表渲染）
    await this.simulateWork(3000);

    this.logger.log(`✅ 报表生成完成 [ID=${reportId}]`);

    // 发送完成事件
    this.eventEmitter.emit("report.generated", {
      reportId,
      completedAt: new Date().toISOString(),
    });
  }

  private simulateWork(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
