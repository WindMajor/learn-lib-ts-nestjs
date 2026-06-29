import { PartialType, OmitType } from "@nestjs/swagger";
import { CreateCatDto } from "./create-cat.dto";

/**
 * WHAT: UpdateCatDto——基于 CreateCatDto 的所有字段变为可选
 *
 * WHY: PartialType() 来自 @nestjs/swagger，它做了两件事：
 *   1. 继承 CreateCatDto 的所有字段
 *   2. 给每个字段加上 @IsOptional() 装饰器
 *   3. 保留所有验证规则（@IsString/@IsInt 等）
 *   4. 同时为 Swagger 生成正确的文档
 *
 * 【核心原理——PartialType 的魔法】
 *   PartialType 使用 TypeScript 的 mixin 模式：
 *   function PartialType<T>(classRef: Type<T>): Type<Partial<T>> {
 *     class PartialClass extends classRef {}
 *     // 动态修改装饰器元数据——给所有字段加 @IsOptional()
 *     // 具体实现涉及 Reflect.defineMetadata 操作
 *     return PartialClass;
 *   }
 *
 * 【对比 TypeScript 原生 Partial】
 *   TS 的 Partial<CreateCatDto> 只在编译期为类型标记可选——
 *   运行期验证没有任何变化（name 仍然会被 class-validator 标记为必填）。
 *   NestJS 的 PartialType() 在运行期也修改了装饰器——
 *   这就是为什么"TS 的 Partial 不够——你还需要运行期 Partial"。
 *
 * 【对比 FastAPI(Pydantic)】
 *   Pydantic 不需要 PartialType——Python 的 Optional[...] = None
 *   在运行时也会被正确解析。Python 的 type hints 天然有运行时表示。
 *
 * 【对比 Go】
 *   Go 的 struct 不可变——不能"基于一个 struct 创建部分可选的版本"。
 *   通常做法：指针类型表示可选 *string，或定义独立的 Update dto。
 *
 * WARNING: PartialType 来自 @nestjs/swagger，如果不用 Swagger 可以：
 *   - 手动用 @IsOptional() 装饰每个字段
 *   - 或使用 @nestjs/mapped-types 包的 PartialType（不依赖 Swagger）
 */

// UpdateCatDto: 所有字段可选（用于 PATCH）
// 排除 id 字段（id 来自 URL 参数，不应该在请求体中修改）
export class UpdateCatDto extends PartialType(
  OmitType(CreateCatDto, [] as const),
) {}
