import { Injectable, Logger, OnModuleInit } from "@nestjs/common";
import { Cat } from "./cats.interface";

/**
 * WHAT: 业务服务——处理 Cats 的"业务逻辑"
 *
 * WHY: @Injectable() 装饰器做了两件事：
 *   1. 标记这个类为"可注入的 Provider"——IoC 容器会管理它的生命周期
 *   2. 触发 TypeScript 的 emitDecoratorMetadata → 保留构造函数参数的类型信息
 *      这样 NestJS 在实例化 CatsService 时就知道"需要先创建一个 DatabaseProvider"
 *
 * 【核心原理】TypeScript 编译后，构造函数参数的类型信息会丢失。
 *   class CatsService { constructor(db: DatabaseProvider) {} }
 *   → 编译成 JS 后 → class CatsService { constructor(db) {} }
 *   → db 的类型信息丢失了！
 *
 *   emitDecoratorMetadata: true 让 TS 编译器在装饰器类上额外生成 __metadata("design:paramtypes", [DatabaseProvider])
 *   NestJS 读取这个元数据 → 知道需要注入 DatabaseProvider → 从容器中查找 → 注入实例。
 *   （相当于 Spring 的反射获取构造参数类型，但 NestJS 用的是运行期 Reflect.getMetadata）
 *
 * 【对比 Spring Boot】
 *   Spring 用 Java 反射：Constructor.getParameterTypes() → 编译后保留泛型擦除前的类型
 *   NestJS 用 TS reflect-metadata：编译后保留类型但仅限类引用（interface 会被擦除成 Object）
 *   这就是为什么 NestJS 的 Provider 必须是 class，不能是 interface——
 *   interface 在编译后没有运行时的"标识"，IoC 容器无法识别。
 *
 * 【对比 Rust】
 *   Rust 根本不需要"标记可注入"——所有类型在编译期就完全确定了。
 *   依赖通过泛型参数传递，编译器会自动单态化。零运行时开销。
 *   NestJS 的装饰器方案有运行时开销，但换来了动态组装和 AOP 能力。
 *
 * 【对比 Go】
 *   Go 的接口是隐式实现的——只要一个 struct 有匹配的方法集就自动满足接口。
 *   NestJS 的 Provider 是"显式契约"——你必须用 @Injectable() 声明。
 *   这体现了两种语言的哲学差异：Go 的"鸭子类型" vs TS 的"显式 DI"。
 *
 * WARNING:
 *   - 如果忘记在 Module 的 providers 数组中注册 CatsService，
 *     IoC 容器会抛出：
 *     "Nest can't resolve dependencies of the CatsController. 
 *      Please make sure that the argument CatsService at index [0] 
 *      is available in the current context."
 *     这个错误信息非常关键——它告诉你"第 0 个构造函数参数（CatsService）在当前模块上下文中找不到"
 *   - Provider 的默认 Scope 是 DEFAULT（单例），所有请求共享同一个实例。
 *     如果你在这个单例中存储请求级数据 → 会导致数据串扰！
 */
@Injectable()
export class CatsService implements OnModuleInit {
  // WHAT: 注入 DatabaseProvider——NestJS 自动从容器查找并注入
  // WHY: 构造函数注入是 NestJS 推荐的方式，好处有三：
  //   1. 依赖不可变（readonly）
  //   2. 方便测试 mock（可以传入 mock 实例）
  //   3. 编译器强制要求——不传参数无法构造对象
  // 【对比 Spring】Spring 支持构造器注入、Setter 注入、Field 注入三种，
  //   NestJS 只支持构造器注入——因为 TS 的 emitDecoratorMetadata 只保留构造参数类型
  constructor(private readonly db: DatabaseProvider) {}

  // LIFECYCLE: 当模块初始化完成后，所有 onModuleInit 按依赖顺序执行
  // 执行顺序：DatabaseService.onModuleInit() → CatsService.onModuleInit() → AppModule.onModuleInit()
  onModuleInit() {
    this.logger.log("CatsService 已初始化，依赖 DatabaseProvider 已就绪");
  }

  private readonly logger = new Logger(CatsService.name);

  /**
   * WHAT: 模拟数据库查询——返回所有 Cat
   * WHY: 业务逻辑封装在 Service 中，Controller 只负责 HTTP 层
   *
   * 【对比 Express】
   *   Express 中可能直接在路由处理函数中写业务逻辑 + 数据库查询：
   *   app.get('/cats', async (req, res) => {
   *     const cats = await db.query('SELECT * FROM cats');
   *     res.json(cats);
   *   });
   *   问题：无法单独测试"查询逻辑"，数据库和 HTTP 耦合在一起。
   *   NestJS 强制分层：Controller → Service → Repository，每一层可独立测试。
   */
  findAll(): Cat[] {
    this.logger.log("findAll 被调用——从 DatabaseProvider 获取数据");
    return this.db.query("SELECT * FROM cats") as Cat[];
  }

  /**
   * WHAT: 模拟按 ID 查找
   */
  findOne(id: number): Cat | undefined {
    this.logger.log(`findOne 被调用，id=${id}`);
    const cats = this.db.query("SELECT * FROM cats") as Cat[];
    return cats.find((cat) => cat.id === id);
  }

  /**
   * WHAT: 模拟创建——体现"分层调用链"
   * Controller → CatsService.create() → DatabaseProvider.insert()
   */
  create(cat: Omit<Cat, "id">): Cat {
    this.logger.log(`create: 创建新猫 ${cat.name}`);
    const id = this.db.generateId();
    const newCat = { id, ...cat };
    this.db.insert(newCat);
    return newCat;
  }
}

// WHAT: 声明 DatabaseProvider 的契约——这是一个抽象类，充当 Provider Token
// WHY: 使用 abstract class 可以同时作为"类型"和"Injection Token"
//   如果使用 interface，编译后 Token 消失，NestJS 无法识别
//
// 【对比 Go】Go 的接口是隐式实现，不需要声明"implements"
// 【对比 Rust】Rust 的 trait 需要在 impl 块中显式实现
export abstract class DatabaseProvider {
  abstract query(sql: string): unknown[];
  abstract insert(record: unknown): void;
  abstract generateId(): number;
}
