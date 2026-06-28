import { Controller, Get, Post, Patch, Delete, Param, Body, ParseIntPipe, HttpCode, HttpStatus, UseGuards } from "@nestjs/common";
import { ApiTags, ApiOperation, ApiBearerAuth } from "@nestjs/swagger";
import { UserService } from "./user.service";
import { CreateUserDto, UpdateUserDto } from "./dto/user.dto";
import { JwtAuthGuard } from "../../auth/guards/jwt-auth.guard";
import { RolesGuard } from "../../auth/guards/roles.guard";
import { Roles } from "../../auth/decorators/roles.decorator";

@ApiTags("用户管理")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller("users")
export class UserController {
  constructor(private readonly svc: UserService) {}

  @Get()
  @ApiOperation({ summary: "获取所有用户" })
  findAll() { return this.svc.findAll(); }

  @Get(":id")
  @ApiOperation({ summary: "获取指定用户" })
  findOne(@Param("id", ParseIntPipe) id: number) { return this.svc.findById(id); }

  @Post()
  @Roles("ADMIN")
  @ApiOperation({ summary: "创建用户（仅管理员）" })
  @HttpCode(HttpStatus.CREATED)
  create(@Body() dto: CreateUserDto) { return this.svc.create(dto); }

  @Patch(":id")
  @Roles("ADMIN", "DEPARTMENT_MANAGER")
  @ApiOperation({ summary: "更新用户信息" })
  update(@Param("id", ParseIntPipe) id: number, @Body() dto: UpdateUserDto) {
    return this.svc.update(id, dto);
  }

  @Delete(":id")
  @Roles("ADMIN")
  @ApiOperation({ summary: "停用用户（软删除）" })
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Param("id", ParseIntPipe) id: number) { return this.svc.remove(id); }
}
