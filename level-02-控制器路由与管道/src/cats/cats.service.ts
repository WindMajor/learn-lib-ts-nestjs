import { Injectable, Logger, NotFoundException } from "@nestjs/common";

/**
 * WHAT: CatsService——纯业务逻辑，不涉及 HTTP
 * WHY: 与 Level 01 一致——分层架构中 Service 只处理数据
 */
export interface Cat {
  id: number;
  name: string;
  age: number;
  breed: string;
}

@Injectable()
export class CatsService {
  private readonly logger = new Logger(CatsService.name);
  private cats: Cat[] = [
    { id: 1, name: "咪咪", age: 2, breed: "波斯猫" },
    { id: 2, name: "旺财", age: 3, breed: "橘猫" },
    { id: 3, name: "小花", age: 1, breed: "英短" },
  ];
  private nextId = 4;

  findAll(): Cat[] {
    this.logger.log("查询所有猫");
    return this.cats;
  }

  findOne(id: number): Cat {
    this.logger.log(`查询猫 id=${id}`);
    const cat = this.cats.find((c) => c.id === id);
    if (!cat) {
      // WHAT: 抛出 NestJS 标准异常 → ExceptionFilter 会自动转为 404 响应
      // 【对比 Express】Express 需要手动 res.status(404).json({...})
      throw new NotFoundException(`ID 为 ${id} 的猫不存在`);
    }
    return cat;
  }

  findByBreed(breed: string): Cat[] {
    this.logger.log(`按品种查询: ${breed}`);
    return this.cats.filter((c) => c.breed === breed);
  }

  create(dto: { name: string; age: number; breed: string }): Cat {
    this.logger.log(`创建猫: ${dto.name}`);
    const cat: Cat = { id: this.nextId++, ...dto };
    this.cats.push(cat);
    return cat;
  }

  search(name?: string, minAge?: number): Cat[] {
    let result = this.cats;
    if (name) {
      result = result.filter((c) => c.name.includes(name));
    }
    if (minAge !== undefined) {
      result = result.filter((c) => c.age >= minAge);
    }
    return result;
  }
}
