/**
 * ============================================================
 * 第 07 章：异常处理
 * ============================================================
 *
 * 【学习目标】
 *   1. 掌握 NestJS 内置异常类的分类和使用
 *   2. 理解异常结构：statusCode、message、error
 *   3. 掌握自定义异常过滤器的编写
 *   4. 掌握过滤器的作用域：方法级、控制器级、全局级
 *   5. 设计前后端统一的错误响应格式
 *
 * 【与 Express/FastAPI/Spring/Django 的对比提示】
 *   - Express：错误处理中间件（err, req, res, next），需要手动调用 next(error)
 *   - FastAPI：HTTPException + exception_handler 装饰器
 *   - Spring：@ControllerAdvice + @ExceptionHandler，与 NestJS ExceptionFilter 设计理念一致
 *   - Django：中间件的 process_exception + 自定义 exception handler
 *
 * 【与 Vue3 前端的协作关系】
 *   - 统一错误格式 { code, message, data } → 前端 Axios 拦截器统一消费
 *   - HTTP 401 → Axios 拦截 → 跳转登录页
 *   - HTTP 403 → 前端显示"无权限"提示
 *   - HTTP 500 → 前端显示"服务器错误"提示（不暴露内部细节）
 */

import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Injectable,
  BadRequestException,
  NotFoundException,
  ForbiddenException,
  UnauthorizedException,
  InternalServerErrorException,
  ConflictException,
  HttpException as NestHttpException,
  UseFilters,
} from '@nestjs/common';
import type { Request, Response } from 'express';

// ============================================================
// 示例 1：内置异常类全览
// ============================================================

/**
 * 【场景】不同业务场景应使用不同语义的异常类
 * 【语法点】每个内置异常类对应一个 HTTP 状态码
 * 【NestJS 设计意图】语义化异常：看异常类名就知道业务含义，无需记住状态码数字
 */

class BuiltInExceptionsDemo {
  // 400 Bad Request —— 参数校验失败、业务规则违规
  public throw400(): void {
    throw new BadRequestException('用户名至少需要 3 个字符');
    // 也支持自定义错误体：
    throw new BadRequestException({
      code: 40001,
      message: '用户名已存在',
      field: 'username',
    });
  }

  // 401 Unauthorized —— 未登录、Token 无效或过期
  public throw401(): void {
    throw new UnauthorizedException('请先登录');
    throw new UnauthorizedException({
      code: 40101,
      message: 'Token 已过期，请重新登录',
    });
  }

  // 403 Forbidden —— 已登录但无权限访问
  public throw403(): void {
    throw new ForbiddenException('您没有权限执行此操作');
  }

  // 404 Not Found —— 资源不存在
  public throw404(): void {
    throw new NotFoundException('用户 123 不存在');
  }

  // 409 Conflict —— 资源冲突（如唯一键冲突）
  public throw409(): void {
    throw new ConflictException('邮箱已被注册');
  }

  // 429 Too Many Requests —— 频率限制
  public throw429(): void {
    throw new NestHttpException(
      '请求过于频繁，请稍后再试',
      HttpStatus.TOO_MANY_REQUESTS,
    ); // 429
  }

  // 500 Internal Server Error —— 未知错误
  public throw500(): void {
    throw new InternalServerErrorException('服务器内部错误');
  }

  // 自定义状态码的通用异常
  public throwCustom(): void {
    throw new HttpException('自定义消息', HttpStatus.UNPROCESSABLE_ENTITY); // 422
  }
}

// ============================================================
// 示例 2：异常结构解析 —— statusCode、message、error
// ============================================================

/**
 * 【场景】理解 NestJS 异常的 JSON 响应结构
 * 【语法点】HttpException 返回的默认响应体包含 statusCode、message、error
 */
const exceptionStructureDemo = (): void => {
  const ex1 = new HttpException('禁止访问', HttpStatus.FORBIDDEN);

  // getResponse() 返回响应体
  const response1 = ex1.getResponse();
  // { statusCode: 403, message: '禁止访问', error: 'Forbidden' }

  // getStatus() 返回 HTTP 状态码
  const status1: number = ex1.getStatus(); // 403

  console.log('默认异常结构:', JSON.stringify(response1));

  // 自定义异常体
  // 不要直接把 { code, message, data } 当作 response，要了解默认结构
  // { statusCode: 403, message: '禁止访问' } → 这被 NestJS 封装在响应的 JSON 体中
};

// ============================================================
// 示例 3：自定义异常过滤器 —— 统一格式化所有异常（核心示例）
// ============================================================

