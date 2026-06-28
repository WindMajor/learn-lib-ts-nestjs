import { Injectable } from "@nestjs/common";
import { PrismaService } from "../../database/prisma.service";

@Injectable()
export class NotificationService {
  constructor(private readonly prisma: PrismaService) {}

  async findByUser(userId: number, onlyUnread = false) {
    return this.prisma.notification.findMany({
      where: { userId, ...(onlyUnread ? { isRead: false } : {}) },
      orderBy: { createdAt: "desc" },
      take: 50,
    });
  }

  async markAsRead(id: number) {
    return this.prisma.notification.update({ where: { id }, data: { isRead: true } });
  }

  async markAllAsRead(userId: number) {
    await this.prisma.notification.updateMany({ where: { userId, isRead: false }, data: { isRead: true } });
    return { message: "已全部标记为已读" };
  }

  async create(data: { userId: number; title: string; content: string; type?: string; metadata?: any }) {
    return this.prisma.notification.create({ data });
  }
}
