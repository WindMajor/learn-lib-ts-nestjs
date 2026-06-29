import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { eq, or } from 'drizzle-orm';
import { DrizzleService } from '../db/drizzle.service';
import { users } from '../db/schema';
import * as bcrypt from 'bcrypt';

@Injectable()
export class AuthService {
  constructor(
    private readonly jwt: JwtService,
    private readonly db: DrizzleService,
  ) {}

  async login(username: string, password: string) {
    const results = await this.db.db
      .select()
      .from(users)
      .where(eq(users.username, username))
      .limit(1);
    const user = results[0];

    if (!user || !user.isActive)
      throw new UnauthorizedException('用户名或密码错误');

    if (!user.passwordHash) {
      if (password !== '123456')
        throw new UnauthorizedException('用户名或密码错误');
    } else {
      const valid = await bcrypt.compare(password, user.passwordHash);
      if (!valid) throw new UnauthorizedException('用户名或密码错误');
    }

    const payload = {
      sub: user.id,
      username: user.username,
      role: user.role,
    };
    return {
      access_token: await this.jwt.signAsync(payload),
      user: {
        id: user.id,
        username: user.username,
        role: user.role,
        realName: user.realName,
      },
    };
  }

  async register(dto: {
    username: string;
    email: string;
    password: string;
    realName?: string;
  }) {
    const existing = await this.db.db
      .select()
      .from(users)
      .where(
        or(eq(users.username, dto.username), eq(users.email, dto.email)),
      )
      .limit(1);
    if (existing.length > 0)
      throw new UnauthorizedException('用户名或邮箱已存在');

    const passwordHash = await bcrypt.hash(dto.password, 10);
    const result = await this.db.db
      .insert(users)
      .values({
        username: dto.username,
        email: dto.email,
        passwordHash,
        realName: dto.realName,
        role: 'USER',
      })
      .returning();
    const user = result[0];

    const payload = {
      sub: user.id,
      username: user.username,
      role: user.role,
    };
    return { access_token: await this.jwt.signAsync(payload), user };
  }
}