/**
 * 【场景】所有异常返回统一的 { code, message, data, timestamp, path } 格式
 * 【语法点】实现 ExceptionFilter 接口，@Catch() 指定捕获范围
 * 【NestJS 设计意图】过滤器是 AOP（面向切面编程）的体现，统一横切关注点
 */

// 定义统一响应接口
interface UnifiedErrorResponse {
  code: number;
  message: string;
  data: null | Record<string, unknown>;
  timestamp: string;
  path: string;
}

@Catch() // 不传参数 = 捕获所有异常
class AllExceptionsFilter implements ExceptionFilter {
  public catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response: Response = ctx.getResponse<Response>();
    const request: Request = ctx.getRequest<Request>();

    // 提取异常信息
    let statusCode: number = HttpStatus.INTERNAL_SERVER_ERROR;
    let message: string = '服务器内部错误';
    let errorData: null | Record<string, unknown> = null;

    if (exception instanceof HttpException) {
      statusCode = exception.getStatus();
      const exceptionResponse = exception.getResponse();
      if (typeof exceptionResponse === 'string') {
        message = exceptionResponse;
      } else if (
        typeof exceptionResponse === 'object' &&
        exceptionResponse !== null
      ) {
        const resp = exceptionResponse as Record<string, unknown>;
        message =
          (resp['message'] as string[])?.join(', ') ||
          (resp['message'] as string) ||
          message;
        errorData = resp;
      }
    } else if (exception instanceof Error) {
      message = exception.message;
      // 开发环境输出堆栈到控制台，生产环境只记录日志
      console.error('未捕获异常:', exception.stack);
    }

    const errorResponse: UnifiedErrorResponse = {
      code: statusCode,
      message,
      data: errorData,
      timestamp: new Date().toISOString(),
      path: request.url,
    };

    response.status(statusCode).json(errorResponse);
  }
}

// ============================================================
// 示例 4：特定类型的异常过滤器
// ============================================================

/**
 * 【场景】对特定异常做特殊处理（如记录 500 错误日志、特殊格式化 400 错误）
 * 【语法点】@Catch(HttpException) 只捕获指定类型的异常
 * 【对比】@Catch() 是全局过滤器，@Catch(HttpException) 是类型过滤器
 */

@Catch(HttpException) // 只捕获 HttpException 及其子类
class HttpExceptionFilter implements ExceptionFilter {
  public catch(exception: HttpException, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response: Response = ctx.getResponse<Response>();
    const status: number = exception.getStatus();
    const exceptionResponse = exception.getResponse();

    // 解析 message（可能是字符串或对象）
    const message: string =
      typeof exceptionResponse === 'object' && exceptionResponse !== null
        ? ((exceptionResponse as Record<string, unknown>)[
            'message'
          ] as string) || exception.message
        : exception.message;

    const errorResponse: UnifiedErrorResponse = {
      code: status,
      message,
      data: null,
      timestamp: new Date().toISOString(),
      path: ctx.getRequest<Request>().url,
    };

    response.status(status).json(errorResponse);
  }
}

// ============================================================
// 示例 5：过滤器的作用域 —— 方法级 / 控制器级 / 全局级
// ============================================================

/**
 * 【场景】不同级别应用过滤器，实现精确控制
 * 【语法点】@UseFilters() 方法/控制器级，app.useGlobalFilters() 全局级
 * 【NestJS 设计意图】过滤器优先级：方法级 > 控制器级 > 全局级
 *                   方法上注册的过滤器只对当前路由有效
 */

// 方法级过滤器 —— 只对当前路由异常生效
class ControllerWithMethodFilter {
  @UseFilters(HttpExceptionFilter) // 只影响这个方法
  public async findOne(): Promise<string> {
    throw new NotFoundException('用户不存在');
  }
}

// 控制器级过滤器 —— 对控制器的所有路由生效
@UseFilters(AllExceptionsFilter) // 影响此控制器所有方法
class ControllerWithControllerFilter {
  public method1(): void {
    throw new BadRequestException();
  }
  public method2(): void {
    throw new ForbiddenException();
  }
}

// 全局过滤器 —— 对整个应用程序生效
// app.useGlobalFilters(new AllExceptionsFilter());
// 更好的方式（支持依赖注入）：
// @Module({
//   providers: [{ provide: APP_FILTER, useClass: AllExceptionsFilter }],
// })

// ============================================================
// 示例 6：与前端协作 —— 统一错误响应格式设计
// ============================================================

