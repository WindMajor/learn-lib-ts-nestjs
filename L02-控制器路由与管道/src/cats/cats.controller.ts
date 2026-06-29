import {
  Controller,
  Get,
  Post,
  Param,
  Query,
  Body,
  Headers,
  HttpCode,
  HttpStatus,
  Redirect,
  ParseIntPipe,
  Logger,
  DefaultValuePipe,
} from "@nestjs/common";
import { CatsService, Cat } from "./cats.service";
import { CreateCatDto } from "./dto/create-cat.dto";
import { UppercasePipe, OptionalIntPipe } from "../pipes/uppercase.pipe";

/**
 * WHAT: 增强版 CatsController——覆盖所有 HTTP 方法、参数来源和内置 Pipe
 *
 * WHY: 本 Controller 刻意展示了 NestJS 路由装饰器的全貌。
 *   每个方法都有注释说明装饰器的作用和底层 Express 等价代码。
 *
 * 【请求处理管线回顾】
 *   HTTP Request → Middleware → Guard → Interceptor → Pipe → Controller → Response
 *
 * LIFECYCLE: 每个请求到达时，NestJS 按以下顺序处理：
 *   1. 匹配路由（根据 @Controller 前缀 + 方法装饰器路径）
 *   2. 执行全局/模块/控制器/方法级别的 Guard
 *   3. 执行全局/模块/控制器/方法级别的 Interceptor（前半部分）
 *   4. 对每个参数执行 Pipe（transform 方法）
 *   5. 调用 Controller 方法（传入 Pipe 处理后的参数）
 *   6. 执行 Interceptor（后半部分，包括响应处理）
 */
@Controller("cats")
export class CatsController {
  constructor(private readonly catsService: CatsService) {}
  private readonly logger = new Logger(CatsController.name);

  // =====================================================
  // GET /cats —— 获取所有猫（基础 GET 示例）
  // =====================================================
  @Get()
  findAll(): Cat[] {
    this.logger.log("GET /cats");
    return this.catsService.findAll();
  }

  // =====================================================
  // GET /cats/:id —— 获取指定猫（@Param + ParseIntPipe）
  // =====================================================
  @Get(":id")
  findOne(
    // WHAT: ParseIntPipe 自动将 URL 字符串 '1' 转为 number 1
    // WHY: 路由参数 'id' 从 URL 中提取，默认是 string 类型
    //   ParseIntPipe 做了两件事：
    //   1. 尝试 parseInt(value) → 如果成功，返回 number
    //   2. 如果失败（如 'abc'）→ 抛出 BadRequestException → 自动返回 400
    // 【对比 Express】Express 中需要手动 parseInt(req.params.id) + isNaN 检查
    @Param("id", ParseIntPipe) id: number,
  ): Cat {
    this.logger.log(`GET /cats/${id}`);
    return this.catsService.findOne(id);
  }

  // =====================================================
  // GET /cats/breed/:breed —— 按品种查询（自定义 Pipe）
  // =====================================================
  @Get("breed/:breed")
  findByBreed(
    // WHAT: 自定义 UppercasePipe——将品种名转为大写
    // WHY: 演示如何用 Pipe 做数据转换——避免在 Controller 中写 toUpperCase()
    @Param("breed", UppercasePipe) breed: string,
  ): Cat[] {
    this.logger.log(`GET /cats/breed/${breed}`);
    return this.catsService.findByBreed(breed);
  }

  // =====================================================
  // GET /cats/search?name=xxx&minAge=2 —— 搜索（@Query）
  // =====================================================
  @Get("search")
  search(
    // WHAT: @Query('name') 提取查询参数 ?name=xxx
    // 【对比 Express】req.query.name
    // 【对比 Spring】@RequestParam("name")
    @Query("name") name?: string,

    // WHAT: OptionalIntPipe 处理可能不存在的可选参数
    @Query("minAge", OptionalIntPipe) minAge?: number,

    // WHAT: DefaultValuePipe——当参数缺失时使用默认值
    // 这避免了在 Controller 中写 if (!limit) limit = 10
    @Query("limit", new DefaultValuePipe(10), ParseIntPipe) limit: number,
  ): Cat[] {
    this.logger.log(`GET /cats/search?name=${name}&minAge=${minAge}&limit=${limit}`);
    const result = this.catsService.search(name, minAge);
    return result.slice(0, limit);
  }

  // =====================================================
  // POST /cats —— 创建猫（@Body + DTO + ValidationPipe）
  // =====================================================
  @Post()
  // WHAT: @HttpCode(201) 设置响应状态码为 201 Created
  // 【对比 Express】res.status(201).json(...)
  // 【区别】NestJS 默认 POST 返回 201，GET 返回 200，可用 @HttpCode 覆盖
  @HttpCode(HttpStatus.CREATED)
  create(
    // WHAT: @Body() 提取请求体，并自动通过全局 ValidationPipe 验证
    // 如果 DTO 验证失败（如 name 不是 string），ValidationPipe 会抛出异常
    // → 自动返回 400 Bad Request + 详细的验证错误信息
    //
    // 【核心原理——ValidationPipe 的处理流程】
    //   1. 读取请求体 JSON → { name: "小黄", age: "2", breed: "田园猫" }
    //   2. 发现 @Body() 的类型是 CreateCatDto（通过装饰器元数据）
    //   3. plainToInstance(CreateCatDto, body) —— 将普通对象转为 DTO 实例
    //      （配合 transform: true 时生效）
    //   4. validate(dtoInstance) —— 检查 @IsString/@IsInt/@Min 等约束
    //   5. 如果 age 传入字符串 "2" 且 transform:true → 自动转为 number 2
    //   6. 验证通过 → 将 dtoInstance 传给 Controller 方法
    //   7. 验证失败 → 抛出 BadRequestException → 自动返回 400
    @Body() createCatDto: CreateCatDto,
  ): Cat {
    this.logger.log(`POST /cats body=${JSON.stringify(createCatDto)}`);
    return this.catsService.create(createCatDto);
  }

  // =====================================================
  // POST /cats/with-headers —— 读取请求头（@Headers）
  // =====================================================
  @Post("with-headers")
  createWithHeaders(
    @Body() createCatDto: CreateCatDto,
    // WHAT: @Headers('authorization') 提取特定请求头
    // 类似于 Express 的 req.headers['authorization']
    @Headers("authorization") authHeader: string,

    // WHAT: @Headers() 获取所有请求头对象
    @Headers() allHeaders: Record<string, string>,
  ): { cat: Cat; hadAuth: boolean } {
    this.logger.log(`POST /cats/with-headers auth=${!!authHeader}`);
    const cat = this.catsService.create(createCatDto);
    return {
      cat,
      hadAuth: !!authHeader,
    };
  }

  // =====================================================
  // GET /cats/redirect —— 重定向示例
  // =====================================================
  @Get("redirect")
  // WHAT: @Redirect() 返回 302 重定向
  // 【对比 Express】res.redirect('https://...')
  @Redirect("https://docs.nestjs.com", 302)
  redirectToDocs() {
    // 直接重定向，不需要返回值
    this.logger.log("重定向到 NestJS 文档");
    // 可以动态返回重定向目标：
    // return { url: 'https://docs.nestjs.com/controllers', statusCode: 301 };
  }
}
