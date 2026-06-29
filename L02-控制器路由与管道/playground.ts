/**
 * WHAT: Level 02 沙盒——实验各种 Pipe 和路由装饰器
 *
 * 实验建议：
 *   1. 修改 @Post() 的 DTO 类型 → 观察 ValidationPipe 的错误信息
 *   2. 创建一个 Pipe，把所有 name 自动加上 "VIP-" 前缀
 *   3. 尝试 @Res() 直接操作 Express Response → 观察与声明式的差异
 */
import "reflect-metadata";
import { NestFactory } from "@nestjs/core";
import {
  Module, Controller, Get, Post, Param, Body, Query,
  Injectable, PipeTransform, ArgumentMetadata, Logger,
  ValidationPipe, ParseIntPipe,
} from "@nestjs/common";
import { IsString, IsInt, Min } from "class-validator";

class PlayDto {
  @IsString() message!: string;
  @IsInt() @Min(1) priority!: number;
}

@Injectable()
class PlayService {
  process(dto: PlayDto) { return { ...dto, processed: true }; }
}

// WHAT: 实验自定义 Pipe——反转字符串
class ReversePipe implements PipeTransform<string, string> {
  transform(value: string, _metadata: ArgumentMetadata): string {
    return value?.split("").reverse().join("") ?? value;
  }
}

@Controller("play")
class PlayController {
  constructor(private readonly svc: PlayService) {}

  @Get("reverse/:text")
  reverse(@Param("text", ReversePipe) text: string) {
    return { original: text.split("").reverse().join(""), reversed: text };
  }

  @Get("square/:num")
  square(@Param("num", ParseIntPipe) num: number) {
    return { num, square: num * num };
  }

  @Post()
  create(@Body() dto: PlayDto) {
    return this.svc.process(dto);
  }
}

@Module({ controllers: [PlayController], providers: [PlayService] })
class PlayModule {}

async function bootstrap() {
  const app = await NestFactory.create(PlayModule);
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
  await app.listen(3001);
  console.log("Playground: http://localhost:3001/play");
}
bootstrap();
