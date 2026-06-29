import { Controller, Get, Post, Param, Body, Logger } from "@nestjs/common";
import { CatsService } from "./cats.service";
import type { Cat } from "./cats.interface";

/**
 * WHAT: 控制器——处理 HTTP 请求的入口点
 *
 * WHY: @Controller('cats') 做了两件事：
 *   1. 声明这个类是一个路由处理器
 *   2. 自动给所有路由加上 /cats 前缀
 *
 * 【核心原理】装饰器如何转化为 Express 路由？
 *   当 NestFactory.create(AppModule) 执行时：
 *   1. 扫描所有 @Module 的 controllers 数组
 *   2. 对每个 Controller 类，扫描其方法上的 @Get/@Post 等装饰器
 *   3. 调用 Reflect.getMetadata('path', CatsController) 获取 'cats' 前缀
 *   4. 调用 Reflect.getMetadata('path', findAll) 获取 '' 路径
 *   5. 组装完整路径：GET /cats
 *   6. 在底层 Express Router 上注册 app.get('/cats', handlerFunction)
 *
 *   你在声明式编程，NestJS 在命令式操作 Express。
 *
 * 【对比 Express】
 *   Express: app.get('/cats', handler)  —— 显式命令式
 *   NestJS:  @Get() findAll() {}         —— 声明式 + 装饰器
 *   差异：NestJS 多了一层"装饰器 → Express Router"的映射。
 *   优点：类型安全、可测试、可自动生成 Swagger 文档
 *   代价：运行时装饰器解析开销（启动时一次性）
 *
 * 【对比 Spring Boot】
 *   几乎一样：Spring 的 @GetMapping vs NestJS 的 @Get()
 *   差异：Spring 的路径绑定在编译期通过注解处理器完成，
 *         NestJS 在启动时通过反射完成。
 *
 * 【对比 Go Gin】
 *   Gin:  r.GET("/cats", handler)  —— 强类型但手动注册
 *   NestJS: @Get('cats') —— 自动注册，但存在运行时开销
 *
 * WARNING:
 *   - @Param('id') 必须用字符串参数指定路由参数名，
 *     如果你写 @Param() params 然后用 params.id，也是可以的，但不够显式
 *   - Logger 默认是单例的——服务启动后不会被 GC
 *   - Controller 必须注册到 Module 的 controllers 数组中，否则路由不会生效
 *     （无编译错误，无运行时错误，只是请求 404——这就是"声明式"的代价：
 *      你忘记了声明 = NestJS 不知道你有这个路由）
 */
@Controller("cats")
export class CatsController {
  // WHAT: NestJS IoC 容器自动注入 CatsService 实例
  // WHY: 参数类型是 CatsService（一个 @Injectable() 类），IoC 容器根据类型匹配
  //   如果你需要注入接口（如 DatabaseProvider 抽象类），需要用 @Inject() 指定 Token
  constructor(private readonly catsService: CatsService) {}

  private readonly logger = new Logger(CatsController.name);

  /**
   * WHAT: GET /cats
   * WHY: 路由参数为空字符串 → 继承 Controller 前缀 /cats
   *
   * LIFECYCLE: 请求到达 → Guard → Interceptor(前) → Pipe → findAll() 执行 → Interceptor(后) → 响应
   */
  @Get()
  findAll(): Cat[] {
    this.logger.log("处理 GET /cats 请求");
    return this.catsService.findAll();
  }

  /**
   * WHAT: GET /cats/:id
   * @Param('id') 告诉 NestJS 从 URL 中提取 :id 参数并转为 number
   *
   * WARNING: 目前没有 Pipe 做类型转换——'1' 不会被转为 number
   *   这在 Level 02 (ParseIntPipe) 中会解决
   */
  @Get(":id")
  findOne(@Param("id") id: string): Cat | undefined {
    this.logger.log(`处理 GET /cats/${id} 请求`);
    return this.catsService.findOne(Number(id));
  }

  /**
   * WHAT: POST /cats
   * @Body() 告诉 NestJS 从请求体中提取 JSON 并反序列化为 JS 对象
   *
   * 【对比 Express】
   *   Express: req.body → 手动解析（需要 body-parser 中间件）
   *   NestJS:  @Body() body → 自动解析（底层 Express 已自动解析 JSON）
   *   差异：NestJS 的 @Body() 是声明式的——你告诉框架"我需要请求体"，
   *         框架自动完成解析、类型转换和验证（配合 Pipe）
   */
  @Post()
  create(@Body() createCatDto: Omit<Cat, "id">): Cat {
    this.logger.log(`处理 POST /cats 请求，body=${JSON.stringify(createCatDto)}`);
    return this.catsService.create(createCatDto);
  }
}
