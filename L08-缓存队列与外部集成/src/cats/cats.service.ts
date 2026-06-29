import { Injectable, Logger } from "@nestjs/common";

export interface Cat {
  id: number;
  name: string;
  age: number;
  breed: string;
  createdAt: Date;
}

@Injectable()
export class CatsService {
  private readonly logger = new Logger(CatsService.name);
  private cats: Cat[] = [
    { id: 1, name: "咪咪", age: 2, breed: "波斯猫", createdAt: new Date() },
    { id: 2, name: "旺财", age: 3, breed: "橘猫", createdAt: new Date() },
  ];
  private nextId = 3;

  /** 查询所有猫——此方法的调用会被 CacheInterceptor 缓存 */
  findAll(): Cat[] {
    this.logger.log("findAll 被调用（如果看到这条日志说明缓存未命中）");
    // 模拟慢查询：延迟 500ms
    const start = Date.now();
    while (Date.now() - start < 500) {
      /* 模拟耗时 */
    }
    return this.cats;
  }

  findOne(id: number): Cat | undefined {
    return this.cats.find((c) => c.id === id);
  }

  create(data: { name: string; age: number; breed: string }): Cat {
    const cat: Cat = { id: this.nextId++, ...data, createdAt: new Date() };
    this.cats.push(cat);
    this.logger.log(`创建猫: ${cat.name}`);
    return cat;
  }
}
