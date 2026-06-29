import {
  Injectable, NotFoundException, ForbiddenException,
} from '@nestjs/common';
import { eq, and, desc } from 'drizzle-orm';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { DrizzleService } from '../../db/drizzle.service';
import { approvals, reports } from '../../db/schema';

@Injectable()
export class ApprovalService {
  constructor(
    private readonly db: DrizzleService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  async findAll() {
    return this.db.db.select()
      .from(approvals).orderBy(desc(approvals.createdAt));
  }

  async approve(id: number, userId: number, comment?: string) {
    const rows = await this.db.db
      .select().from(approvals).where(eq(approvals.id, id)).limit(1);
    const approval = rows[0];
    if (!approval) throw new NotFoundException('审批记录不存在');
    if (approval.approverId !== userId) throw new ForbiddenException('您不是该审批的指定审批人');
    if (approval.status !== 'PENDING') throw new ForbiddenException('该审批已处理');

    const result = await this.db.db
      .update(approvals)
      .set({ status: 'APPROVED', comment: comment || null, approvedAt: new Date() })
      .where(eq(approvals.id, id)).returning();
    const updated = result[0];

    // 检查所有审批是否完成
    const pending = await this.db.db
      .select().from(approvals)
      .where(and(eq(approvals.reportId, approval.reportId), eq(approvals.status, 'PENDING')));
    if (pending.length === 0) {
      await this.db.db
        .update(reports).set({ status: 'APPROVED' }).where(eq(reports.id, approval.reportId));
    }

    this.eventEmitter.emit('approval.approved', { approval: updated, report: { id: approval.reportId } });
    return updated;
  }

  async reject(id: number, userId: number, comment?: string) {
    const rows = await this.db.db
      .select().from(approvals).where(eq(approvals.id, id)).limit(1);
    const approval = rows[0];
    if (!approval) throw new NotFoundException('审批记录不存在');
    if (approval.approverId !== userId) throw new ForbiddenException('您不是该审批的指定审批人');

    const result = await this.db.db
      .update(approvals)
      .set({ status: 'REJECTED', comment: comment || null, approvedAt: new Date() })
      .where(eq(approvals.id, id)).returning();
    const updated = result[0];

    await this.db.db
      .update(reports).set({ status: 'REJECTED' }).where(eq(reports.id, approval.reportId));
    this.eventEmitter.emit('approval.rejected', { approval: updated, report: { id: approval.reportId } });
    return updated;
  }
}
