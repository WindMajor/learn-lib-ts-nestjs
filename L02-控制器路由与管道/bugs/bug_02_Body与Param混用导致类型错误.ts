/**
 * ================================================================
 * BUG #02: @Body() 与 @Param() 参数提取器混用导致类型错误
 * ================================================================
 *
 * 【错误类型】运行期类型不匹配——编译通过，但运行时逻辑错误
 *
 * 【场景】
 *   开发者想把 URL 参数 merge 到请求体中一起处理，
 *   但搞混了 @Body() 和 @Param() 的来源：
 *
 *   @Post(':id')
 *   update(@Body() body: CreateCatDto, @Param('id') id: number) {
 *     // body 只包含 { name, age, breed }
 *     // id 需要手动合并
 *     return { ...body, id };
 *   }
 *
 *   ❌ 错误写法：
 *   @Post(':id')
 *   update(@Body() body: CreateCatDto & { id: number }) {
 *     // body.id 永远是 undefined！
 *     // 因为 @Body() 只从请求体 JSON 中提取数据
 *     // URL 参数 :id 不在请求体中！
 *   }
 *
 * 【真实错误信息】
 *   不会有编译错误或运行时异常。但 body.id 始终是 undefined。
 *   如果后续代码依赖 body.id → 可能出现 "Cannot read property 'xxx' of undefined"
 *   或者更隐蔽的：数据被静默设置为 undefined → 数据库写入失败 → 查半天
 *
 * 【为什么会这样】
 *   @Body() 装饰器告诉 NestJS："从这个参数读取请求体"
 *   @Param() 装饰器告诉 NestJS："从这个参数读取 URL 路径参数"
 *   它们是不同的数据来源，互不干扰。
 *
 *   当你写 @Body() body: CreateCatDto & { id: number } 时：
 *   - NestJS 只从 request.body 提取数据
 *   - request.body 是一个 JSON 对象（来自请求体的 JSON.parse）
 *   - URL 参数不在这 JSON 里
 *   - 所以 body.id = undefined
 *
 * 【在 Express/Spring/Go/FastAPI 中对应的行为】
 *   - Express:  你手动处理，不太可能搞混——因为都是 req.xxx
 *   - Spring:   @RequestBody + @PathVariable 严格区分，IDEA 会提示
 *   - Go Gin:   c.ShouldBindJSON(&dto) 和 c.Param("id") 是不同调用
 *   - FastAPI:  Python 的参数注解明确区分 Path() 和 Body()
 *
 * 【如何修复】
 *   方案 1: 分别提取，然后合并
 *     @Post(':id')
 *     update(@Body() dto: CreateCatDto, @Param('id', ParseIntPipe) id: number) {
 *       const cat = { id, ...dto };
 *     }
 *
 *   方案 2: 使用 DTO 扩展
 *     export class UpdateCatDto extends CreateCatDto {
 *       @IsInt() id!: number;
 *     }
 *     但仍然需要在 Controller 中手动设置 id
 *
 *   方案 3: 自定义装饰器 + Pipe（Level 07 详讲）
 *     @Post(':id')
 *     update(@MergedParams() dto: UpdateCatDto) { ... }
 */

import {
  Controller, Post, Param, Body, ParseIntPipe,
} from "@nestjs/common";
import { IsString, IsInt } from "class-validator";

class CreateCatDto {
  @IsString() name!: string;
  @IsInt() age!: number;
  @IsString() breed!: string;
}

@Controller("cats")
export class BuggyController {
  // BUG: 混淆了 Body 和 Param 的数据来源
  @Post(":id")
  update(
    // ❌ 错误：@Body() 只会从请求体 JSON 中提取 id 字段
    //    如果 JSON 中没有 id → body.id = undefined
    @Body() body: CreateCatDto & { id: number },
  ) {
    console.log(`body.id = ${body.id}`); // 永远是 undefined！
    console.log(`参数来自 URL 的 :id 不在 @Body() 中`);
    // 修复：应该单独提取 @Param('id', ParseIntPipe) id: number
    return body;
  }
}

// ============================================================
// 修复后的代码
// ============================================================
/*
@Controller("cats")
export class FixedController {
  @Post(":id")
  update(
    @Body() body: CreateCatDto,
    @Param("id", ParseIntPipe) id: number,  // ← 单独提取 URL 参数
  ) {
    console.log(`id=${id}, body=${JSON.stringify(body)}`);
    return { id, ...body };
  }
}
*/
