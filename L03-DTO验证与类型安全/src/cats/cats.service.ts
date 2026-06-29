import { Injectable, Logger, NotFoundException } from "@nestjs/common";
import { CreateCatDto } from "./dto/create-cat.dto";
import { UpdateCatDto } from "./dto/update-cat.dto";
import { CreateCatWithOwnerDto } from "./dto/owner.dto";

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
  ];
  private nextId = 3;

  findAll(): Cat[] {
    return this.cats;
  }

  findOne(id: number): Cat {
    const cat = this.cats.find((c) => c.id === id);
    if (!cat) throw new NotFoundException(`猫 id=${id} 不存在`);
    return cat;
  }

  create(dto: CreateCatDto): Cat {
    const cat: Cat = { id: this.nextId++, ...dto };
    this.cats.push(cat);
    this.logger.log(`创建猫: ${cat.name}`);
    return cat;
  }

  /**
   * WHAT: 创建猫 + 主人——演示嵌套 DTO 的使用
   * WHY: Controller 接收 CreateCatWithOwnerDto（含嵌套 OwnerDto），
   *   验证通过后，Service 只需使用已验证的数据
   */
  createWithOwner(dto: CreateCatWithOwnerDto): {
    cat: Cat;
    owner: { name: string; email: string; phone?: string };
  } {
    const cat: Cat = {
      id: this.nextId++,
      name: dto.name,
      age: 0, // 这个端点不传年龄
      breed: dto.breed,
    };
    this.cats.push(cat);
    this.logger.log(`创建猫+主人: ${cat.name} → ${dto.owner.name}`);
    return { cat, owner: dto.owner };
  }

  update(id: number, dto: UpdateCatDto): Cat {
    const cat = this.findOne(id);
    // PartialType 保证了 dto 所有字段可选——只更新传入的字段
    Object.assign(cat, dto);
    this.logger.log(`更新猫 id=${id}`);
    return cat;
  }

  /**
   * WHAT: 批量创建——演示数组验证 @ValidateNested({ each: true })
   */
  bulkCreate(dtos: CreateCatDto[]): Cat[] {
    const created = dtos.map((dto) => ({
      id: this.nextId++,
      ...dto,
    }));
    this.cats.push(...created);
    this.logger.log(`批量创建 ${created.length} 只猫`);
    return created;
  }
}
