import { IsString, IsInt, Min, Max, MinLength, MaxLength } from "class-validator";
import { IsCatBreed } from "../../common/decorators/is-cat-breed.validator";

/**
 * WHAT: CreateCatDto——基础 DTO，包含完整的字段验证
 *
 * 【最佳实践——DTO 应该尽量"窄"】
 *   一个 API 端点对应一个 DTO，而不是多个端点共享同一个大 DTO。
 *   Create 和 Update 的字段约束不同（Create 中 name 必填，Update 中可选），
 *   所以需要用不同的 DTO 或 PartialType 派生。
 *
 * 【对比 FastAPI(Pydantic)】
 *   Pydantic 可以通过继承 + Optional 描述不同场景：
 *   class CatBase(BaseModel): breed: str
 *   class CatCreate(CatBase): name: str
 *   class CatUpdate(CatBase): name: Optional[str] = None
 *   思路与 NestJS 的 PartialType 是一致的设计
 */
export class CreateCatDto {
  @IsString({ message: "猫名必须是字符串" })
  @MinLength(1)
  @MaxLength(50)
  name!: string;

  @IsInt({ message: "年龄必须是整数" })
  @Min(0)
  @Max(30)
  age!: number;

  @IsString()
  @MinLength(1)
  @IsCatBreed({ message: "未知的猫品种——请检查品种列表" })
  breed!: string;
}
