import { Injectable } from '@nestjs/common';
import { eq, and, desc } from 'drizzle-orm';
import { DrizzleService } from '../../db/drizzle.service';
import { notifications } from '../../db/schema';

@Injectable()
export class NotificationService {
  constructor(private readonly db: DrizzleService) {}

  async findByUser(userId: number, onlyUnread = false) {
    return this.db.db
      .select().from(notifications)
      .where(onlyUnread
        ? and(eq(notifications.userId, userId), eq(notifications.isRead, false))
        : eq(notifications.userId, userId))
      .orderBy(desc(notifications.createdAt)).limit(50);
  }

  async markAsRead(id: number) {
    const result = await this.db.db
      .update(notifications).set({ isRead: true }).where(eq(notifications.id, id)).returning();
    return result[0];
  }

  async markAllAsRead(userId: number) {
    await this.db.db
      .update(notifications).set({ isRead: true })
      .where(and(eq(notifications.userId, userId), eq(notifications.isRead, false)));
    return { message: '已全部标记为已读' };
  }

  async create(data: { userId: number; title: string; content: string; type?: string; metadata?: any }) {
    const result = await this.db.db
      .insert(notifications).values(data as any).returning();
    return result[0];
  }
}
