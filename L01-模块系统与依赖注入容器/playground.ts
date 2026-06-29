/**
 * WHAT: 沙盒文件——可以随意修改、破坏、实验
 *
 * WHY: 学习 NestJS 最好的方式就是"搞坏它然后修好它"。
 *   这个文件是一个独立的 NestJS 应用，你可以：
 *   - 修改 @Module 配置观察错误
 *   - 删除 providers 中的注册观察依赖解析失败
 *   - 尝试 forwardRef 解决循环依赖
 *   - 修改 Scope 观察单例 vs 请求级行为差异
 *
 * 运行方法: npx ts-node playground.ts
 * （这个文件不需要 nest-cli，用 ts-node 直接执行就行）
 *
 * 【实验建议】
 *   1. 删除 providers 中的 Service → 观察 "Nest can't resolve dependencies" 错误
 *   2. 把 Service 的 Scope 改为 REQUEST → 观察启动行为变化
 *   3. 在 AppModule 的 providers 中重复注册 CatsService → 观察是否报错
 *   4. 尝试让 CatsService 注入 DogService, DogService 注入 CatsService → 循环依赖
 */

import "reflect-metadata";
import { NestFactory } from "@nestjs/core";
import { Module, Controller, Get, Injectable, Logger } from "@nestjs/common";

// ====================================================================
// 你可以修改下面的所有代码
// ====================================================================

@Injectable()
class CounterService {
  private count = 0;
  increment() {
    return ++this.count;
  }
}

@Controller()
class PlaygroundController {
  constructor(private readonly counter: CounterService) {}
  private readonly logger = new Logger(PlaygroundController.name);

  @Get("counter")
  getCounter() {
    const value = this.counter.increment();
    this.logger.log(`计数器当前值: ${value}`);
    return { counter: value };
  }
}

@Module({
  controllers: [PlaygroundController],
  providers: [CounterService], // 试着注释掉这一行 → 观察错误
})
class PlaygroundModule {}

async function bootstrap() {
  const app = await NestFactory.create(PlaygroundModule);
  await app.listen(3001);
  console.log("Playground 运行在 http://localhost:3001");
  console.log("访问 http://localhost:3001/counter 查看效果");
}
bootstrap();
