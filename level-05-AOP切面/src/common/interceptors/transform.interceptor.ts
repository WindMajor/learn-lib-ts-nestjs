import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from "@nestjs/common";
import { Observable } from "rxjs";
import { map } from "rxjs/operators";

/**
 * WHAT: TransformInterceptor——统一响应格式封装
 *
 * 【核心原理——用 map() 操作符转换响应】
 *   业务 Controller 返回任意数据（object/array/string），
 *   这个 Interceptor 拦截并在响应发出前统一封装为：
 *   {
 *     code: 0,
 *     data: <原始返回值>,
 *     message: "success",
 *     timestamp: "2024-..."
 *   }
 *
 *   前端的收益：
 *   - 所有 API 返回一致的格式 → 前端只需要一个响应拦截器处理所有情况
 *   - 业务错误码通过 code 区分（0=成功, 1xxx=参数错误, 2xxx=业务错误...）
 *   - 分页数据、列表数据都有统一的结构
 *
 * 【对比 Spring Boot】
 *   Spring 通常用 ResponseBodyAdvice 实现统一响应：
 *   @RestControllerAdvice
 *   class ResponseAdvice implements ResponseBodyAdvice<Object> {
 *     beforeBodyWrite(Object body, ...) {
 *       return Result.success(body); // 统一包装
 *     }
 *   }
 *   与 NestJS Interceptor 的理念一致——在响应发出前拦截并包装。
 *
 * 【对比 Go Gin】
 *   Go 通常用中间件或手动封装：
 *   c.JSON(200, gin.H{"code": 0, "data": result})
 *   没有自动包装机制——每个接口需要手动写响应格式。
 *
 * 【对比 FastAPI】
 *   FastAPI 天生返回 JSON（通过 response_model），
 *   但统一格式还是需要手动包装，或通过依赖注入的 response wrapper。
 *
 * WARNING:
 *   - map() 修改响应数据——如果你在 map() 中返回 null → 客户端收到 null
 *   - 对于文件下载/流式响应 → 不能使用此 Interceptor（文件会被包装成 JSON）
 *     解决方案：用 @UseInterceptors() 排除特定端点，
 *     或检查响应的 content-type 决定是否包装
 */
@Injectable()
export class TransformInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    return next.handle().pipe(
      map((data) => {
        // WHAT: 检查是否已经是包装过的响应（避免双重包装）
        // 场景：ExceptionFilter 已经返回了统一格式的错误响应
        if (data && data.code !== undefined) {
          return data; // 已经是统一格式，不重复包装
        }

        return {
          code: 0,
          data,
          message: "success",
          timestamp: new Date().toISOString(),
        };
      }),
    );
  }
}
