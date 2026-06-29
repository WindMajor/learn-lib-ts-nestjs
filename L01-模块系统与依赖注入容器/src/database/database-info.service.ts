/**
 * WHAT: DatabaseInfoService——演示如何注入自定义 Token 的 Provider
 *
 * WHY: @Inject('DATABASE_CONNECTION') 告诉 IoC 容器：
 *   "构造函数参数 db 不从类型推断（类型是 object），而是通过 Token 'DATABASE_CONNECTION' 查找"
 *
 * 【核心原理——Token 匹配机制】
 *   NestJS 的 IoC 容器内部维护一个 Map<ProviderToken, Instance>。
 *   当你写 @Inject('DATABASE_CONNECTION') 时：
 *   1. 容器查找 Token 'DATABASE_CONNECTION'
 *   2. 找到 useFactory 的定义
 *   3. 解析 factory 的依赖（inject: ['DB_CONFIG']）
 *   4. 递归：查找 'DB_CONFIG' → useValue → 获取配置对象
 *   5. 调用 factory(config) → 返回 connection 对象
 *   6. 缓存到 Map 中（单例模式下）
 *   7. 将 connection 注入到构造函数参数 db
 *
 *   Token 可以是：
 *   - 类引用:   @Injectable() class Foo {} → Token = Foo
 *   - 字符串:   @Inject('MY_TOKEN')       → Token = 'MY_TOKEN'
 *   - Symbol:   @Inject(MY_SYMBOL)        → Token = Symbol('MY_SYMBOL')
 *
 * 【对比 Spring】
 *   Spring 用 @Qualifier("name") 区分同类型的 Bean。
 *   NestJS 用自定义 Token 实现相同效果——但 NestJS 本身就能用不同类引用区分，
 *   只有注入非类值（字符串、对象、函数）时才需要 @Inject()
 *
 * WARNING:
 *   - @Inject() 必须匹配 providers 中注册的 provide 值，大小写敏感
 *   - 如果你删除了 providers 中的 { provide: 'DATABASE_CONNECTION', ... }，
 *     但保留 @Inject('DATABASE_CONNECTION')，启动时会抛出：
 *     "Nest can't resolve dependencies... Please make sure that the argument 
 *      DATABASE_CONNECTION at index [0] is available..."
 */
import { Injectable, Inject, Logger } from "@nestjs/common";

@Injectable()
export class DatabaseInfoService {
  constructor(
    // WHAT: 通过字符串 Token 注入非类 Provider
    // WHY: 'DATABASE_CONNECTION' 是通过 useFactory 创建的普通对象，没有对应的类，
    //   必须用 @Inject() 显式指定 Token
    @Inject("DATABASE_CONNECTION")
    private readonly connection: {
      id: string;
      connected: boolean;
      config: { host: string; port: number; database: string };
      queryCount: number;
      connectTime: string;
    },
  ) {}

  private readonly logger = new Logger(DatabaseInfoService.name);

  getStatus() {
    this.logger.log("查询数据库连接状态");
    this.connection.queryCount++;
    return {
      success: true,
      data: {
        connectionId: this.connection.id,
        connected: this.connection.connected,
        host: this.connection.config.host,
        port: this.connection.config.port,
        database: this.connection.config.database,
        queryCount: this.connection.queryCount,
        connectTime: this.connection.connectTime,
      },
    };
  }
}
