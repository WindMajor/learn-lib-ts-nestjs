/**
 * ================================================================
 * BUG #03: 错误的 Scope 导致请求上下文丢失或内存泄漏
 * ================================================================
 *
 * 【错误类型】运行期逻辑错误 —— 应用启动成功，但行为不符合预期
 *
 * 【三种 Scope 的语义】
 *   - DEFAULT (单例):  整个应用生命周期只有一个实例，所有请求共享
 *   - REQUEST (请求级): 每个 HTTP 请求创建一个新实例，请求结束后销毁
 *   - TRANSIENT (瞬态): 每次注入都创建一个新实例，不共享
 *
 * 【错误场景 1: REQUEST Scope 的 Provider 注入到 DEFAULT Scope 的 Provider】
 *   这本身不会报错，但会引发一个微妙的问题：
 *   - CatsService 是 DEFAULT scope（单例）
 *   - RequestContext 是 REQUEST scope（每个请求一个实例）
 *   - 当 CatsService 在构造函数中注入 RequestContext 时，
 *     NestJS 使用代理模式（Proxy）——注入的是一个"占位符"
 *   - 每次请求时，代理自动委托给当前请求的 RequestContext 实例
 *   - 但如果你在 onModuleInit() 中访问 RequestContext 的属性 → 此时没有活动请求！
 *     → RequestContext 的代理还没有关联任何真实实例 → 可能返回 undefined 或抛出错误
 *
 * 【错误场景 2: 在单例 Service 中存储请求级数据】
 *   - LoggerService 是单例（所有请求共享）
 *   - 在 handleRequest() 中存储 userId = req.user.id
 *   - 请求 A 设置 userId = 1，请求 B 设置 userId = 2
 *   - 请求 A 后续读取 userId → 得到 2（被请求 B 污染了！）
 *   → 这是典型的数据竞态条件（Race Condition）
 *
 * 【在 Express/Spring/Go/Rust 中对应的行为】
 *   - Express:  不存在自动的 Scope 概念——你手动管理一切。
 *              但 Express 的中间件可以访问 req/res，天然请求隔离。
 *              类似错误：在 Express 中把请求数据存储到全局变量 → 数据串扰
 *   - Spring:   Spring 明确区分 singleton/request/session/prototype scope。
 *              Spring 的 request scope 同样用代理实现（ScopedProxyMode）。
 *              错误行为几乎相同——在 singleton Bean 中存储 request 数据会出问题。
 *   - Go:       Go 没有 Scope 概念——每请求一个 goroutine，天然隔离。
 *              但如果你在全局变量中存储请求数据 → 同样数据竞态（Go 的 race detector 能检测到）
 *   - Rust:     Rust 的 trait + Send + Sync 在编译期阻止跨请求共享可变状态。
 *              类似错误在 Rust 中无法编译——这就是 Rust 的优势。
 *
 * 【对比分析】NestJS 的 Scope 设计来自 Spring，允许在"便利性"和"安全性"之间权衡。
 *   默认单例是最高效的（零对象创建开销），但需要开发者意识到状态隔离问题。
 *   如果你需要请求级状态 → 用 REQUEST scope 或 @nestjs/request-scope
 *
 * 【如何修复】
 *   场景 1: 不要在 onModuleInit 中访问 REQUEST scope 的 Provider
 *   场景 2: 请求级数据应该存储在请求上下文中（如 async_hooks 的 AsyncLocalStorage）
 *          或使用 @nestjs/request-scope 的 REQUEST 注入
 *   场景 3: 如果确实需要在单例中存储请求级数据 → 用 Map<requestId, data> 隔离
 */

import {
  Module,
  Controller,
  Get,
  Injectable,
  Scope,
  Logger,
} from "@nestjs/common";

// ============================================================
// 场景 1: REQUEST Scope 注入到 DEFAULT Scope
// ============================================================

/**
 * WHAT: 请求上下文——每个请求独立的"用户信息"
 * WHY: Scope.REQUEST 保证每个 HTTP 请求都有独立的实例
 *
 * 【对比 Go】Go 通过 context.Context 传递请求级数据，天然线程安全
 * 【对比 Rust】Rust 通过 async fn 的 parameters 传递，编译期保证不跨请求共享
 * 【对比 Spring】Spring 的 @RequestScope ——几乎一样的设计
 */
@Injectable({ scope: Scope.REQUEST })
class RequestContext {
  userId: number | null = null;
  requestId: string = Math.random().toString(36).substring(7);
}

/**
 * WHAT: 服务——默认为单例 (DEFAULT scope)
 * BUG: 在单例中注入 REQUEST scope 的 Provider
 *   虽然 NestJS 用代理模式解决，但 lifecycle hook 中访问会出问题
 */
@Injectable() // 默认 DEFAULT scope = 单例
class BuggyService {
  private readonly logger = new Logger(BuggyService.name);

  constructor(
    // WARNING: 这里注入了一个 REQUEST scope 的 Provider！
    // NestJS 会创建一个代理对象，在每次请求时自动委托
    private readonly requestContext: RequestContext,
  ) {}

  /**
   * LIFECYCLE: onModuleInit 在应用启动阶段执行——此时没有 HTTP 请求
   * BUG: 访问 requestContext 的属性 → 代理对象还没有绑定真实实例 → undefined/null
   */
  onModuleInit() {
    // WARNING: 此时 requestContext.requestId 可能是 undefined
    // 因为代理尚未绑定到任何真实的 RequestContext 实例
    this.logger.warn(
      `⚠️ onModuleInit 中访问 REQUEST scope Provider: requestId=${this.requestContext.requestId}`,
    );
    this.logger.warn(
      "修复方法：不要在 lifecycle hook 中访问 REQUEST scope 的 Provider",
    );
  }

  getRequestId(): string {
    // 在请求处理函数中访问是安全的——此时代理已绑定到当前请求的实例
    return this.requestContext.requestId;
  }
}

// ============================================================
// 场景 2: 单例中存储请求级数据 → 数据串扰
// ============================================================

@Injectable()
class StatefulService {
  private readonly logger = new Logger(StatefulService.name);

  // BUG: 在单例中存储请求级状态！
  // 多个并发请求会互相覆盖这个值
  private currentUserId: number | null = null;

  setCurrentUser(userId: number) {
    this.currentUserId = userId;
    this.logger.log(`设置 currentUserId = ${userId}（⚠️ 单例状态，会被并发覆盖）`);
  }

  getCurrentUser(): number | null {
    return this.currentUserId;
  }
}

// ============================================================
// Controller
// ============================================================

@Controller("scope")
class ScopeBugController {
  private readonly logger = new Logger(ScopeBugController.name);

  constructor(
    private readonly buggyService: BuggyService,
    private readonly statefulService: StatefulService,
  ) {}

  @Get("request-id")
  getRequestId() {
    const requestId = this.buggyService.getRequestId();
    this.logger.log(`当前请求的 RequestContext.requestId = ${requestId}`);
    return { requestId };
  }

  @Get("state-test/:userId")
  async stateTest() {
    // 模拟并发场景——两次快速连续的请求
    this.statefulService.setCurrentUser(1);
    // 如果此时另一个请求进来调用了 setCurrentUser(2)...
    const userId = this.statefulService.getCurrentUser();
    // 可能已经是 2 而不是 1！
    return { userId, warning: "如果 userId !== 1，说明数据被其他请求污染了！" };
  }
}

@Module({
  controllers: [ScopeBugController],
  providers: [
    BuggyService,
    StatefulService,
    RequestContext, // REQUEST scope
  ],
})
export class BugAppModule {}
