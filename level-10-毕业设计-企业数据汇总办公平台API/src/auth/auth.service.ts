import { Injectable, UnauthorizedException } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { PrismaService } from "../database/prisma.service";
import * as bcrypt from "bcrypt";

@Injectable()
export class AuthService {
  constructor(private readonly jwt: JwtService, private readonly prisma: PrismaService) {}

  async login(username: string, password: string) {
    const user = await this.prisma.user.findUnique({ where: { username } });
    if (!user || !user.isActive) throw new UnauthorizedException("用户名或密码错误");
    if (!user.passwordHash) {
      // 如果没有设置密码（种子数据），允许默认密码
      if (password !== "123456") throw new UnauthorizedException("用户名或密码错误");
    } else {
      const valid = await bcrypt.compare(password, user.passwordHash);
      if (!valid) throw new UnauthorizedException("用户名或密码错误");
    }

    const payload = { sub: user.id, username: user.username, role: user.role };
    return {
      access_token: await this.jwt.signAsync(payload),
      user: { id: user.id, username: user.username, role: user.role, realName: user.realName },
    };
  }

  async register(dto: { username: string; email: string; password: string; realName?: string }) {
    const existing = await this.prisma.user.findFirst({
      where: { OR: [{ username: dto.username }, { email: dto.email }] },
    });
    if (existing) throw new UnauthorizedException("用户名或邮箱已存在");

    const passwordHash = await bcrypt.hash(dto.password, 10);
    const user = await this.prisma.user.create({
      data: { username: dto.username, email: dto.email, passwordHash, realName: dto.realName, role: "USER" },
    });

    const payload = { sub: user.id, username: user.username, role: user.role };
    return { access_token: await this.jwt.signAsync(payload), user };
  }
}
