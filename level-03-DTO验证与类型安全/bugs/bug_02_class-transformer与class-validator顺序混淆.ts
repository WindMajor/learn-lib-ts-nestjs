/**
 * ================================================================
 * BUG #02: class-transformer 的转换与 class-validator 的验证顺序混淆
 * ================================================================
 *
 * 【错误类型】运行期验证失败或意外的类型转换
 *
 * 【场景】开发者想用 @Transform() 在验证前对值做预处理，
 *   但误解了 ValidationPipe 中 transform 和 validate 的执行顺序。
 *
 * 【真实的执行顺序】
 *   ValidationPipe.transform(value, metadata):
 *   1. plainToInstance(DtoClass, value)  —— class-transformer 转换
 *      （执行 @Type()、@Transform()、@Expose()、@Exclude() 等）
 *   2. validate(instance)  —— class-validator 验证
 *      （执行 @IsString()、@IsInt()、@Min()、自定义验证器等）
 *
 *   这意味着：
 *   - @Transform() 在 @IsString() 之前执行！
 *   - 如果你用 @Transform() 把值转为 string，@IsString() 会通过
 *   - 如果你用 @Transform() 把值转为 number，@IsInt() 会通过
 *
 * 【常见陷阱】
 *   1. 在 @Transform() 中做了类型转换，但忘记改 @IsString() → @IsInt()
 *      → 值已经被转为 number，但验证器还在检查 string → 验证失败
 *   2. 顺序写反了——以为先验证再转换
 *      → 其实是先转换（class-transformer）再验证（class-validator）
 *
 * 【Memory aid】
 *   transform → validate
 *   class-transformer → class-validator
 *   先转换，后验证。顺序反了不出错，只是逻辑不对。
 *
 * 【对比 FastAPI(Pydantic)】
 *   Pydantic 的 validator 和类型转换是同一过程——先转换(coerce)再验证
 *   如 int 字段接收 '2' → 自动转为 2(int) → 检查 int 约束
 *   不像 NestJS 分成两个库来处理
 */

import { Transform, Type } from "class-transformer";
import { IsInt, IsString, Min } from "class-validator";

class BuggyDto {
  // BUG: @Transform 把值转了类型，但 @IsString() 仍然检查 string
  // 执行顺序：TransformNumber → IsString（失败！因为值已经是 number）
  @Transform(({ value }) => parseInt(value, 10))
  @IsString() // ← 这里会失败！值已经被 parse 成 number 了
  // 修复：@IsInt()
  age!: number;
}

// 正确写法
/*
class FixedDto {
  @Transform(({ value }) => parseInt(value, 10))
  @IsInt()
  @Min(0)
  age!: number;
}
*/

console.log("BUG: class-transformer 先于 class-validator 执行");
console.log("修复：确保 @Transform 后的类型与验证器匹配");
