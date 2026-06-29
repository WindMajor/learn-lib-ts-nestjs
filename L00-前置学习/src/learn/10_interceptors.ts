/**
 * ============================================================
 * 第 10 章：拦截器与切面编程
 * ============================================================
 *
 * 【学习目标】
 *   1. 理解拦截器的本质：在 Controller 之前/之后执行的横切逻辑
 *   2. 掌握 NestInterceptor 接口和 call() 方法
 *   3. 掌握 tap()（副作用）和 map()（转换响应）的用法
 *   4. 掌握统一响应包装模式：{ code, data, message }
 *   5. 掌握超时控制和缓存拦截器的基本原理
 *
 * 【与 Express/FastAPI/Spring/Django 的对比提示】
 *   - Express：没有直接的拦截器概念，通常用中间件 + res.on('finish') 模拟
 *   - FastAPI：没有直接对应，但 Starlette 的中间件栈可以模拟
 *   - Spring：Spring AOP 的 @Around 切面 —— NestJS 的拦截器几乎完全对应！
 *   - Django：Middleware 的 process_view / process_response 组合
 *
 * 【与 Vue3 前端的协作关系】
 *   - 拦截器的 map() 转换响应 = Vue3 中 Axios 响应拦截器的 transform
 *   - 拦截器的 tap() 副作用 = Vue3 中 Axios 拦截器的日志/缓存更新
 *   - 统一响应包装 = 前端可以安全地假设所有响应都是 { code, data, message } 格式
 */

import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  UseInterceptors,
  HttpException,
} from '@nestjs/common';
import { Observable, throwError, TimeoutError } from 'rxjs';
import { map, tap, catchError, timeout } from 'rxjs/operators';
import type { Request, Response } from 'express';

// ============================================================
// 示例 1：拦截器基础 —— 实现 NestInterceptor 接口
// ============================================================

/**
 * 【场景】最简拦截器：记录每个请求的 Controller 方法名和耗时
 * 【语法点】intercept() 接收 context 和 next，返回 Observable
 * 【NestJS 设计意图】拦截器基于 RxJS Observable，支持管道式组合操作
 *                   call() 返回的 Observable 链让拦截器可以"包装"整个处理流程
 */
@Injectable()
class SimpleLoggingInterceptor implements NestInterceptor {
  public intercept(
    context: ExecutionContext,
    next: CallHandler,
  ): Observable<unknown> {
    // 获取被调用的 Controller 和方法名
    const controllerName: string = context.getClass().name;
    const handlerName: string = context.getHandler().name;
    const startTime: number = Date.now();

    console.log(`[Interceptor] Before: ${controllerName}.${handlerName}`);

    // next.handle() 返回一个 Observable，代表后续处理链的结果
    return next.handle().pipe(
      // tap() 做副作用（不改变数据流）
      tap({
        next: () => {
          const duration: number = Date.now() - startTime;
          console.log(
            `[Interceptor] After: ${controllerName}.${handlerName} - ${duration}ms`,
          );
        },
        error: (error: unknown) => {
          const duration: number = Date.now() - startTime;
          console.error(
            `[Interceptor] Error: ${controllerName}.${handlerName} - ${duration}ms`,
            error,
          );
        },
      }),
    );
  }
}

// ============================================================
// 示例 2：统一响应包装 —— 核心实战拦截器
// ============================================================

/**
 * 【场景】将所有成功响应包装为 { code: 200, data: T, message: 'success' }
 *        这是 NestJS 项目中最常用的拦截器模式
 * 【语法点】map() 操作符转换响应数据流
 * 【NestJS 设计意图】响应格式的统一化是拦截器的典型 AOP 用例
 *                   所有 Controller 不需要关心响应包装，专心返回业务数据
 */

// 统一响应接口
interface ApiResponse<T = unknown> {
  code: number;
  data: T;
  message: string;
  timestamp: string;
}

@Injectable()
class TransformInterceptor<T = unknown> implements NestInterceptor<
  T,
  ApiResponse<T>
> {
  public intercept(
    _context: ExecutionContext,
    next: CallHandler<T>,
  ): Observable<ApiResponse<T>> {
    return next.handle().pipe(
      map((data: T) => ({
        code: 200,
        data,
        message: 'success',
        timestamp: new Date().toISOString(),
      })),
    );
  }
}

