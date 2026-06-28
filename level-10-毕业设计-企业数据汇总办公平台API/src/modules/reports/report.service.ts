import { Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../../database/prisma.service";
import { CreateReportDto, UpdateReportDto } from "./dto/report.dto";

@Injectable()
export class ReportService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll() {
    return this.prisma.report.findMany({
      include: { submitter: { select: { id: true, realName: true } }, department: { select: { id: true, name: true } }, _count: { select: { approvals: true, attachments: true } } },
      orderBy: { createdAt: "desc" },
    });
  }

  async findById(id: number) {
    const report = await this.prisma.report.findUnique({
      where: { id }, include: { submitter: { select: { id: true, realName: true, username: true } }, department: true, approvals: { include: { approver: { select: { id: true, realName: true } } } }, attachments: true },
    });
    if (!report) throw new NotFoundException(`报表 id=${id} 不存在`);
    return report;
  }

  async create(dto: CreateReportDto, userId: number) {
    return this.prisma.report.create({
      data: { ...dto, submitterId: userId },
      include: { submitter: { select: { id: true, realName: true } }, department: { select: { id: true, name: true } } },
    });
  }

  async submit(id: number) {
    await this.findById(id);
    return this.prisma.report.update({ where: { id }, data: { status: "SUBMITTED", submittedAt: new Date() } });
  }

  async update(id: number, dto: UpdateReportDto) {
    await this.findById(id);
    return this.prisma.report.update({ where: { id }, data: dto });
  }

  async remove(id: number) {
    await this.findById(id);
    await this.prisma.report.delete({ where: { id } });
    return { message: "报表已删除" };
  }
}
