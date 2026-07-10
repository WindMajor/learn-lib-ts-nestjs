/**
 * ============================================================
 * 第 08 章：中间件
 * ============================================================
 *
 * 【学习目标】
 *   1. 理解中间件在 NestJS 请求生命周期中的位置和作用
 *   2. 掌握函数式中间件和类中间件的编写
 *   3. 掌握中间件配置：configure() 中 .apply().forRoutes() 的使用
 *   4. 掌握中间件 vs 守卫 vs 拦截器的执行顺序和选择标准
 *
 * 【与 Express/FastAPI/Spring/Django 的对比提示】
 *   - Express：中间件是核心概念，NestJS 的中间件底层就是 Express 中间件
 *   - Koa：洋葱模型（中间件需要 await next()），NestJS 中间件也需要调用 next()
 *   - Spring：Filter / HandlerInterceptor，功能更细分
 *   - Django：Middleware 类，process_request / process_response 方法
 *
 * 【与 Vue3 前端的协作关系】
 *   - 中间件 = Vue Router 的全局前置守卫（beforeEach），在请求到达目的地前执行
 *   - 日志中间件 = Vue3 项目中 Axios 请求拦截器的日志记录
 *   - CORS 中间件处理跨域，对应前端 Vite proxy 配置
 */

import { Injectable, Module, NestMiddleware, MiddlewareConsumer } from '@nestjs/common';
import type { Request, Response, NextFunction } from 'express';

// ============================================================
// 示例 1：函数式中间件（最简形式）
// ============================================================

/**
 * 【场景】记录每个请求的方法、URL 和耗时
 * 【语法点】(req, res, next) => { ... } 函数签名
 * 【NestJS 设计意图】函数式中间件适用于简单逻辑，无需 DI 的场景
 * 【注意】函数式中间件不能注入依赖，因为不在 DI 容器中
 */

const loggerMiddleware = (req: Request, res: Response, next: NextFunction): void => {
  /* 这3个参数都是Express的，不是NestJS的，这是 NestJS 故意的设计选择。
  为什么中间件不封装一层？
    1 兼容性——所有现有的 Express 中间件（cors、helmet、morgan、compression……）拿来直接用，零适配成本
    2 没必再造轮子——中间件是 HTTP 层最底下的概念，Express 的 (req, res, next) 已经是事实标准了
    3 按需抽象——NestJS 只在 Controller、Provider、Guard 等上层做了自己的抽象，中间件层保持原生
  */

  const startTime: number = Date.now();
  const { method, url } = req;
  /* 解构赋值，可以从对象里选择几个属性进行解构 */

  console.log(`[${new Date().toISOString()}] ${method} ${url} - 开始处理`);

  // 监听响应完成事件，计算耗时
  res.on('finish', () => {
    /* 这里监听了finish事件，这个事件是Node.js底层的流Stream机制自动触发的 */
    const duration: number = Date.now() - startTime;
    console.log(`[${new Date().toISOString()}] ${method} ${url} - ${res.statusCode} - ${duration}ms`);
  });
  /* 
  on 是 Node.js的 EventEmitter（事件发射器）的方法，用于注册事件监听器，语法：emitter.on('事件名', 回调函数);
  继承链：res（http.ServerResponse）继承自 stream.Writable → EventEmitter
  'finish'事件何时触发：当响应数据全部写入底层 TCP 套接字并发送完毕时触发。也就是说，客户端的响应已经完整发出去了。
  */

  next(); // 必须调用 next()，否则请求会挂起
  /* 这是Express中间件机制的核心：把请求交给下一个处理环节，形成流水线，每个中间件都拿到 (req, res, next)
    请求进来
    │
    ▼
  [中间件1] ──next()──▶ [中间件2] ──next()──▶ [路由处理函数]
                                                      │
                                                      ▼
                                                    返回响应
  
  */
};

// ============================================================
// 示例 2：类中间件 —— 实现 NestMiddleware 接口
// ============================================================

/**
 * 【场景】中间件需要使用 DI 注入依赖（如日志服务、配置服务）
 * 【语法点】实现 NestMiddleware 接口，可以注入依赖
 * 【NestJS 设计意图】类中间件提供了 OOP 封装和 DI 能力，
 *                   比函数式中间件更适合复杂场景
 */

