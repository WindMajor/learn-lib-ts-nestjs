import { Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../../database/prisma.service";
import { CreateDeptDto, UpdateDeptDto } from "./dto/department.dto";

@Injectable()
export class DepartmentService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll() {
    return this.prisma.department.findMany({
      include: { leader: { select: { id: true, realName: true } }, _count: { select: { users: true } } },
      orderBy: { sortOrder: "asc" },
    });
  }

  async findById(id: number) {
    const dept = await this.prisma.department.findUnique({
      where: { id },
      include: { users: { select: { id: true, username: true, realName: true, role: true } }, children: true },
    });
    if (!dept) throw new NotFoundException(`部门 id=${id} 不存在`);
    return dept;
  }

  async create(dto: CreateDeptDto) {
    return this.prisma.department.create({
      data: dto,
      include: { leader: { select: { id: true, realName: true } } },
    });
  }

  async update(id: number, dto: UpdateDeptDto) {
    await this.findById(id);
    return this.prisma.department.update({ where: { id }, data: dto });
  }

  async remove(id: number) {
    await this.findById(id);
    const hasUsers = await this.prisma.user.count({ where: { departmentId: id } });
    if (hasUsers) {
      await this.prisma.user.updateMany({ where: { departmentId: id }, data: { departmentId: null } });
    }
    await this.prisma.department.delete({ where: { id } });
    return { message: "部门已删除" };
  }
}