// 使用后的效果对比：
// 不使用拦截器：Controller 返回 { id: 1, name: '张三' }
// 使用拦截器后：前端收到 { code: 200, data: { id: 1, name: '张三' }, message: 'success', timestamp: '...' }

// Vue3 前端响应拦截器的配合代码（注释示例）：
/*
// 前端 Axios 响应拦截器 —— 与后端 TransformInterceptor 配合
axios.interceptors.response.use(
  (response) => {
    const { code, data, message } = response.data;
    if (code === 200) {
      return data;  // 自动解包，前端直接拿到业务数据
    }
    ElMessage.error(message);  // 非 200 的错误由后端 ExceptionFilter 处理
    return Promise.reject(response.data);
  },
);
*/

// ============================================================
// 示例 3：tap() 做副作用 —— 缓存更新、统计计数
// ============================================================

/**
 * 【场景】在请求成功后异步更新缓存（不影响响应速度）
 * 【语法点】tap() 中的数据不修改响应流，只做副作用操作
 * 【NestJS 设计意图】tap() = 观察但不改变数据流，适合日志/缓存/统计
 */

interface CacheService_10 {
  get(key: string): Promise<string | null>;
  set(key: string, value: string, ttl: number): Promise<void>;
}

@Injectable()
class CacheInvalidationInterceptor implements NestInterceptor {
  constructor(private readonly cache: CacheService_10) {}

  public intercept(
    context: ExecutionContext,
    next: CallHandler,
  ): Observable<unknown> {
    const request: Request = context.switchToHttp().getRequest<Request>();
    const method: string = request.method;

    return next.handle().pipe(
      tap(async () => {
        // 写操作（POST/PUT/PATCH/DELETE）成功后，清除相关缓存
        if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(method)) {
          const resource: string = context
            .getClass()
            .name.replace('Controller', '');
          const cacheKey: string = `cache:${resource.toLowerCase()}:list`;
          console.log(`清除缓存: ${cacheKey}`);
          await this.cache.set(cacheKey, '', 0); // 模拟清除
        }
      }),
    );
  }
}

// ============================================================
// 示例 4：超时控制拦截器
// ============================================================

/**
 * 【场景】防止某个接口耗时过长，设置超时时间
 * 【语法点】timeout() + catchError() 捕获 TimeoutError
 * 【NestJS 设计意图】超时控制是横切关注点，不应写在每个 Controller 方法中
 */

@Injectable()
class TimeoutInterceptor implements NestInterceptor {
  private readonly timeoutMs: number;

  constructor(timeoutMs: number = 5000) {
    this.timeoutMs = timeoutMs;
  }

  public intercept(
    _context: ExecutionContext,
    next: CallHandler,
  ): Observable<unknown> {
    return next.handle().pipe(
      timeout(this.timeoutMs),
      catchError((err: unknown) => {
        if (err instanceof TimeoutError) {
          return throwError(() => new HttpException('请求处理超时', 408));
        }
        return throwError(() => err);
      }),
    );
  }
}

// ============================================================
// 示例 5：分页响应拦截器
// ============================================================

/**
 * 【场景】自动包装分页查询结果，添加分页元数据
 * 【语法点】拦截器根据返回数据的形状判断是否需要包装
 * 【NestJS 设计意图】分页也是横切关注点，拦截器统一处理避免 Service 代码重复
 */

interface PaginatedResult<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
}

interface PaginatedResponse<T> {
  code: number;
  data: {
    items: T[];
    pagination: {
      total: number;
      page: number;
      limit: number;
      totalPages: number;
    };
  };
  message: string;
  timestamp: string;
}

@Injectable()
class PaginationInterceptor<T = unknown> implements NestInterceptor {
  public intercept(
    context: ExecutionContext,
    next: CallHandler,
  ): Observable<unknown> {
    return next.handle().pipe(
      map((data: unknown) => {
        // 检查是否是分页数据（约定的 shape）
        if (this.isPaginatedResult(data)) {
          const paginated = data as PaginatedResult<T>;
          const response: PaginatedResponse<T> = {
            code: 200,
            data: {
              items: paginated.items,
              pagination: {
                total: paginated.total,
                page: paginated.page,
                limit: paginated.limit,
                totalPages: Math.ceil(paginated.total / paginated.limit),
              },
            },
            message: 'success',
            timestamp: new Date().toISOString(),
          };
          return response;
        }

        // 不是分页数据，原样返回（由 TransformInterceptor 处理）
        return data;
      }),
    );
  }

