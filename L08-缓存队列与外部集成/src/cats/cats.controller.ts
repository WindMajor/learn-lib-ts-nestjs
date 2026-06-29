import {
  Controller, Get, Post, Body, UseInterceptors,
  CacheInterceptor, CacheTTL, Logger, HttpCode, HttpStatus,
} from "@nestjs/common";
import { EventEmitter2 } from "@nestjs/event-emitter";
import { CatsService, Cat } from "./cats.service";

@Controller("cats")
export class CatsController {
  private readonly logger = new Logger(CatsController.name);

  constructor(
    private readonly catsService: CatsService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  /**
   * WHAT: GET /cats —— 自动缓存 10 秒
   *
   * @UseInterceptors(CacheInterceptor) 告诉 NestJS：
   *   "第一次请求后缓存响应，后续相同请求直接返回缓存"
   *
   * 测试方法：
   *   连续两次 curl http://localhost:3000/cats
   *   第一次：控制台输出 "findAll 被调用"（缓存未命中）
   *   第二次：无日志输出（返回缓存，不进入 Controller 方法）
   */
  @Get()
  @UseInterceptors(CacheInterceptor)
  @CacheTTL(10000)
  findAll(): Cat[] {
    return this.catsService.findAll();
  }

  /**
   * WHAT: POST /cats —— 创建猫并触发事件
   *
   * EventEmitter 进程内事件：
   *   创建猫 → 发出 'cat.created' 事件 → EventsModule 监听并打印通知
   */
  @Post()
  @HttpCode(HttpStatus.CREATED)
  create(@Body() dto: { name: string; age: number; breed: string }): Cat {
    const cat = this.catsService.create(dto);
    this.eventEmitter.emit("cat.created", cat);
    return cat;
  }
}
