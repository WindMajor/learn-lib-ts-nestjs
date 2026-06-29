import {
  PipeTransform,
  Injectable,
  ArgumentMetadata,
  Logger,
  BadRequestException,
} from "@nestjs/common";

/**
 * WHAT: UppercasePipe——将字符串参数转为大写
 *
 * WHY: 自定义 Pipe 需要实现 PipeTransform 接口：
 *   interface PipeTransform<T = any, R = any> {
 *     transform(value: T, metadata: ArgumentMetadata): R;
 *   }
 *
 *   T = 输入类型，R = 输出类型
 *   value = 当前 Pipeline 中传递的值（经过了前一个 Pipe/参数提取器处理）
 *   metadata = 关于参数的元数据（类型、数据来源等）
 *
 * 【核心原理——Pipe 在请求管线中的位置】
 *   HTTP请求 → Middleware → Guard → Interceptor → Pipe → Controller
 *                                                    ↑
 *                                              你在这里！
 *   Pipe 在 Controller 方法执行之前运行，可以做：
 *   1. 类型转换（如 ParseIntPipe 将字符串 '1' 转为数字 1）
 *   2. 数据验证（如 ValidationPipe 检查 DTO 是否合法）
 *   3. 数据清理（如 TrimPipe 去除首尾空格）
 *   4. 数据丰富（如添加时间戳、设置默认值）
 *
 *   如果 transform() 抛出异常 → 请求终止，不再执行 Controller 方法
 *   → 异常由 ExceptionFilter 捕获处理（Level 05）
 *
 * 【对比 Express】
 *   Express 没有 Pipe 概念——你在路由处理函数中手动检查/转换参数：
 *   const breed = req.params.breed.toUpperCase();
 *   这导致了大量重复的参数验证代码。
 *   NestJS 把"参数处理"抽成可复用的 Pipe → 关注点分离。
 *
 * 【对比 Spring】
 *   Spring 的 Converter<S,T> 和 Formatter 接口类似 NestJS 的 Pipe。
 *   但 Spring 的验证用 @Valid 注解（JSR-380），NestJS 用 Pipe + class-validator。
 *
 * 【对比 Go】
 *   Go 没有内置的 Pipe 等价物——你手动写转换函数。
 *   但 Go 可以通过 middleware 实现类似效果：
 *   func UppercaseMiddleware(c *gin.Context) {
 *     breed := strings.ToUpper(c.Param("breed"))
 *     c.Set("breed", breed)
 *     c.Next()
 *   }
 *
 * WARNING: transform() 必须返回一个值！
 *   如果你忘了 return → 返回 undefined → Controller 参数变成 undefined
 *   → 这是 NestJS 中最隐蔽的 bug 之一，不会抛异常，只是数据丢失
 */
@Injectable()
export class UppercasePipe implements PipeTransform<string, string> {
  private readonly logger = new Logger(UppercasePipe.name);

  /**
   * WHAT: 核心转换逻辑
   *
   * @param value - 原始值（从 @Param() 提取的字符串）
   * @param metadata - 参数元信息
   *   metadata.type: 'body' | 'query' | 'param' | 'custom'
   *   metadata.metatype: 参数的 TS 类型（如 String, Number）
   *   metadata.data: 装饰器的参数（如 @Param('breed') 中的 'breed'）
   *
   * LIFECYCLE: 此方法在 Controller 方法执行前同步/异步执行
   */
  transform(value: string, metadata: ArgumentMetadata): string {
    this.logger.log(
      `UppercasePipe.transform() 被调用:
       value=${JSON.stringify(value)},
       type=${metadata.type},
       metatype=${metadata.metatype?.name},
       data=${metadata.data}`,
    );

    // WARNING: 永远不要忘记 return！
    // 如果这里不返回，Controller 会收到 undefined
    if (typeof value !== "string") {
      this.logger.warn(`期望 string，实际收到 ${typeof value}，保持不变`);
      return value; // 非字符串原样返回
    }

    return value.toUpperCase();
  }
}

/**
 * WHAT: OptionalIntPipe——类似 ParseIntPipe，但允许 undefined
 *
 * WHY: 内置的 ParseIntPipe 在参数缺失时抛出 400，但有时参数是可选的。
 *   这个自定义 Pipe 演示了如何处理可选参数。
 *
 * 用法：@Query('page', OptionalIntPipe) page?: number
 */
@Injectable()
export class OptionalIntPipe implements PipeTransform<string | undefined, number | undefined> {
  transform(value: string | undefined, _metadata: ArgumentMetadata): number | undefined {
    if (value === undefined || value === null) {
      return undefined; // 可选参数缺失，不报错
    }
    const parsed = parseInt(value, 10);
    if (isNaN(parsed)) {
      // 有值但格式不对 → 抛出异常
      throw new BadRequestException(
        `参数 '${value}' 不是有效的整数`,
      );
    }
    return parsed;
  }
}
