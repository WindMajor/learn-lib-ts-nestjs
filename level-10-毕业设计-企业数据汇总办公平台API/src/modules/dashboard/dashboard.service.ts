import { Injectable } from "@nestjs/common";
import { PrismaService } from "../../database/prisma.service";

@Injectable()
export class DashboardService {
  constructor(private readonly prisma: PrismaService) {}

  async getStats() {
    const [totalUsers, totalDepts, totalReports, pendingApprovals] = await Promise.all([
      this.prisma.user.count({ where: { isActive: true } }),
      this.prisma.department.count(),
      this.prisma.report.count(),
      this.prisma.approval.count({ where: { status: "PENDING" } }),
    ]);
    return { totalUsers, totalDepts, totalReports, pendingApprovals };
  }

  async getReportStatsByCategory() {
    const reports = await this.prisma.report.groupBy({
      by: ["category"], _count: true, orderBy: { _count: { category: "desc" } },
    });
    return reports.map((r) => ({ category: r.category, count: r._count }));
  }

  async getDepartmentReportStats() {
    const depts = await this.prisma.department.findMany({
      include: { _count: { select: { reports: true, users: true } } },
    });
    return depts.map((d) => ({ id: d.id, name: d.name, reportCount: d._count.reports, userCount: d._count.users }));
  }

  async getRecentApprovals(limit = 10) {
    return this.prisma.approval.findMany({
      take: limit, orderBy: { createdAt: "desc" },
      include: { report: { select: { id: true, title: true } }, approver: { select: { id: true, realName: true } } },
    });
  }
}
