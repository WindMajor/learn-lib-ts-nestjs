import {
  Controller, Get, Post, Patch, Param, Body,
  ParseIntPipe, Logger, HttpCode, HttpStatus, ValidationPipe,
} from "@nestjs/common";
import { CatsService, Cat } from "./cats.service";
import { CreateCatDto } from "./dto/create-cat.dto";
import { UpdateCatDto } from "./dto/update-cat.dto";
import { CreateCatWithOwnerDto } from "./dto/owner.dto";
import { Type, ValidateNested } from "class-validator";
import { IsArray } from "class-validator";

/**
 * WHAT: 批量创建请求体——数组 DTO
 *
 * 【核心原理——@ValidateNested({ each: true })】
 *   当 DTO 是一个数组时，需要 { each: true } 告诉 class-validator：
 *   "对数组中的每个元素单独执行验证，而不是对整个数组验证"
 *
 *   不加 { each: true } → validate() 检查数组本身 → 不会验证元素
 *   加上 { each: true } → validate() 递归检查每个元素
 *
 * 【对比 FastAPI(Pydantic)】
 *   Pydantic: List[CatCreate] —— 类型系统自动知道是数组，自动递归验证
 *   NestJS 需要显式 { each: true } —— 因为 class-validator 不是类型系统的一部分
 */
class BulkCreateCatDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateCatDto)
  cats!: CreateCatDto[];
}

@Controller("cats")
export class CatsController {
  constructor(private readonly catsService: CatsService) {}
  private readonly logger = new Logger(CatsController.name);

  @Get()
  findAll(): Cat[] {
    return this.catsService.findAll();
  }

  @Get(":id")
  findOne(@Param("id", ParseIntPipe) id: number): Cat {
    return this.catsService.findOne(id);
  }

  /**
   * WHAT: POST /cats —— 基础创建（单层 DTO）
   * 全局 ValidationPipe 自动验证 CreateCatDto
   */
  @Post()
  @HttpCode(HttpStatus.CREATED)
  create(@Body() dto: CreateCatDto): Cat {
    this.logger.log(`POST /cats name=${dto.name}`);
    return this.catsService.create(dto);
  }

  /**
   * WHAT: POST /cats/with-owner —— 嵌套 DTO 验证
   *
   * 【测试方法】
   * curl -X POST http://localhost:3000/cats/with-owner \
   *   -H "Content-Type: application/json" \
   *   -d '{"name":"小白","breed":"英短","owner":{"name":"张三","email":"zhang@test.com"}}'
   *
   * 发送无效邮箱 → 验证错误，返回类似：
   * { "statusCode": 400, "message": ["owner.email: 主人邮箱格式不正确"] }
   *
   * WARNING: 如果忘记 @Type(() => OwnerDto)，嵌套对象不会被转为 class 实例
   *   → @ValidateNested() 不会工作 → 验证被绕过 → 危险的静默错误
   */
  @Post("with-owner")
  @HttpCode(HttpStatus.CREATED)
  createWithOwner(@Body() dto: CreateCatWithOwnerDto) {
    this.logger.log(`POST /cats/with-owner name=${dto.name}`);
    return this.catsService.createWithOwner(dto);
  }

  /**
   * WHAT: PATCH /cats/:id —— 部分更新（Partial DTO）
   *
   * PartialType 保证所有字段可选——前端可以只传要更新的字段
   *
   * 【对比 Spring】Spring 的 @PatchMapping 通常与 @Valid 配合
   * 【对比 Express】Express 需要手动检查 req.body 的字段
   */
  @Patch(":id")
  update(
    @Param("id", ParseIntPipe) id: number,
    @Body() dto: UpdateCatDto,
  ): Cat {
    this.logger.log(`PATCH /cats/${id}`);
    return this.catsService.update(id, dto);
  }

  /**
   * WHAT: POST /cats/bulk —— 批量创建（数组验证）
   *
   * @ValidateNested({ each: true }) + @Type(() => CreateCatDto) 保证
   * 数组中的每个元素都经过完整的 DTO 验证
   *
   * 【测试方法】发送包含无效元素的数组 → 整个请求被拒绝（原子性）
   */
  @Post("bulk")
  @HttpCode(HttpStatus.CREATED)
  bulkCreate(@Body() dto: BulkCreateCatDto): Cat[] {
    this.logger.log(`POST /cats/bulk count=${dto.cats.length}`);
    return this.catsService.bulkCreate(dto.cats);
  }
}
