import { ExceptionFilter, Catch, ArgumentsHost, HttpException, HttpStatus, Logger } from "@nestjs/common";
import { Request, Response } from "express";

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let message = "服务器内部错误";

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const exRes = exception.getResponse();
      message = typeof exRes === "string" ? exRes : (exRes as any).message || exception.message;
      if (status >= 500) this.logger.error(`🔥 ${status} ${request.url}`, exception instanceof Error ? exception.stack : "");
    } else if (exception instanceof Error) {
      this.logger.error(`💥 ${exception.message}`, exception.stack);
      message = exception.message;
    }

    if (status >= 500 && process.env.NODE_ENV === "production") {
      message = "服务器内部错误，请稍后重试";
    }

    response.status(status).json({
      code: status, data: null,
      message: Array.isArray(message) ? message.join("; ") : message,
      timestamp: new Date().toISOString(), path: request.url,
    });
  }
}
