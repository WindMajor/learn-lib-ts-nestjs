/**
 * ================================================================
 * BUG #01: 忘记 @Type(() => NestedDto) → 嵌套验证被完全绕过
 * ================================================================
 *
 * 【错误类型】运行期验证失败——无编译错误、无运行时异常，但验证被完全跳过
 * 
 * 【危险性】极高！这是 NestJS DTO 验证中最隐蔽的安全漏洞。
 *   你以为嵌套对象已经经过验证 → 实际上完全没有！
 *   攻击者可以传入任意嵌套数据 → 直接写入数据库。
 *
 * 【为什么会这样】
 *   class-transformer 的 plainToInstance() 在处理嵌套对象时：
 *   1. 遇到 owner: { name: "张三", email: "invalid" } — 这是 plain object
 *   2. 如果没有 @Type(() => OwnerDto) → class-transformer 不知道要转为 OwnerDto
 *   3. owner 保持为 plain object，不是 OwnerDto 实例
 *   4. class-validator 的 @ValidateNested() 遇到 plain object
 *      → 找不到任何装饰器元数据
 *      → 直接返回 true（验证通过！）
 *
 *   【对比 Rust】Rust 的 serde 在编译期就知道嵌套类型，不会出现这个问题
 *   【对比 Go】Go 的 struct tag 验证也是运行期的，但嵌套 struct 的类型是编译期确定的
 *
 * 【如何修复】
 *   加上 @Type(() => OwnerDto) + @ValidateNested()
 *
 *   正确写法：
 *   @ValidateNested()
 *   @Type(() => OwnerDto)  // ← 这一行必不可少！
 *   owner: OwnerDto;
 */

import { IsString, IsEmail } from "class-validator";
import { ValidateNested } from "class-validator";

// 正确：有 @Type()
// import { Type } from "class-transformer";

class OwnerDto {
  @IsString() name!: string;
  @IsEmail() email!: string;
}

class BuggyDto {
  @IsString() name!: string;

  // BUG: 只有 @ValidateNested()，没有 @Type(() => OwnerDto)！
  //     → 嵌套对象不会被转为 OwnerDto 实例
  //     → 验证不会执行
  //     → 任何数据都能通过
  @ValidateNested()
  // @Type(() => OwnerDto)  ← 取消注释即可修复
  owner!: OwnerDto;
}

// 修复后的代码:
/*
class FixedDto {
  @IsString() name!: string;

  @ValidateNested()
  @Type(() => OwnerDto)
  owner!: OwnerDto;
}
*/

console.log("BUG: 缺少 @Type() → 嵌套验证被静默绕过！");
