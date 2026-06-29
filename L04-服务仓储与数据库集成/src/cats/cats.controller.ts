import {
  Controller, Get, Post, Patch, Delete, Param, Body,
  ParseIntPipe, HttpCode, HttpStatus, Logger,
} from "@nestjs/common";
import { CatsService } from "./cats.service";
import { CreateCatDto } from "./dto/create-cat.dto";
import { UpdateCatDto } from "./dto/update-cat.dto";
// WHAT: Cat 类型从 Drizzle ORM 推导，此处用于返回值标注
// WHY: Drizzle 不生成 Client，类型直接从 schema.ts 的 $inferSelect 推导
import type { cats } from "../db/schema";
type Cat = typeof cats.$inferSelect;

@Controller("cats")
export class CatsController {
  constructor(private readonly svc: CatsService) {}
  private readonly logger = new Logger(CatsController.name);

  @Get()
  findAll(): Promise<Cat[]> {
    return this.svc.findAll();
  }

  @Get("deleted")
  findDeleted(): Promise<Cat[]> {
    return this.svc.findDeleted();
  }

  @Get(":id")
  findOne(@Param("id", ParseIntPipe) id: number): Promise<Cat> {
    return this.svc.findOne(id);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  create(@Body() dto: CreateCatDto): Promise<Cat> {
    this.logger.log(`创建猫: ${dto.name}`);
    return this.svc.create(dto);
  }

  @Patch(":id")
  update(
    @Param("id", ParseIntPipe) id: number,
    @Body() dto: UpdateCatDto,
  ): Promise<Cat> {
    return this.svc.update(id, dto);
  }

  /**
   * WHAT: DELETE /cats/:id → 软删除，而非物理删除
   * 【对比 Express】Express 的 DELETE 通常物理删除记录
   */
  @Delete(":id")
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(@Param("id", ParseIntPipe) id: number): Promise<void> {
    await this.svc.softDelete(id);
  }

  /**
   * WHAT: POST /cats/transfer → 事务示例
   */
  @Post("transfer")
  async transfer(
    @Body() body: { catId: number; fromUserId: number; toUserId: number },
  ) {
    await this.svc.transferCat(body.catId, body.fromUserId, body.toUserId);
    return { message: "转移成功" };
  }
}
