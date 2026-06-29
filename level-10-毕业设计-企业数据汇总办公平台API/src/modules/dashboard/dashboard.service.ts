import { Injectable } from '@nestjs/common';
import { eq, desc } from 'drizzle-orm';
import { DrizzleService } from '../../db/drizzle.service';
import { users, departments, reports, approvals } from '../../db/schema';

@Injectable()
export class DashboardService {
  constructor(private readonly db: DrizzleService) {}

  async getStats() {
    const [totalUsers, totalDepts, totalReports, pendingApprovals] = await Promise.all([
      this.db.db.select().from(users).where(eq(users.isActive, true)),
      this.db.db.select().from(departments),
      this.db.db.select().from(reports),
      this.db.db.select().from(approvals).where(eq(approvals.status, 'PENDING')),
    ]);
    return {
      totalUsers: totalUsers.length,
      totalDepts: totalDepts.length,
      totalReports: totalReports.length,
      pendingApprovals: pendingApprovals.length,
    };
  }

  async getReportStatsByCategory() {
    const allReports = await this.db.db.select({ category: reports.category }).from(reports);
    const grouped: Record<string, number> = {};
    for (const r of allReports) {
      grouped[r.category] = (grouped[r.category] || 0) + 1;
    }
    return Object.entries(grouped).map(([category, count]) => ({ category, count }));
  }

  async getDepartmentReportStats() {
    const depts = await this.db.db.select().from(departments);
    return Promise.all(depts.map(async (d) => {
      const deptReports = await this.db.db.select().from(reports).where(eq(reports.departmentId, d.id));
      const deptUsers = await this.db.db.select().from(users).where(eq(users.departmentId, d.id));
      return { id: d.id, name: d.name, reportCount: deptReports.length, userCount: deptUsers.length };
    }));
  }

  async getRecentApprovals(limit = 10) {
    return this.db.db.select()
      .from(approvals).orderBy(desc(approvals.createdAt)).limit(limit);
  }
}
