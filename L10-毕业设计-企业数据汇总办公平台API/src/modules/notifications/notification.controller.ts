import { Controller, Get, Patch, Post, Param, ParseIntPipe, UseGuards } from "@nestjs/common";
import { ApiTags, ApiOperation, ApiBearerAuth } from "@nestjs/swagger";
import { NotificationService } from "./notification.service";
import { JwtAuthGuard } from "../../auth/guards/jwt-auth.guard";
import { CurrentUser } from "../../auth/decorators/current-user.decorator";

@ApiTags("通知消息")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller("notifications")
export class NotificationController {
  constructor(private readonly svc: NotificationService) {}

  @Get()
  @ApiOperation({ summary: "获取当前用户的未读通知" })
  findByUser(@CurrentUser("userId") userId: number) {
    return this.svc.findByUser(userId);
  }

  @Patch(":id/read")
  @ApiOperation({ summary: "标记通知为已读" })
  markAsRead(@Param("id", ParseIntPipe) id: number) {
    return this.svc.markAsRead(id);
  }

  @Post("read-all")
  @ApiOperation({ summary: "标记所有通知为已读" })
  markAllAsRead(@CurrentUser("userId") userId: number) {
    return this.svc.markAllAsRead(userId);
  }
}
