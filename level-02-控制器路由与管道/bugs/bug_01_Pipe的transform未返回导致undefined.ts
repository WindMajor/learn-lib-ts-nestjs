/**
 * ================================================================
 * BUG #01: Pipe 的 transform() 未返回 → Controller 收到 undefined
 * ================================================================
 *
 * 【错误类型】运行期逻辑错误——无异常，但数据丢失
 *
 * 【真实表现】
 *   应用正常启动，没有任何错误日志。
 *   但 Controller 的参数一直是 undefined，导致后续逻辑全部出错。
 *
 * 【为什么会这样】
 *   NestJS 的请求管线在处理参数时：
 *   1. 提取原始值（如 URL 参数 'breed' = '波斯猫'）
 *   2. 依次执行 Pipeline 中的 Pipe.transform(value, metadata)
 *   3. 将最终返回值赋给 Controller 参数
 *
 *   如果某个 Pipe 的 transform() 没有 return：
 *   → 它的返回值是 undefined
 *   → NestJS 把 undefined 作为参数值传给 Controller
 *   → Controller 收到 undefined → 后续处理全部出错
 *
 * 【在 Express/Spring/Go/Rust 中对应的行为】
 *   - Express: 不存在 Pipe 概念，自然不会出现这个问题
 *   - Spring:  Converter 必须返回非空值，否则编译警告
 *   - Go:      如果返回值没有赋值，编译器报错 "not enough arguments to return"
 *   - Rust:    所有分支必须有返回值，否则编译错误——Rust 的类型系统防止了这个问题
 *
 * 【对比分析】这是 NestJS 的"隐式返回值"问题。
 *   由于 JavaScript 函数默认返回 undefined，忘了写 return 不会触发任何编译错误。
 *   这与 Go/Rust 形成鲜明对比——它们的编译器强制要求返回。
 *
 * 【如何修复】
 *   在 transform() 的最后一行加上 return value;
 *   或者在 Pipe 单元测试中验证返回值不为 undefined
 */

import {
  PipeTransform,
  Injectable,
  ArgumentMetadata,
} from "@nestjs/common";

@Injectable()
export class BuggyUppercasePipe implements PipeTransform<string, string> {
  transform(value: string, _metadata: ArgumentMetadata): string {
    const upper = value.toUpperCase();
    // BUG: 忘记 return！
    // 修复: return upper;
    console.log(`转换为大写: ${value} → ${upper}`);
    // 函数末尾没有 return → 隐式返回 undefined
  }
}

// ============================================================
// 修复后的代码
// ============================================================
/*
@Injectable()
export class FixedUppercasePipe implements PipeTransform<string, string> {
  transform(value: string, _metadata: ArgumentMetadata): string {
    return value.toUpperCase(); // ← 必须 return！
  }
}
*/
