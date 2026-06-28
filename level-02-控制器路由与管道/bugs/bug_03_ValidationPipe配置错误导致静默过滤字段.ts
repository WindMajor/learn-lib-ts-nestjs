/**
 * ================================================================
 * BUG #03: ValidationPipe 的 whitelist:true 导致字段静默丢失
 * ================================================================
 *
 * 【错误类型】运行期数据丢失——编译通过，无错误，但字段不见了
 *
 * 【真实表现】
 *   前端发送 { name: "小白", age: 2, breed: "波斯猫", color: "白色" }
 *   后端 Controller 收到的 DTO 中 color 字段消失了（被 whitelist 过滤）
 *   没有任何错误信息！
 *
 * 【为什么会这样】
 *   ValidationPipe 的 whitelist: true 会：
 *   1. 读取 DTO 类上所有 class-validator 装饰器标记的字段
 *   2. 生成"白名单"：[name, age, breed]
 *   3. 从请求体中删除不在白名单中的字段（color 被删除）
 *   4. 把过滤后的对象传给 Controller
 *
 *   这是安全特性！
 *   但不了解的开发者会误认为是 NestJS 的 bug。
 *
 *   如果你设置 forbidNonWhitelisted: true：
 *   → 存在非白名单字段时直接抛出 400 Bad Request
 *   → 对前端更友好（明确告诉前端"color 不是有效字段"）
 *
 * 【权衡】
 *   - whitelist: true（静默过滤）：后端安全，前端困惑
 *   - forbidNonWhitelisted: true（报错）：前端友好，但多一个错误检查
 *   - 都设为 false：不校验字段——不安全
 *
 *   NestJS 推荐 whitelist: true + forbidNonWhitelisted: true
 *
 * 【在 Express/Spring/Go 中对应的行为】
 *   - Express: 没有自动过滤，前端传啥后端收啥（不安全！）
 *   - Spring:  @RequestBody 默认不丢弃未知字段，需要 @JsonIgnoreProperties 显式配置
 *   - Go Gin:  ShouldBindJSON 默认忽略未知字段，不报错
 *   - FastAPI: Pydantic 默认也丢弃未知字段，但可以配置 extra = "forbid"
 *
 * 【如何修复】
 *   new ValidationPipe({
 *     whitelist: true,              // 过滤非 DTO 字段
 *     forbidNonWhitelisted: true,   // 存在非 DTO 字段时报错
 *     transform: true,              // 启用类型转换
 *   })
 *
 *   // 或者在 DTO 层面允许额外字段：
 *   // @Allow() extraFields: any;
 */

import { IsString, IsInt } from "class-validator";

export class CreateCatDto {
  @IsString() name!: string;
  @IsInt() age!: number;
  @IsString() breed!: string;
  // 没有 color 字段！
}

// 传入的请求体：
// {
//   "name": "小白",
//   "age": 2,
//   "breed": "波斯猫",
//   "color": "白色",      ← whitelist: true → 被静默丢弃！
//   "isAdmin": true       ← 安全漏洞！攻击者可以传入任意字段
// }

// 修复方案 1: 全局配置 forbidNonWhitelisted
// new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true })

// 修复方案 2: 在 DTO 中显式声明允许的额外字段
// export class CreateCatDto {
//   @IsString() name!: string;
//   @IsInt() age!: number;
//   @IsString() breed!: string;
//   @IsOptional() @IsString() color?: string;  // 显式声明可选字段
// }

console.log("BUG #03: 检查你的 ValidationPipe 配置!");
console.log("确保 whitelist + forbidNonWhitelisted 同时启用");
