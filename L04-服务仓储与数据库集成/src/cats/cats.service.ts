import { Injectable, Logger, NotFoundException } from "@nestjs/common";
import { CatsRepository } from "./cats.repository";
import { cats } from "../db/schema";

/** Drizzle 自动推导的完整 Cat 行类型 */
type Cat = typeof cats.$inferSelect;

@Injectable()
export class CatsService {
  private readonly logger = new Logger(CatsService.name);

  /**
   * WHAT: Service 层注入 Repository（而非直接注入 PrismaService）
   * WHY: 符合 Repository 模式——Service 不接触数据库细节
   */
  constructor(private readonly repo: CatsRepository) {}

  async findAll(): Promise<Cat[]> {
    return this.repo.findAll(true);
  }

  async findOne(id: number): Promise<Cat> {
    const cat = await this.repo.findById(id);
    if (!cat) throw new NotFoundException(`猫 id=${id} 不存在`);
    return cat;
  }

  async create(data: { name: string; age: number; breed: string }): Promise<Cat> {
    return this.repo.create(data);
  }

  async update(id: number, data: Partial<{ name: string; age: number; breed: string }>): Promise<Cat> {
    await this.findOne(id); // 确保存在
    return this.repo.update(id, data);
  }

  async softDelete(id: number): Promise<Cat> {
    await this.findOne(id);
    return this.repo.softDelete(id);
  }

  async findDeleted(): Promise<Cat[]> {
    return this.repo.findDeleted();
  }

  async transferCat(catId: number, fromUserId: number, toUserId: number) {
    return this.repo.transferOwnership(catId, fromUserId, toUserId);
  }
}
