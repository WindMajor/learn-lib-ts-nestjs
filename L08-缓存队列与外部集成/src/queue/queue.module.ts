import { Module } from "@nestjs/common";
import { BullModule } from "@nestjs/bull";
import { ReportController } from "./report.controller";
import { ReportProcessor } from "./report.processor";

@Module({
  imports: [
    // WHAT: 注册 'report' 队列——Bull 自动连接 Redis
    BullModule.registerQueue({ name: "report" }),
  ],
  controllers: [ReportController],
  providers: [ReportProcessor],
})
export class QueueModule {}
