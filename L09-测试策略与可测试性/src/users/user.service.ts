import { Injectable, NotFoundException, Logger } from "@nestjs/common";
import { CreateUserDto, UpdateUserDto } from "./dto/user.dto";

export interface User {
  id: number;
  name: string;
  email: string;
  age: number;
}

@Injectable()
export class UserService {
  private readonly logger = new Logger(UserService.name);
  private users: User[] = [
    { id: 1, name: "张三", email: "zhangsan@test.com", age: 28 },
    { id: 2, name: "李四", email: "lisi@test.com", age: 35 },
  ];
  private nextId = 3;

  /** 返回所有用户列表 */
  findAll(): User[] {
    this.logger.log("findAll 被调用");
    return this.users;
  }

  /** 按 ID 查找用户——不存在则抛出 NotFoundException */
  findOne(id: number): User {
    this.logger.log(`findOne id=${id}`);
    const user = this.users.find((u) => u.id === id);
    if (!user) {
      throw new NotFoundException(`用户 id=${id} 不存在`);
    }
    return user;
  }

  /** 创建用户 */
  create(dto: CreateUserDto): User {
    const user: User = { id: this.nextId++, ...dto };
    this.users.push(user);
    this.logger.log(`创建用户: ${user.name}`);
    return user;
  }

  /** 更新用户 */
  update(id: number, dto: UpdateUserDto): User {
    const user = this.findOne(id); // 确保存在（不存在会抛异常）
    Object.assign(user, dto);
    this.logger.log(`更新用户 id=${id}`);
    return user;
  }

  /** 删除用户 */
  remove(id: number): { message: string } {
    const index = this.users.findIndex((u) => u.id === id);
    if (index === -1) {
      throw new NotFoundException(`用户 id=${id} 不存在`);
    }
    this.users.splice(index, 1);
    this.logger.log(`删除用户 id=${id}`);
    return { message: "删除成功" };
  }
}
