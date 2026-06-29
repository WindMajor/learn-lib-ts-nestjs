import { Injectable, NotFoundException } from '@nestjs/common';
import { eq, desc } from 'drizzle-orm';
import { DrizzleService } from '../../db/drizzle.service';
import { reports } from '../../db/schema';

@Injectable()
export class ReportService {
  constructor(private readonly db: DrizzleService) {}

  async findAll() {
    return this.db.db.select()
      .from(reports).orderBy(desc(reports.createdAt));
  }

  async findById(id: number) {
    const rows = await this.db.db
      .select().from(reports).where(eq(reports.id, id)).limit(1);
    const report = rows[0];
    if (!report) throw new NotFoundException(`报表 id=${id} 不存在`);
    return report;
  }

  async create(dto: any, userId: number) {
    const result = await this.db.db
      .insert(reports).values({ ...dto, submitterId: userId })
      .returning();
    return result[0];
  }

  async submit(id: number) {
    await this.findById(id);
    const result = await this.db.db
      .update(reports)
      .set({ status: 'SUBMITTED', submittedAt: new Date() })
      .where(eq(reports.id, id)).returning();
    return result[0];
  }

  async update(id: number, dto: any) {
    await this.findById(id);
    const result = await this.db.db
      .update(reports).set(dto).where(eq(reports.id, id)).returning();
    return result[0];
  }

  async remove(id: number) {
    await this.findById(id);
    await this.db.db.delete(reports).where(eq(reports.id, id));
    return { message: '报表已删除' };
  }
}
