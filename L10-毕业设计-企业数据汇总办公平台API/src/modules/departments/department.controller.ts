import { Controller, Get, Post, Patch, Delete, Param, Body, ParseIntPipe, HttpCode, HttpStatus, UseGuards } from "@nestjs/common";
import { ApiTags, ApiOperation, ApiBearerAuth } from "@nestjs/swagger";
import { DepartmentService } from "./department.service";
import { CreateDeptDto, UpdateDeptDto } from "./dto/department.dto";
import { JwtAuthGuard } from "../../auth/guards/jwt-auth.guard";
import { RolesGuard } from "../../auth/guards/roles.guard";
import { Roles } from "../../auth/decorators/roles.decorator";

@ApiTags("部门管理")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller("departments")
export class DepartmentController {
  constructor(private readonly svc: DepartmentService) {}

  @Get()
  @ApiOperation({ summary: "获取所有部门（含部门人数）" })
  findAll() { return this.svc.findAll(); }

  @Get(":id")
  @ApiOperation({ summary: "获取部门详情（含成员列表）" })
  findOne(@Param("id", ParseIntPipe) id: number) { return this.svc.findById(id); }

  @Post()
  @Roles("ADMIN")
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: "创建部门（仅管理员）" })
  create(@Body() dto: CreateDeptDto) { return this.svc.create(dto); }

  @Patch(":id")
  @Roles("ADMIN", "DEPARTMENT_MANAGER")
  @ApiOperation({ summary: "更新部门信息" })
  update(@Param("id", ParseIntPipe) id: number, @Body() dto: UpdateDeptDto) {
    return this.svc.update(id, dto);
  }

  @Delete(":id")
  @Roles("ADMIN")
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: "删除部门（仅管理员）" })
  remove(@Param("id", ParseIntPipe) id: number) { return this.svc.remove(id); }
}
