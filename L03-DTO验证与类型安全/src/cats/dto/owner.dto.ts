/**
 * WHAT: OwnerDto——猫主人的 DTO
 *
 * 【核心概念——为什么需要 @Type(() => OwnerDto)】
 *   class-transformer 在处理嵌套对象时需要知道目标类型。
 *   由于 TypeScript 的类型信息在编译后丢失，必须通过 @Type() 装饰器显式指定。
 *
 *   【对比 FastAPI(Pydantic)】
 *     Pydantic: class Owner(BaseModel): name: str
 *     class CreateCatDto(BaseModel): owner: Owner
 *     Python 的 type hints 在运行时保留 → Pydantic 自动知道嵌套类型
 *
 *   【对比 Go】
 *     Go: type OwnerDto struct { Name string `json:"name"` }
 *     类型在编译后就确定了，不需要额外装饰器
 *
 *   WARNING: 忘记 @Type(() => OwnerDto) → class-transformer 会把嵌套对象保持为 plain object
 *     → @ValidateNested() 不会工作（它需要 class 实例才能验证装饰器）
 *     → 验证被绕过！这是最危险的 bug——你以为是安全的，其实验证完全没执行。
 */
import { IsString, IsEmail, IsOptional, MinLength } from "class-validator";
import { Type } from "class-transformer";

export class OwnerDto {
  @IsString()
  @MinLength(1)
  name!: string;

  @IsEmail({}, { message: "主人邮箱格式不正确" })
  email!: string;

  @IsOptional()
  @IsString()
  phone?: string;
}

/**
 * WHAT: CreateCatWithOwnerDto——含嵌套对象的 DTO
 *
 * 【核心原理——@ValidateNested 的工作机制】
 *   1. class-transformer 遇到 @Type(() => OwnerDto) → plainToInstance(OwnerDto, nestedObject)
 *   2. class-validator 遇到 @ValidateNested() → 对嵌套实例递归执行 validate()
 *   3. 如果嵌套实例验证失败 → 错误信息包含嵌套路径（如 owner.email: "格式不正确"）
 *
 *   【对比 Spring】
 *     Spring: @Valid private OwnerDto owner;  — 语法几乎一样
 *     差异：Spring 的 @Valid 递归验证默认只对集合类型，单对象需要用 @Valid
 *
 *   WARNING:
 *     - @Type() 和 @ValidateNested() 必须配套使用，缺一不可
 *     - 如果嵌套对象可能是 null/undefined → 需要 @IsOptional() 或 @ValidateIf()
 */
export class CreateCatWithOwnerDto {
  @IsString()
  name!: string;

  @IsString()
  breed!: string;

  @ValidateNested()
  @Type(() => OwnerDto)
  owner!: OwnerDto;
}
