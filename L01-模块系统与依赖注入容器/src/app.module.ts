import { Module, Logger, OnModuleInit } from "@nestjs/common";
import { CatsModule } from "./cats/cats.module";
import { DatabaseModule } from "./database/database.module";

/**
 * WHAT: 根模块——整个 NestJS 应用的"组装入口"
 *
 * WHY: @Module 装饰器告诉 IoC 容器四件事：
 *   - imports: 这个模块依赖哪些其他模块（模块级依赖声明）
 *   - controllers: 这个模块注册了哪些 Controller（路由注册）
 *   - providers: 这个模块提供了哪些可注入的 Provider（IoC 容器管理）
 *   - exports: 这个模块把哪些 Provider 暴露给其他模块（封装边界）
 *
 * 【对比 Spring Boot】
 *   Spring 的 @Configuration/@ComponentScan 自动扫描包路径下的 Bean，
 *   NestJS 的 @Module 必须显式声明——更啰嗦，但依赖关系一目了然。
 *   对于大型项目，这种显式声明是优点：编译器和 IDE 能精确追踪依赖关系。
 *
 * 【对比 Go/Rust】
 *   Go/Rust 没有"根模块"概念——你手动组装 main() 的依赖图。
 *   NestJS 的 @Module 是"穷人的依赖解析器"：你声明依赖关系，
 *   容器负责构建依赖图并按拓扑顺序创建实例。
 *
 * LIFECYCLE:
 *   当 NestFactory.create(AppModule) 被调用时：
 *   1. 扫描 AppModule 的 @Module 装饰器元数据
 *   2. 导入 CatsModule（递归扫描）
 *   3. 导入 DatabaseModule（递归扫描）
 *   4. 构建完整的 Provider 注册表（Map<ProviderToken, ProviderDefinition>）
 *   5. 拓扑排序所有 Provider，检测循环依赖
 *   6. 按序实例化所有 Provider（先创建 DatabaseService，再创建 CatsService）
 *   7. 注册所有 Controller 路由到 Express
 */
@Module({
  imports: [CatsModule, DatabaseModule],
})
export class AppModule implements OnModuleInit {
  private readonly logger = new Logger(AppModule.name);

  /**
   * LIFECYCLE: onModuleInit 在模块的所有 Provider 实例化完成后调用
   * 此时依赖注入已经完成，所有 Service 都可以安全使用
   */
  onModuleInit() {
    this.logger.log("AppModule 已初始化——所有子模块的 Provider 已就绪");
    this.logger.log(
      "此时 IoC 容器的依赖图：DatabaseModule → CatsModule → AppModule",
    );
  }
}
