import { Injectable, NestInterceptor, ExecutionContext, CallHandler } from "@nestjs/common";
import { Observable } from "rxjs";
import { map } from "rxjs/operators";

/**
 * WHAT: 统一响应拦截器——所有成功响应封装为 { code:0, data, message }
 * 与 AllExceptionsFilter 配合：成功走 Interceptor，失败走 Filter
 */
@Injectable()
export class TransformInterceptor implements NestInterceptor {
  intercept(_ctx: ExecutionContext, next: CallHandler): Observable<any> {
    return next.handle().pipe(
      map((data) => {
        if (data?.code !== undefined) return data; // 已包装过（如 ExceptionFilter 的响应）
        return { code: 0, data, message: "success", timestamp: new Date().toISOString() };
      }),
    );
  }
}