  private isPaginatedResult(data: unknown): data is PaginatedResult<unknown> {
    if (!data || typeof data !== 'object') return false;
    const obj = data as Record<string, unknown>;
    return (
      Array.isArray(obj['items']) &&
      typeof obj['total'] === 'number' &&
      typeof obj['page'] === 'number' &&
      typeof obj['limit'] === 'number'
    );
  }
}

// ============================================================
// 示例 6：请求上下文拦截器（ReqId 生成）
// ============================================================

/**
 * 【场景】为每个请求生成唯一 ID，附加到 request 和响应头
 * 【语法点】在拦截器的 before 阶段操作 request，after 阶段设置响应头
 * 【NestJS 设计意图】请求追踪是分布式系统的常见需求，拦截器是理想的实现位置
 */
// 使用 Node.js 内置 crypto.randomUUID 替代 uuid 包
const uuidv4 = (): string => crypto.randomUUID();

interface RequestWithRequestId extends Request {
  requestId: string;
}

@Injectable()
class RequestIdInterceptor implements NestInterceptor {
  public intercept(
    context: ExecutionContext,
    next: CallHandler,
  ): Observable<unknown> {
    const request = context.switchToHttp().getRequest<RequestWithRequestId>();
    const requestId: string = uuidv4();

    // Before：生成 requestId，附加到 request 对象
    request.requestId = requestId;

    // After：在响应头中返回 requestId，方便前端调试
    const response: Response = context.switchToHttp().getResponse<Response>();
    response.setHeader('X-Request-Id', requestId);

    return next.handle().pipe(
      tap(() => {
        // 此时 requestId 已经通过响应头返回
        console.log(`请求 ${requestId} 处理完成`);
      }),
    );
  }
}

// ============================================================
// 示例 7：拦截器的组合与作用域
// ============================================================

/**
 * 【场景】多个拦截器按顺序组合
 * 【语法点】@UseInterceptors() 可接收多个拦截器，按从左到右顺序执行
 *          before 阶段：从左到右（I1 before → I2 before → Controller）
 *          after 阶段：从右到左（Controller → I2 after → I1 after）
 * 【类比】类似 Express 中间件的洋葱模型
 */

// 全局注册拦截器（支持依赖注入的方式）：
// @Module({
//   providers: [
//     { provide: APP_INTERCEPTOR, useClass: TransformInterceptor },
//     { provide: APP_INTERCEPTOR, useClass: SimpleLoggingInterceptor },
//     { provide: APP_INTERCEPTOR, useClass: TimeoutInterceptor },
//   ],
// })

// 方法级使用：
// @Get()
// @UseInterceptors(TransformInterceptor, SimpleLoggingInterceptor)
// findAll() { return []; }

// ============================================================
// ❌ 常见错误 1：在 map() 中修改响应导致类型丢失
// ============================================================

/**
 * 【错误现象】拦截器包装后，下游代码的类型推断不准确
 * 【错误原因】map() 改变了数据形状，但 TypeScript 泛型没有正确传递
 * 【正确写法】在拦截器接口上显式声明泛型 NestInterceptor<Input, Output>
 */

// ❌ 错误写法：
// class BadInterceptor implements NestInterceptor {
//   intercept(ctx, next: CallHandler) {  // CallHandler 泛型未指定
//     return next.handle().pipe(
//       map(data => ({ wrapped: data }))  // 改变了类型但未声明
//     );
//   }
// }

// ✅ 正确写法：
// class GoodInterceptor<T> implements NestInterceptor<T, { wrapped: T }> {
//   intercept(ctx, next: CallHandler<T>): Observable<{ wrapped: T }> {
//     return next.handle().pipe(
//       map(data => ({ wrapped: data }))
//     );
//   }
// }

// ============================================================
// ❌ 常见错误 2：忘记 return next.handle()
// ============================================================

