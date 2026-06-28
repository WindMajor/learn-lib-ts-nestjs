import { Injectable, NotFoundException, ForbiddenException } from "@nestjs/common";
import { EventEmitter2 } from "@nestjs/event-emitter";
import { PrismaService } from "../../database/prisma.service";

@Injectable()
export class ApprovalService {
  constructor(private readonly prisma: PrismaService, private readonly eventEmitter: EventEmitter2) {}

  async findAll() {
    return this.prisma.approval.findMany({
      include: { report: { select: { id: true, title: true } }, approver: { select: { id: true, realName: true } } },
      orderBy: { createdAt: "desc" },
    });
  }

  async approve(id: number, userId: number, comment?: string) {
    const approval = await this.prisma.approval.findUnique({
      where: { id }, include: { report: true },
    });
    if (!approval) throw new NotFoundException("审批记录不存在");
    if (approval.approverId !== userId) throw new ForbiddenException("您不是该审批的指定审批人");
    if (approval.status !== "PENDING") throw new ForbiddenException("该审批已处理");

    const updated = await this.prisma.approval.update({
      where: { id },
      data: { status: "APPROVED", comment, approvedAt: new Date() },
    });

    // 检查是否所有审批都已完成
    const pendingCount = await this.prisma.approval.count({
      where: { reportId: approval.reportId, status: "PENDING" },
    });
    if (pendingCount === 0) {
      await this.prisma.report.update({
        where: { id: approval.reportId },
        data: { status: "APPROVED" },
      });
    }

    // 发送事件通知
    this.eventEmitter.emit("approval.approved", { approval: updated, report: approval.report });
    return updated;
  }

  async reject(id: number, userId: number, comment?: string) {
    const approval = await this.prisma.approval.findUnique({ where: { id }, include: { report: true } });
    if (!approval) throw new NotFoundException("审批记录不存在");
    if (approval.approverId !== userId) throw new ForbiddenException("您不是该审批的指定审批人");

    const updated = await this.prisma.approval.update({
      where: { id },
      data: { status: "REJECTED", comment, approvedAt: new Date() },
    });
    await this.prisma.report.update({ where: { id: approval.reportId }, data: { status: "REJECTED" } });
    this.eventEmitter.emit("approval.rejected", { approval: updated, report: approval.report });
    return updated;
  }
}