interface Logger_08 {
  log(message: string): void;
  warn(message: string): void;
}

@Injectable()
class LoggerService_08 implements Logger_08 {
  public log(message: string): void {
    console.log(`[LOG] ${message}`);
  }
  public warn(message: string): void {
    console.warn(`[WARN] ${message}`);
  }
}

@Injectable()
class RequestLoggerMiddleware implements NestMiddleware {
  constructor(private readonly logger: LoggerService_08) {}
  /* 构造函数参数属性 */

  public use(req: Request, res: Response, next: NextFunction): void {
    this.logger.log(`${req.method} ${req.url}`);

    // 示例：记录异常慢的请求
    const start: number = Date.now();
    res.on('finish', () => {
      const duration: number = Date.now() - start;
      if (duration > 2000) {
        this.logger.warn(`慢请求: ${req.method} ${req.url} - ${duration}ms`);
      }
    });

    next();
  }
}

// ============================================================
// 示例 3：请求体大小限制中间件
// ============================================================

/**
 * 【场景】限制请求体大小，防止恶意大请求耗尽服务器内存
 * 【语法点】读取 req.headers['content-length']，过大则直接拒绝
 * 【NestJS 设计意图】安全防护类逻辑放在中间件层，在所有业务逻辑之前执行
 */

@Injectable()
class BodySizeLimitMiddleware implements NestMiddleware {
  private readonly maxSize: number;

  constructor() {
    this.maxSize = 10 * 1024 * 1024; // 默认 10MB（可在模块配置中通过 forRoot 传入）
  }

  public use(req: Request, res: Response, next: NextFunction): void {
    const contentLength: string | undefined = req.headers['content-length'];

    if (contentLength) {
      const size: number = parseInt(contentLength, 10); /* 第2个参数10表示是十进制 */

      if (size > this.maxSize) {
        res.status(413).json({
          code: 413,
          message: `请求体过大，最大允许 ${this.maxSize / 1024 / 1024}MB`,
          data: null,
          timestamp: new Date().toISOString(),
          path: req.url,
        });
        /* 这一句就是返回给前端的完整的 HTTP 响应 */

        return; // 就此停下，拦截住，不让调用next()
        /* 
        如果不加 return 会怎样？
        响应已经发过一次 413 了，next()又触发下游处理，可能再尝试发一次响应 → "Cannot set headers after they are sent" 报错。
        */
      }
    }
    next();
  }
}

// ============================================================
// 示例 4：路径前缀鉴权中间件
// ============================================================

/**
 * 【场景】对特定路径做前置鉴权（如 /admin 路径需要管理员 Token）
 * 【语法点】在中间件中检查 Header，拦截非法请求
 * 【NestJS 设计意图】轻量级鉴权可以用中间件，但推荐使用 Guard（下一章）
 *                   因为 Guard 能访问 DI 容器和反射元数据
 */

@Injectable()
class AuthMiddleware implements NestMiddleware {
  public use(req: Request, res: Response, next: NextFunction): void {
    const authHeader: string | undefined = req.headers['authorization'];

    // 简化示例：实际项目中应使用 JWT Service 验证
    if (!authHeader) {
      /* undefined null '' 这3种情况会进入这里，直接返回401 */

      res.status(401).json({
        code: 401,
        message: '请先登录',
        data: null,
        timestamp: new Date().toISOString(),
        path: req.url,
      });
      return;
    }

    // 提取 Token 比如userId 并附加到 req 对象上（供后续 Controller/Service 使用）
    (req as Request & { userId?: number }).userId = 1;
    /* 
    类型断言+属性挂载：在 TypeScript 层面"骗过"类型检查器，往 req 对象上附加一个原本不存在的 userId 属性。
    目的：中间件处理后的数据，传递给下游。类比一条流水线：
      [请求进来]
          │
          ▼
      [AuthMiddleware]  ← 解析 Token，得到 userId=1
          │              把 userId 贴在 req 上，像贴一张便签纸
          │  req.userId = 1
          ▼
      [下一个中间件]   ← 可以直接读 req.userId
          ▼
      [Controller]    ← 可以直接读 req.userId
          ▼
      [Service]       ← 拿到 userId 做业务逻辑，不用重新解析 Token

    原理：TypeScript 的 Express.Request 类型里没有 userId，直接写 req.userId = 1 会报类型错误。用 as 断言就绕过去了。
        ┌─────────────────────────────────┐
        │  编译时（骗 TypeScript）            │
        │  req as Request & { userId?: number } │
        │  ↑ 断言：这个 req 具有 userId 属性     │
        └─────────────────────────────────┘
                        │
                        ▼
        ┌─────────────────────────────────┐
        │  运行时（真实操作）                  │
        │  .userId = 1                     │
        │  ↑ JS 里随便给对象加属性，没限制     │
        └─────────────────────────────────┘

    
    更规范的做法是声明合并，在全局类型声明文件里扩展 Express 的类型：
      // global.d.ts
      declare global {
        namespace Express {
          interface Request {
            userId?: number;
          }
        }
      }
      之后所有文件里都能直接写：req.userId = 1;  // ✅ 类型安全，不需要 as 断言
    */

    next();
  }
}

