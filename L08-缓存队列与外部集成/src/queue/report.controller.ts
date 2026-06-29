import {
  Controller, Post, Body, Logger, HttpCode, HttpStatus,
} from "@nestjs/common";
import { InjectQueue } from "@nestjs/bull";
import { Queue } from "bull";
import { EventEmitter2 } from "@nestjs/event-emitter";

@Controller("reports")
export class ReportController {
  private readonly logger = new Logger(ReportController.name);

  constructor(
    @InjectQueue("report") private readonly reportQueue: Queue,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  /**
   * WHAT: POST /reports/generate —— 异步生成报表
   *
   * 不阻塞 HTTP 响应——将任务推入 Bull 队列后立即返回。
   * 队列中的任务由 ReportProcessor 异步处理。
   *
   * 测试：curl -X POST http://localhost:3000/reports/generate \
   *        -H "Content-Type: application/json" \
   *        -d '{"reportId":1,"type":"summary"}'
   */
  @Post("generate")
  @HttpCode(HttpStatus.ACCEPTED)
  async generate(
    @Body() dto: { reportId: number; type: string },
  ) {
    const job = await this.reportQueue.add("generate", dto, {
      attempts: 3,           // 失败重试 3 次
      backoff: 2000,         // 重试间隔 2 秒
      removeOnComplete: true, // 完成后删除任务
    });

    // 同时发事件通知
    this.eventEmitter.emit("report.queued", { jobId: job.id, ...dto });

    return {
      message: "报表生成任务已加入队列",
      jobId: job.id,
      reportId: dto.reportId,
    };
  }
}
