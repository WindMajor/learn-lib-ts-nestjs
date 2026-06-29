/**
 * ================================================================
 * BUG #02: ExceptionFilter 未捕获特定异常 → 返回 500 而非预期状态码
 * ================================================================
 *
 * 【错误类型】异常处理不当——前端收到 500 但实际应该是 404/400
 *
 * 【真实表现】
 *   - Controller 抛出 NotFoundException → 期望前端收到 404
 *   - 但 ExceptionFilter 的 catch() 中使用了默认的 500 状态码
 *   - 前端收到 500 Internal Server Error → 误导了前端错误处理
 *
 * 【为什么会这样】
 *   ExceptionFilter 中写死 status = 500：
 *   let status = 500;
 *   // 忘记检查 exception 是否 instanceof HttpException
 *   response.status(status).json({...});
 *
 * 【正确的 ExceptionFilter 应该做的事】
 *   1. 检查 exception 类型:
 *      - HttpException → 取其 status + message
 *      - 其他 Error → 500 + 隐藏错误细节
 *   2. 记录 5xx 异常（需要告警）
 *   3. 不泄露内部错误细节给前端
 *
 * 【对比 Spring】
 *   Spring 的 @ExceptionHandler 自动处理类型匹配，不会出现这个问题：
 *   @ExceptionHandler(NotFoundException.class) → 自动 404
 *   @ExceptionHandler(Exception.class) → 自动 500
 *
 * 【对比 Go Gin】
 *   Gin 的 c.AbortWithError 也有类似问题——需要手动设置状态码
 *
 * 【如何修复】
 *   if (exception instanceof HttpException) {
 *     status = exception.getStatus();
 *   }
 */

import { ExceptionFilter, Catch, ArgumentsHost } from "@nestjs/common";

@Catch()
class BuggyExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse();

    // BUG: 状态码写死 500！
    const status = 500;

    // 修复：根据 exception 类型动态设置
    // const status = exception instanceof HttpException
    //   ? exception.getStatus()
    //   : 500;

    response.status(status).json({
      code: status,
      message: exception instanceof Error ? exception.message : "未知错误",
    });
  }
}

console.log("BUG: 所有异常都返回 500——需要根据异常类型设置状态码");
