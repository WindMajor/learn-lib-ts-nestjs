import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  Logger,
} from "@nestjs/common";
import { Observable } from "rxjs";
import { tap } from "rxjs/operators";

/**
 * WHAT: LoggingInterceptor——记录每个请求的处理时间
 *
 * 【核心原理——NestInterceptor 接口】
 *   interface NestInterceptor {
 *     intercept(context: ExecutionContext, next: CallHandler): Observable<any>;
 *   }
 *
 *   - next.handle(): 调用链中的下一个处理器（可能是另一个 Interceptor/Pipe/Controller）
 *   - 返回 Observable——你可以在 pipe() 中操作响应流
 *
 * 【关键——Observable 与 Spring AOP 的对比】
 *   NestJS 的 Interceptor 返回 Observable（基于 RxJS）。
 *   这意味着你的逻辑被分成两部分：
 *     前处理：在 next.handle() 之前 —— 相当于 Spring @Around 的 proceedingJoinPoint.proceed() 之前
 *     后处理：在 pipe(tap()) 中 —— 相当于 Spring @Around 的 proceedingJoinPoint.proceed() 之后
 *
 *   【对比 Spring AOP】
 *     @Around("execution(* com.example..*Controller.*(..))")
 *     public Object log(ProceedingJoinPoint pjp) throws Throwable {
 *       long start = System.currentTimeMillis();         // ← 前处理
 *       Object result = pjp.proceed();                   // ← 执行目标方法
 *       long elapsed = System.currentTimeMillis() - start; // ← 后处理
 *       return result;
 *     }
 *
 *   NestJS 等价代码：
 *     intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
 *       const start = Date.now();                        // ← 前处理
 *       return next.handle().pipe(
 *         tap(() => console.log(Date.now() - start))     // ← 后处理
 *       );
 *     }
 *
 *   差异：
 *   - Spring 的前后处理在同一个方法块中（同步风格）
 *   - NestJS 的前后处理被 Observable 的 pipe 链分离
 *   - 这反映了两种编程范式：同步 vs 响应式
 *
 * 【对比 Go Gin 中间件】
 *   func LoggerMiddleware(c *gin.Context) {
 *     start := time.Now()     // ← 前处理
 *     c.Next()                // ← 执行下一个处理器
 *     elapsed := time.Since(start) // ← 后处理
 *   }
 *   与 NestJS 的前/后分离模式类似——但 Go 没有 Observable 抽象
 *
 * 【对比 Rust (Axum/Tower)】
 *   Tower 的 Layer 也是前/后分离模式：
 *   impl Service<Request> for LogService { fn call(&self, req) { ... } }
 *   但 Rust 的 Service trait 是同步的 async fn——更像 Go 而非 NestJS 的 Observable
 *
 * WARNING:
 *   - 不要在 pipe() 中做同步阻塞操作（如大量 JSON 序列化）——这会阻塞事件循环
 *   - 如果需要在 pipe 中做异步操作 → 用 switchMap/mergeMap
 *   - tap() 是纯副作用操作，不修改响应数据
 */
@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  private readonly logger = new Logger(LoggingInterceptor.name);

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest();
    const { method, url } = request;
    const startTime = Date.now();

    // 前处理：记录请求信息
    this.logger.log(`📥 [Interceptor-前] ${method} ${url} — 请求到达`);

    return next.handle().pipe(
      // 后处理：记录响应耗时（tap 不修改数据，只做副作用）
      tap({
        next: (data) => {
          const elapsed = Date.now() - startTime;
          this.logger.log(
            `📤 [Interceptor-后] ${method} ${url} — ${elapsed}ms — 状态: 成功`,
          );
        },
        error: (error) => {
          const elapsed = Date.now() - startTime;
          this.logger.error(
            `📤 [Interceptor-后] ${method} ${url} — ${elapsed}ms — 状态: 异常 — ${error.message}`,
          );
        },
      }),
    );
  }
}
