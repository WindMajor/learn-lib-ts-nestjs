import { Injectable, NotFoundException, ConflictException } from "@nestjs/common";
import { PrismaService } from "../../database/prisma.service";
import { CreateUserDto, UpdateUserDto } from "./dto/user.dto";
import * as bcrypt from "bcrypt";

@Injectable()
export class UserService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll() {
    return this.prisma.user.findMany({
      select: { id: true, username: true, email: true, realName: true, role: true, isActive: true, departmentId: true, createdAt: true },
      orderBy: { createdAt: "desc" },
    });
  }

  async findById(id: number) {
    const user = await this.prisma.user.findUnique({ where: { id }, include: { department: true } });
    if (!user) throw new NotFoundException(`用户 id=${id} 不存在`);
    const { passwordHash, ...safe } = user;
    return safe;
  }

  async create(dto: CreateUserDto) {
    const existing = await this.prisma.user.findFirst({ where: { OR: [{ username: dto.username }, { email: dto.email }] } });
    if (existing) throw new ConflictException("用户名或邮箱已存在");

    const passwordHash = await bcrypt.hash(dto.password || "123456", 10);
    const user = await this.prisma.user.create({
      data: { ...dto, passwordHash, password: undefined as any },
      select: { id: true, username: true, email: true, realName: true, role: true, departmentId: true, createdAt: true },
    });
    return user;
  }

  async update(id: number, dto: UpdateUserDto) {
    await this.findById(id);
    return this.prisma.user.update({
      where: { id }, data: dto,
      select: { id: true, username: true, email: true, realName: true, role: true, isActive: true, departmentId: true },
    });
  }

  async remove(id: number) {
    await this.findById(id);
    await this.prisma.user.update({ where: { id }, data: { isActive: false } });
    return { message: "用户已停用" };
  }
}
