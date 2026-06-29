import {
  Injectable, NotFoundException, ConflictException,
} from '@nestjs/common';
import { eq, or, desc } from 'drizzle-orm';
import { DrizzleService } from '../../db/drizzle.service';
import { users } from '../../db/schema';
import * as bcrypt from 'bcrypt';

@Injectable()
export class UserService {
  constructor(private readonly db: DrizzleService) {}

  async findAll() {
    const rows = await this.db.db
      .select({
        id: users.id, username: users.username, email: users.email,
        realName: users.realName, role: users.role, isActive: users.isActive,
        departmentId: users.departmentId, createdAt: users.createdAt,
      })
      .from(users)
      .orderBy(desc(users.createdAt));
    return rows;
  }

  async findById(id: number) {
    const rows = await this.db.db
      .select()
      .from(users)
      .where(eq(users.id, id))
      .limit(1);
    const user = rows[0];
    if (!user) throw new NotFoundException(`用户 id=${id} 不存在`);
    const { passwordHash, ...safe } = user;
    return safe;
  }

  async create(dto: {
    username: string; email: string; password?: string;
    realName?: string; role?: string; departmentId?: number;
  }) {
    const existing = await this.db.db
      .select()
      .from(users)
      .where(or(eq(users.username, dto.username), eq(users.email, dto.email)))
      .limit(1);
    if (existing.length > 0)
      throw new ConflictException('用户名或邮箱已存在');

    const passwordHash = await bcrypt.hash(dto.password || '123456', 10);
    const result = await this.db.db
      .insert(users)
      .values({
        username: dto.username, email: dto.email, passwordHash,
        realName: dto.realName, role: (dto.role as any) || 'USER',
        departmentId: dto.departmentId,
      })
      .returning({
        id: users.id, username: users.username, email: users.email,
        realName: users.realName, role: users.role,
        departmentId: users.departmentId, createdAt: users.createdAt,
      });
    return result[0];
  }

  async update(id: number, dto: any) {
    await this.findById(id);
    const result = await this.db.db
      .update(users).set(dto).where(eq(users.id, id))
      .returning({
        id: users.id, username: users.username, email: users.email,
        realName: users.realName, role: users.role,
        isActive: users.isActive, departmentId: users.departmentId,
      });
    return result[0];
  }

  async remove(id: number) {
    await this.findById(id);
    await this.db.db
      .update(users).set({ isActive: false }).where(eq(users.id, id));
    return { message: '用户已停用' };
  }
}
