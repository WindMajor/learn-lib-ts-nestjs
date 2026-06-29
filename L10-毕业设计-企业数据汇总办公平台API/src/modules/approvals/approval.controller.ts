import { Controller, Get, Post, Param, Body, ParseIntPipe, UseGuards } from "@nestjs/common";
import { ApiTags, ApiOperation, ApiBearerAuth } from "@nestjs/swagger";
import { ApprovalService } from "./approval.service";
import { JwtAuthGuard } from "../../auth/guards/jwt-auth.guard";
import { CurrentUser } from "../../auth/decorators/current-user.decorator";

@ApiTags("审批流")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller("approvals")
export class ApprovalController {
  constructor(private readonly svc: ApprovalService) {}

  @Get()
  @ApiOperation({ summary: "获取所有审批记录" })
  findAll() { return this.svc.findAll(); }

  @Post(":id/approve")
  @ApiOperation({ summary: "审批通过" })
  approve(@Param("id", ParseIntPipe) id: number, @CurrentUser("userId") userId: number, @Body("comment") comment?: string) {
    return this.svc.approve(id, userId, comment);
  }

  @Post(":id/reject")
  @ApiOperation({ summary: "审批驳回" })
  reject(@Param("id", ParseIntPipe) id: number, @CurrentUser("userId") userId: number, @Body("comment") comment?: string) {
    return this.svc.reject(id, userId, comment);
  }
}
