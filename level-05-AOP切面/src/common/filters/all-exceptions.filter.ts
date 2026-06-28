import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from "@nestjs/common";
import { Request, Response } from "express";

/**
 * WHAT: AllExceptionsFilter——全局异常过滤器，捕获所有异常
 *
 * 【核心原理——ExceptionFilter 接口】
 *   interface ExceptionFilter {
 *     catch(exception: unknown, host: ArgumentsHost): void;
 *   }
 *
 *   - 拦截所有 throw（包括 NestJS 内置异常和你自定义的业务异常）
 *   - 统一响应格式 → 前端只需处理一种错误格式
 *
 * 【为什么 @Catch() 为空？】
 *   @Catch() 不传参数 → 捕获所有异常
 *   @Catch(HttpException) → 只捕获 HttpException 及其子类
 *   @Catch(TypeError) → 只捕获 TypeError
 *
 *   你可以注册多个 ExceptionFilter：
 *   - AllExceptionsFilter（兜底，捕获所有）
 *   - HttpExceptionFilter（处理 HTTP 异常，返回友好错误）
 *   - PrismaExceptionFilter（处理数据库异常，隐藏内部细节）
 *
 * 【AOP 执行顺序——ExceptionFilter 在哪？】
 *   Guard → Interceptor(前) → Pipe → Controller → Interceptor(后) → ExceptionFilter(如果有异常)
 *
 *   ExceptionFilter 在异常发生后执行。
 *   如果 Interceptor 的 pipe() 中有 catchError()，它会在 ExceptionFilter 之前捕获异常。
 *
 * 【对比 Express】
 *   Express 的全局错误处理器：
 *   app.use((err, req, res, next) => {
 *     res.status(500).json({ error: err.message });
 *   });
 *   功能相似，但 NestJS 的 ExceptionFilter 可以注入依赖（如 Logger Service），
 *   且可以按异常类型分级处理。
 *
 * 【对比 Spring】
 *   @ControllerAdvice + @ExceptionHandler ——功能几乎一致
 *   差异：Spring 的 @ExceptionHandler 可以声明返回类型（如 @ResponseStatus），
 *         NestJS 的 Filter 直接操作 Response 对象
 *
 * 【对比 Go Gin】
 *   Gin 的 Recovery 中间件 + 自定义错误处理：
 *   r.Use(gin.CustomRecovery(func(c *gin.Context, err any) {
 *     c.JSON(500, gin.H{"code": -1, "message": fmt.Sprint(err)})
 *   }))
 *
 * 【对比 Rust (Axum)】
 *   Rust 用 IntoResponse trait 统一错误处理——所有错误类型实现 IntoResponse：
 *   impl IntoResponse for AppError { fn into_response(self) -> Response { ... } }
 *   这点比 NestJS 更优雅——类型系统保证所有错误都有统一的 HTTP 表示
 *
 * WARNING:
 *   - 全局 ExceptionFilter 会"吃掉"所有异常——如果你用它返回 200 的状态码，
 *     NestJS 的默认错误处理不会触发。确保 4xx/5xx 异常返回正确的 HTTP 状态码
 *   - 在 Filter 中再次 throw → 会被 Express 的最终兜底处理器捕获
 *   - production 环境要隐藏内部错误细节（如 SQL 语句），只暴露安全的错误消息
 */
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    // 确定 HTTP 状态码
    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let message = "服务器内部错误";
    let detail: any = null;

    if (exception instanceof HttpException) {
      // WHAT: NestJS 内置异常（BadRequestException/NotFoundException 等）
      status = exception.getStatus();
      const exceptionResponse = exception.getResponse();
      message =
        typeof exceptionResponse === "string"
          ? exceptionResponse
          : (exceptionResponse as any).message || exception.message;

      // 记录 5xx 异常（需要告警）
      if (status >= 500) {
        this.logger.error(
          `🔥 [ExceptionFilter] ${status} — ${request.method} ${request.url}`,
          exception instanceof Error ? exception.stack : "",
        );
      } else {
        this.logger.warn(
          `⚠️ [ExceptionFilter] ${status} — ${request.method} ${request.url} — ${message}`,
        );
      }
    } else if (exception instanceof Error) {
      // WHAT: 非 HttpException 的错误（如 TypeError、未捕获的 Promise rejection）
      this.logger.error(
        `💥 [ExceptionFilter] 未预期的异常: ${exception.message}`,
        exception.stack,
      );
      message = exception.message;
    }

    // 统一响应格式
    const errorResponse = {
      code: status,
      data: null,
      message: Array.isArray(message) ? message.join("; ") : message,
      timestamp: new Date().toISOString(),
      path: request.url,
    };

    // 如果是 5xx 且非开发环境 → 隐藏错误细节
    if (status >= 500 && process.env.NODE_ENV === "production") {
      errorResponse.message = "服务器内部错误，请稍后重试";
    }

    response.status(status).json(errorResponse);
  }
}
