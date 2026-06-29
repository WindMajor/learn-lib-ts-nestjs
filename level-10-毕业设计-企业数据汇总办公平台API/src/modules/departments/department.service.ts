import { Injectable, NotFoundException } from '@nestjs/common';
import { eq } from 'drizzle-orm';
import { DrizzleService } from '../../db/drizzle.service';
import { departments, users } from '../../db/schema';

@Injectable()
export class DepartmentService {
  constructor(private readonly db: DrizzleService) {}

  async findAll() {
    const rows = await this.db.db.select().from(departments).orderBy(departments.sortOrder);
    // 简单统计：返回部门列表（生产环境应 JOIN 统计人数）
    return Promise.all(rows.map(async (d) => {
      const userCount = await this.db.db
        .select().from(users).where(eq(users.departmentId, d.id));
      return { ...d, _count: { users: userCount.length } };
    }));
  }

  async findById(id: number) {
    const rows = await this.db.db
      .select().from(departments).where(eq(departments.id, id)).limit(1);
    const dept = rows[0];
    if (!dept) throw new NotFoundException(`部门 id=${id} 不存在`);
    const members = await this.db.db
      .select({ id: users.id, username: users.username, realName: users.realName, role: users.role })
      .from(users).where(eq(users.departmentId, id));
    return { ...dept, users: members, children: [] };
  }

  async create(dto: any) {
    const result = await this.db.db.insert(departments).values(dto).returning();
    return result[0];
  }

  async update(id: number, dto: any) {
    await this.findById(id);
    const result = await this.db.db
      .update(departments).set(dto).where(eq(departments.id, id)).returning();
    return result[0];
  }

  async remove(id: number) {
    await this.findById(id);
    await this.db.db
      .update(users).set({ departmentId: null }).where(eq(users.departmentId, id));
    await this.db.db.delete(departments).where(eq(departments.id, id));
    return { message: '部门已删除' };
  }
}