/**
 * 【场景】设计前后端约定的错误响应格式，方便 Vue3 前端统一处理
 * 【语法点】定义明确的错误码体系
 * 【设计原则】
 *   1. HTTP 状态码表示请求结果（200/400/401/403/404/500）
 *   2. 业务错误码（code）细化错误类型，前端可据此做差异化处理
 *   3. message 是人类可读的错误描述
 *   4. data 携带额外的错误上下文（如字段验证详情）
 */

// 业务错误码体系
const BusinessErrorCode = {
  // 认证相关
  UNAUTHORIZED: 40100,
  TOKEN_EXPIRED: 40101,
  TOKEN_INVALID: 40102,

  // 权限相关
  FORBIDDEN: 40300,
  INSUFFICIENT_PERMISSION: 40301,

  // 用户相关
  USER_NOT_FOUND: 40401,
  EMAIL_ALREADY_EXISTS: 40901,
  USERNAME_TAKEN: 40902,

  // 验证相关
  VALIDATION_ERROR: 40001,
} as const;

// Vue3 前端 Axios 拦截器消费示例（注释形式展示）
/*
// Vue3 项目中 api.ts
axios.interceptors.response.use(
  (response) => response.data,  // 成功时直接解包 data
  (error) => {
    const apiError = error.response?.data;

    if (!apiError) {
      ElMessage.error('网络连接失败，请检查网络');
      return Promise.reject(error);
    }

    switch (apiError.code) {
      case 40101:  // Token 过期
        router.push('/login?redirect=' + router.currentRoute.value.fullPath);
        ElMessage.warning('登录已过期，请重新登录');
        break;
      case 40100:  // 未登录
        router.push('/login');
        break;
      case 40300:  // 无权限
        ElMessage.error('您没有权限执行此操作');
        break;
      case 40001:  // 验证失败
        ElMessage.warning(apiError.message);
        break;
      default:
        ElMessage.error(apiError.message || '服务器错误');
    }

    return Promise.reject(apiError);
  }
);
*/

console.log('=== 第 07 章示例代码结束 ===');

// ============================================================
// 本章小结
// ============================================================
/*
 * 【核心要点】
 *   - NestJS 内置异常类语义化区分：BadRequest(400)、Unauthorized(401)、
 *     Forbidden(403)、NotFound(404)、Conflict(409)、InternalServerError(500)
 *   - 异常结构：statusCode（HTTP 状态码）+ message（描述）+ error（类型名）
 *   - ExceptionFilter 是 AOP 编程的核心：统一横切关注点（错误格式化）
 *   - @Catch() 决定过滤器的捕获范围：不传 = 所有异常；传入指定类 = 特定异常
 *   - 过滤器作用域：方法级 > 控制器级 > 全局级（越具体优先级越高）
 *   - 前后端统一错误格式 { code, message, data, timestamp, path }
 *
 * 【与前后章的关联】
 *   - 第 06 章：DTO 验证失败 → ValidationPipe 抛出 BadRequestException → 本章过滤器捕获
 *   - 第 10 章：拦截器包装成功响应，过滤器包装错误响应，两者配合形成统一响应格式
 *   - 第 13 章：JWT Guard 抛出 UnauthorizedException → 过滤器统一格式化
 *
 * 【常见面试题】
 *   Q: UnauthorizedException 和 ForbiddenException 的区别是什么？
 *   A: Unauthorized(401) 表示「你是谁？」—— 未认证、Token 无效或过期；
 *      Forbidden(403) 表示「我知道了你是谁，但你没权限」—— 已认证但无权访问。
 *      总结：401 = 未登录，403 = 已登录但无权限。
 *
 *   Q: @Catch() 和 @Catch(HttpException) 的区别？
 *   A: @Catch() 捕获所有异常（包括非 HttpException 的错误）；
 *      @Catch(HttpException) 只捕获 HttpException 及其子类（NestJS 内置异常）。
 *      一般用 @Catch() 做最终兜底，@Catch(HttpException) 做业务异常的格式化。
 */

// ============================================================
// 🎯 通关检查清单
// ============================================================
/*
 * [ ] 能列举 5 种以上 NestJS 内置异常及其 HTTP 状态码
 * [ ] 能手写一个统一格式的全局异常过滤器
 * [ ] 能区分 401 vs 403 的使用场景
 * [ ] 能说出 1 个与 Spring @ControllerAdvice 的异同
 * [ ] 能指出 1 个常见错误及修复方法
 */