// ============================================================
// 示例 5：中间件配置 —— configure() 的精确匹配
// ============================================================

/**
 * 【场景】在模块中配置中间件的作用范围
 * 【语法点】configure(consumer).apply().forRoutes() / exclude()
 * 【NestJS 设计意图】精细控制中间件的作用范围，避免全局应用
 */

class AppModule_08 {
  public configure(consumer: MiddlewareConsumer): void {
    consumer
      // 应用中间件
      .apply(
        loggerMiddleware, // 示例1的函数式中间件
        BodySizeLimitMiddleware, // 类中间件
      )
      // 排除某些路径（如健康检查不需要日志），可选的，不写这个方法也可以
      .exclude(
        '/health', // 心跳健康检查
        '/metrics', // 指标检查
        { path: '/api/docs', method: 5 }, // 排除特定方法和路径（method: 5 = ALL）
        /* method:0 只排除某种HTTP方法
        查了 RequestMethod 枚举源码：
          GET = 0,  POST = 1,  PUT = 2,  DELETE = 3,
          PATCH = 4,  ALL = 5,  OPTIONS = 6,  HEAD = 7, ...

        等价写法：
          { path: '/api/docs', method: RequestMethod.ALL }  // ALL = 5
          { path: '/api/docs' } // 或者直接省掉 method
        */
      )
      // NestJS 中间件配置的收尾方法：指定中间件对哪些路由生效。这个方法必须写，不然中间件都不生效
      .forRoutes(
        'users', // 路径前缀匹配：/users、/users/123 等所有方法等价于 { path: 'users', method: 5 }
        'posts',
        { path: 'admin', method: 0 }, // GET /admin
        { path: 'admin', method: 1 }, // POST /admin
      );
    /* 
    目的：将前面 .apply() 注册的中间件，限定在特定的 URL 范围内，而不是全局生效：
      .apply(loggerMiddleware)   // ← "派哪些保安"
      .forRoutes('users', 'posts') // ← "守哪些门"
      apply() 只是"选人"，forRoutes() 才是"分岗"

    与 exclude() 的关系：
      forRoutes 画一个大圈（哪些路径要管）
          exclude 在圈里挖几个洞（哪些路径免检）
      ┌──────────────────────────┐
      │  forRoutes: users, posts  │
      │   ┌─────┐                 │
      │   │health│ ← exclude 挖掉的 │
      │   └─────┘                 │
      │   ✓ /users/123            │
      │   ✓ /posts/456            │
      └──────────────────────────┘
      所有请求
          ├── /health      → ❌ exclude 拦截（与 forRoutes 无关）
          ├── /metrics     → ❌ exclude 拦截
          ├── /api/docs    → ❌ exclude 拦截
          ├── /users/health → ✅ forRoutes 命中了，exclude 没拦住
          ├── /users/123   → ✅
          └── /posts/456   → ✅
      */

    // 单独为 /admin 路径配置鉴权中间件
    consumer.apply(AuthMiddleware).forRoutes(
      { path: 'admin/(.*)', method: 0 }, // 所有 /admin 及其子路径
    );
    /* 
    'admin' 默认的前缀匹配
    'admin/(.*)'  通配符匹配，匹配 /admin 及其所有子路径
    (.*) 是通配符，显式告诉 NestJS"admin 下的所有子级路径我都要"
    虽然默认前缀匹配也能匹配 GET /admin/users，但(.*) 写法更保险、更明确。
    */
  }
}