/**
 * 【错误现象】请求挂起，客户端无响应，最终超时
 * 【错误原因】拦截器必须返回 next.handle() 的 Observable，忘记 return 会导致 NestJS 无法完成请求
 * 【正确写法】intercept() 方法必须 return next.handle().pipe(...)
 */

// ❌ 错误写法：
// class BadInterceptor implements NestInterceptor {
//   intercept(ctx, next: CallHandler): Observable<any> {
//     next.handle().pipe(      // 忘记 return！
//       tap(() => console.log('done'))
//     );
//     // 隐式返回 undefined，请求挂起
//   }
// }

// ✅ 正确写法：
// class GoodInterceptor implements NestInterceptor {
//   intercept(ctx, next: CallHandler): Observable<any> {
//     return next.handle().pipe(    // 必须 return
//       tap(() => console.log('done'))
//     );
//   }
// }

// ============================================================
// ❌ 常见错误 3：拦截器内异常未捕获导致请求挂起
// ============================================================

/**
 * 【错误现象】拦截器抛出的异常没有被 catchError 捕获，请求状态未正确处理
 * 【错误原因】Observable 管道中的异常需要通过 catchError 处理，否则会传播到外部
 * 【正确写法】使用 catchError 操作符捕获拦截器中的异常
 */

// ❌ 错误写法：
// class BadInterceptor implements NestInterceptor {
//   intercept(ctx, next: CallHandler): Observable<any> {
//     return next.handle().pipe(
//       map(() => {
//         throw new Error('拦截器内部错误');  // 未被捕获！
//       })
//     );
//   }
// }

// ✅ 正确写法：
// class GoodInterceptor implements NestInterceptor {
//   intercept(ctx, next: CallHandler): Observable<any> {
//     return next.handle().pipe(
//       map(() => { ... }),
//       catchError((err) => {
//         console.error('拦截器错误:', err);
//         return throwError(() => err);  // 重新抛出，让 ExceptionFilter 处理
//       }),
//     );
//   }
// }

console.log('=== 第 10 章示例代码结束 ===');

// ============================================================
// 本章小结
// ============================================================
/*
 * 【核心要点】
 *   - 拦截器基于 RxJS Observable，在 Controller 前后执行
 *   - tap() 做副作用（日志、统计），map() 转换数据（响应包装）
 *   - 统一响应格式 { code, data, message } 是最常用的拦截器模式
 *   - 拦截器执行顺序：before 从左到右 → Controller → after 从右到左（洋葱）
 *   - 拦截器能做中间件做不到的事：修改响应、超时控制、请求 ID 生成
 *   - transform: true 是必要的，否则管道转换可能不生效
 *
 * 【与前后章的关联】
 *   - 第 07 章：ExceptionFilter 处理错误，Interceptor 包装成功响应 —— 两者配合形成统一格式
 *   - 第 08 章：拦截器 vs 中间件：拦截器能修改响应数据，中间件不能
 *   - 第 09 章：拦截器 vs 守卫：守卫决定"能不能进"，拦截器在"能进"之后做修饰
 *   - 第 14 章：API 版本控制和响应格式设计依赖本章的拦截器
 *
 * 【常见面试题】
 *   Q: tap() 和 map() 的区别是什么？
 *   A: tap() 观察数据流但不改变它（用于副作用如日志、缓存更新）；
 *      map() 转换数据流中的每个值（用于响应包装、数据转换）。
 *      tap() 不改变下游收到的值，map() 会改变。
 *
 *   Q: 拦截器和中间件的区别？
 *   A: 1. 拦截器能修改响应数据（map），中间件不能
 *      2. 拦截器有 before+after 两个阶段的洋葱模型，中间件主要是 before
 *      3. 拦截器能访问 DI 容器和反射元数据
 *      4. 拦截器基于 RxJS，中间件基于 Express 回调
 */
// ============================================================
// 🎯 通关检查清单
// ============================================================
/*
 * [ ] 能手写一个统一响应包装的 TransformInterceptor
 * [ ] 能区分 tap() 和 map() 的使用场景
 * [ ] 能写一个超时控制的拦截器
 * [ ] 能说出拦截器与 Spring AOP @Around 的相似性
 * [ ] 能指出 1 个常见错误及修复方法
 */
