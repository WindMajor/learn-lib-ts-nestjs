import { Controller, Get, Post, Patch, Delete, Param, Body, ParseIntPipe, HttpCode, HttpStatus, UseGuards } from "@nestjs/common";
import { ApiTags, ApiOperation, ApiBearerAuth } from "@nestjs/swagger";
import { ReportService } from "./report.service";
import { CreateReportDto, UpdateReportDto } from "./dto/report.dto";
import { JwtAuthGuard } from "../../auth/guards/jwt-auth.guard";
import { CurrentUser } from "../../auth/decorators/current-user.decorator";

@ApiTags("数据上报")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller("reports")
export class ReportController {
  constructor(private readonly svc: ReportService) {}

  @Get()
  @ApiOperation({ summary: "获取所有报表" })
  findAll() { return this.svc.findAll(); }

  @Get(":id")
  @ApiOperation({ summary: "获取报表详情（含审批记录）" })
  findOne(@Param("id", ParseIntPipe) id: number) { return this.svc.findById(id); }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: "创建报表" })
  create(@Body() dto: CreateReportDto, @CurrentUser("userId") userId: number) {
    return this.svc.create(dto, userId);
  }

  @Post(":id/submit")
  @ApiOperation({ summary: "提交流程" })
  submit(@Param("id", ParseIntPipe) id: number) { return this.svc.submit(id); }

  @Patch(":id")
  @ApiOperation({ summary: "更新报表" })
  update(@Param("id", ParseIntPipe) id: number, @Body() dto: UpdateReportDto) {
    return this.svc.update(id, dto);
  }

  @Delete(":id")
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: "删除报表" })
  remove(@Param("id", ParseIntPipe) id: number) { return this.svc.remove(id); }
}