// ============================================================
// 示例 6：中间件 vs 守卫 vs 拦截器的执行顺序（关键决策指南）
// ============================================================

/**
 * 【场景】理解三层"拦截器"的选择标准
 * 【NestJS 执行顺序】
 *    Middleware → Guard → Interceptor(before) → Pipe
 *                                                │
 *                                                ▼
 *                                          Controller → Service
 *                                                │
 *                                      ┌─────────┴─────────┐
 *                                      ▼                   ▼
 *                                Interceptor(after)    ExceptionFilter
 *                                (正常响应)              (异常捕获)
 *
 *  总结："门卫先拦（Middleware），岗哨再查（Guard），拦截器前后包（Interceptor），管道验参数（Pipe），最后干活的是控制器（Controller）和服务（Service）"
 *
 *  1 ExceptionFilter 不止在末尾，实际上它全程待命，Guard、Pipe、Controller 任意一环抛异常，它都能截住
 *  2 Interceptor(after) 和 ExceptionFilter 是分支关系——正常走 Interceptor(after) 返回响应，出错走 ExceptionFilter 返回错误
 *
 * 【选择标准】
 *   使用中间件（Middleware）当：
 *   - 需要在请求的最早阶段执行（Guard 之前）
 *   - 只需要访问 req/res 对象
 *   - 做 CORS、Body 解析、Helmet 等底层操作
 *   - 不需要 DI 容器和反射元数据
 *
 *   使用守卫（Guard）当：
 *   - 需要决定请求是否被允许（鉴权、权限）
 *   - 需要访问 DI 容器中的 Service（如 JwtService）
 *   - 需要读取 @SetMetadata() 设置的元数据
 *
 *   使用拦截器（Interceptor）当：
 *   - 需要修改请求/响应数据（包装、转换）
 *   - 需要在 Controller 前后都执行逻辑（日志、计时、缓存）
 *   - 需要做 AOP 横切关注点
 */

// 三者的顺序验证
@Injectable()
class OrderVerificationMiddleware implements NestMiddleware {
  public use(_req: Request, _res: Response, next: NextFunction): void {
    console.log('1. Middleware 执行'); // ① 请求进来，最先执行
    next(); // ② 调用下游 ──▶ Guard(2) → Interceptor(3) → Pipe(4) → Controller(5) → Service → Interceptor(6) → 响应返回
    console.log('8. Middleware 后置（next 之后）'); // ③ 下游整个链跑完，next() 才返回，然后执行这一行
    /* 
    虽然最后这一行代码在 next() 之后能执行，但此时响应已经发出去了，你没法再修改响应内容。
    要真正在响应前后做处理（比如包装返回值），应该用 Interceptor 而非 Middleware。
    */
  }
}

// Guard 示例（第 09 章详解）
// class OrderGuard implements CanActivate {
//   canActivate(context: ExecutionContext): boolean {
//     console.log('2. Guard 执行');
//     return true;
//   }
// }

// Interceptor 示例（第 10 章详解）
// class OrderInterceptor implements NestInterceptor {
//   intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
//     console.log('3. Interceptor before');
//     return next.handle().pipe(
//       tap(() => console.log('6. Interceptor after')),
//     );
//   }
// }

// console.log('4. Pipe 执行');  // 管道在拦截器 before 之后
// console.log('5. Controller 执行');  // 控制器方法本身
// console.log('7. ExceptionFilter（如有异常）');

// ============================================================
// ❌ 常见错误 1：在类中间件中忘记调用 next()
// ============================================================

/**
 * 【错误现象】请求一直挂起，浏览器显示 pending，最终超时
 * 【错误原因】忘记调用 next()，请求无法传递到下一个中间件或 Controller
 * 【正确写法】中间件方法的最后一行必须调用 next()
 */

// ❌ 错误写法：
// class BadMiddleware implements NestMiddleware {
//   use(req: Request, res: Response, next: NextFunction) {
//     console.log('处理请求...');
//     // 忘记调用 next()！请求在此挂起！
//   }
// }

