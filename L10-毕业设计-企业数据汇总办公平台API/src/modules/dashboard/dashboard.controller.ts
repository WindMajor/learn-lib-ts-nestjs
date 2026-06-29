import { Controller, Get, UseGuards } from "@nestjs/common";
import { ApiTags, ApiOperation, ApiBearerAuth } from "@nestjs/swagger";
import { DashboardService } from "./dashboard.service";
import { JwtAuthGuard } from "../../auth/guards/jwt-auth.guard";

@ApiTags("仪表盘")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller("dashboard")
export class DashboardController {
  constructor(private readonly svc: DashboardService) {}

  @Get("stats")
  @ApiOperation({ summary: "获取平台统计数据" })
  getStats() { return this.svc.getStats(); }

  @Get("report-stats")
  @ApiOperation({ summary: "按分类统计报表数量" })
  getReportStats() { return this.svc.getReportStatsByCategory(); }

  @Get("department-stats")
  @ApiOperation({ summary: "各部门报表统计" })
  getDeptStats() { return this.svc.getDepartmentReportStats(); }

  @Get("recent-approvals")
  @ApiOperation({ summary: "最近审批记录" })
  getRecentApprovals() { return this.svc.getRecentApprovals(); }
}