// ✅ 正确写法：
// class GoodMiddleware implements NestMiddleware {
//   use(req: Request, res: Response, next: NextFunction) {
//     console.log('处理请求...');
//     next();  // 必须调用 next()！
//   }
// }

// ============================================================
// ❌ 常见错误 2：中间件配置未生效（正则匹配错误）
// ============================================================

/**
 * 【错误现象】中间件注册了但不执行
 * 【错误原因】forRoutes() 的路径参数写错，或者 exclude() 排除了目标路径
 * 【正确写法】检查路径匹配规则：
 *   - 'users' → 匹配 /users、/users/123、/users/123/posts
 *   - { path: 'users', method: 0 } → 匹配所有 HTTP 方法
 *   - { path: 'users', method: RequestMethod.GET } → 只匹配 GET 方法
 */

// ❌ 错误写法：
// consumer.apply(MyMiddleware).forRoutes('user');  // 应该用复数 'users' 匹配目标
// consumer.apply(MyMiddleware).exclude('/(.*)');   // 排除了所有路径！

// ✅ 正确写法：
// consumer.apply(MyMiddleware)
//   .forRoutes({ path: 'users/(.*)', method: RequestMethod.ALL });

// ============================================================
// ❌ 常见错误 3：在中间件里做业务逻辑
// ============================================================

/**
 * 【错误现象】中间件代码越来越长，包含了用户查询、权限判断、数据验证
 * 【错误原因】中间件应只做「请求预处理」，业务逻辑应交由 Guard/Service/Interceptor
 * 【正确写法】保持中间件简洁：日志、安全头、请求解析等底层操作用中间件
 *            业务逻辑（鉴权、验证、转换）使用更高层的 Guard 和 Interceptor
 */

// ❌ 错误写法（中间件做了太多事）：
// class BloatedMiddleware implements NestMiddleware {
//   use(req, res, next) {
//     // 日志 — OK
//     console.log(req.url);
//     // 验证 Token — 应该用 Guard
//     const token = req.headers.authorization;
//     if (!token) return res.status(401).json({});
//     // 查询用户 — 应该用 Service
//     const user = database.findUser(token);
//     // 检查权限 — 应该用 Guard
//     if (user.role !== 'admin') return res.status(403).json({});
//     // 验证数据 — 应该用 Pipe
//     if (!req.body.email) return res.status(400).json({});
//     next();
//   }
// }

// ✅ 正确拆分：
// - 日志 → 独立的 loggerMiddleware
// - Token 验证 + 权限 → AuthGuard（第 09 章）
// - 数据验证 → ValidationPipe（第 06 章）

console.log('=== 第 08 章示例代码结束 ===');

// ============================================================
// 本章小结
// ============================================================
/*
 * 【核心要点】
 *   - 中间件在请求到达 Guard 之前执行，是请求处理链的第一环
 *   - 函数式中间件简单但无法注入依赖；类中间件支持 DI
 *   - configure() 中 .apply().forRoutes() 精确控制中间件范围
 *   - 执行顺序：Middleware → Guard → Interceptor(before) → Pipe → Controller
 *   - 选择标准：中间件做底层处理（日志/CORS），Guard 做权限，Interceptor 做转换
 *
 * 【与前后章的关联】
 *   - 第 09 章：Guard 是中间件的「升级版」，能访问 DI 和元数据
 *   - 第 10 章：Interceptor 能做中间件做不了的事：修改响应、前后拦截
 *   - 第 14 章：CORS 可以用 app.enableCors() 或 CORS 中间件
 *
 * 【常见面试题】
 *   Q: NestJS 中中间件、守卫、拦截器有什么区别？什么时候用哪个？
 *   A: 中间件最早执行，只能访问 req/res；守卫决定"能不能进"，可访问 DI；
 *      拦截器在前后都能执行，能修改数据。中间件用于日志/CORS/Helmet；
 *      守卫用于鉴权和权限；拦截器用于响应包装和缓存。
 */

// ============================================================
// 🎯 通关检查清单
// ============================================================
/*
 * [ ] 能写一个函数式中间件和一个类中间件
 * [ ] 能配置中间件的 exclude 和 forRoutes
 * [ ] 能说出中间件、守卫、拦截器的执行顺序
 * [ ] 能说出 1 个与 Express 中间件的差异
 * [ ] 能指出 1 个常见错误及修复方法
 */
