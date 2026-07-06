/**
 * ============================================================
 * 第 03 章：控制器与路由
 * ============================================================
 *
 * 【学习目标】
 *   1. 掌握 @Controller() 路由前缀和 HTTP 方法装饰器
 *   2. 掌握路由参数装饰器：@Param()、@Query()、@Body()、@Headers()、@Ip()
 *   3. 掌握响应控制：@HttpCode()、@Redirect()、@Header()
 *   4. 理解异步处理：Promise 和 Observable 返回值
 *   5. 理解路由通配符和正则匹配
 *
 * 【与 Express/FastAPI/Spring/Django 的对比提示】
 *   - Express Router：NestJS Controller 相当于 Express Router + 中间件链的组合
 *   - FastAPI：两者的路由装饰器风格非常相似（@Get('/path')）
 *   - Spring @RestController：NestJS Controller 与之几乎一一对应，都标注路由+方法
 *   - Django：Django 的 URLConf 是集中式路由配置，NestJS 是分散式装饰器路由
 *
 * 【与 Vue3 前端的协作关系】
 *   - @Controller('users') 定义的路由前缀 = Vue Router 中的 /users 路径
 *   - @Get(':id') = Vue3 调用 axios.get('/users/123') 时的路由匹配
 *   - 参数装饰器对应的就是前端传来的各种数据（路径参数、查询参数、请求体）
 */

import {
  Controller,
  Get,
  Post,
  Put,
  Patch,
  Delete,
  All,
  Param,
  Query,
  Body,
  Headers,
  Ip,
  Req,
  Res,
  HttpCode,
  HttpStatus,
  Redirect,
  Header,
} from '@nestjs/common';
import type { Request, Response } from 'express';

// ============================================================
// 示例 1：@Controller() 前缀路由 + 所有 HTTP 方法装饰器
// ============================================================

/**
 * 【场景】定义一个用户资源的完整 CRUD 控制器
 * 【语法点】@Controller('users') 为所有路由添加 /users 前缀
 * 【NestJS 设计意图】RESTful 资源导向的路由设计，通过装饰器声明式定义端点
 * 【DI 容器行为】Controller 被 DI 容器实例化后，其路由信息被注册到 Express Router 上
 */
@Controller('users')
class UsersController {
  /* 定义顺序很重要：NestJS 路由匹配遵循从上到下、更具体优先的原则。
   * 具体的 HTTP 方法装饰器（@Get()、@Post() 等）优先级高于通配装饰器（@All()）。
   * 建议将具体路由写在前面，通配路由（如 @All()）写在最后作为兜底。
   */

  // GET /users —— 获取所有用户
  @Get()
  public findAll(): string {
    return '返回所有用户列表';
  }

  // GET /users/:id —— 获取单个指定用户（:id 是动态路径参数）
  @Get(':id')
  public findOne(@Param('id') id: string): string {
    return `返回用户 ${id}`;
  }

  // POST /users —— 创建用户
  @Post()
  public create(@Body() body: Record<string, unknown>): string {
    return `创建用户: ${JSON.stringify(body)}`;
  }

  // PUT /users/:id —— 指定用户的所有字段强制都更新，如果新提供的json缺失某个字段，那么就会变成缺失
  @Put(':id')
  public update(@Param('id') id: string, @Body() body: Record<string, unknown>): string {
    return `全量更新用户 ${id}: ${JSON.stringify(body)}`;
  }

  // PATCH /users/:id —— 指定用户的指定字段更新，只更新发过的参数
  @Patch(':id')
  public partialUpdate(@Param('id') id: string, @Body() body: Record<string, unknown>): string {
    return `部分更新用户 ${id}: ${JSON.stringify(body)}`;
  }

  // DELETE /users/:id —— 删除指定用户
  @Delete(':id')
  public remove(@Param('id') id: string): string {
    return `删除用户 ${id}`;
  }

  // @All() 匹配所有 HTTP 方法（慎用，常用于代理或通配路由）
  /* 当前 @All('wildcard') 只匹配 /users/wildcard 这个具体路径。 */
  @All('wildcard')
  public handleAllMethods(): string {
    return '处理所有 HTTP 方法';
  }
  /* 典型使用场景：
  1 代理转发，return this.httpService.request(req); // 将所有请求转发到其他服务
  2 通配路由/降级处理，throw new NotFoundException('路由不存在');
  3 调试/日志记录，console.log(`${req.method} ${req.url}`);
   */
}

// ============================================================
// 示例 2：路由参数装饰器详解
// ============================================================

/**
 * 【场景】演示所有参数装饰器的用法
 * 【语法点】@Param()、@Query()、@Body()、@Headers()、@Ip()、@Req()
 * 【NestJS 设计意图】声明式提取请求数据，避免手动 req.params/req.query
 *                   这些装饰器背后使用 reflect-metadata 记录参数位置和类型
 */
@Controller('demo')
class ParamsDemoController {
  /* 路径组成：带冒号的是动态变量（路径参数），不带冒号的是固定的静态路径段
    :userId - 第一个动态参数（用户 ID）
    posts - 静态路径段，显示固定路径
    :postId - 第二个动态参数（文章 ID）

  GET /demo/123/posts/456  // 获取用户 123 的第 456 篇文章
  GET /demo/999/posts/1  // 获取用户 999 的第 1 篇文章
   */
  @Get(':userId/posts/:postId')
  public getPost(
    @Param('userId') userId: string,
    @Param('postId') postId: string,
    @Param() allParams: Record<string, string>, // { userId: '1', postId: '42' }
  ): object {
    // 路径参数：
    // 1 @Param('key') 仅提取指定参数
    // 2 @Param() 获取整个params对象，会获取所有路径参数组成的对象
    return { userId, postId, allParams };
    // 请求: GET /params-demo/123/posts/456
    // userId = "123"
    // postId = "456"
    // allParams = { userId: "123", postId: "456" }
  }

  /* 查询参数：GET /demo/search?keyword=nestjs&page=1&limit=10 */
  @Get('search')
  public search(
    @Query('keyword') keyword: string, // 提取单个查询参数
    @Query('page') page: string,
    @Query('limit') limit: string,
    @Query() allQuery: Record<string, string>, // 获取所有查询参数
  ): object {
    /* allQuery = { keyword: "nestjs", page: "1", limit: "10" } */
    return { keyword, page, limit, allQuery };
  }

  /* 请求体：POST /demo/create  Content-Type: application/json */
  @Post('create')
  public create(
    @Body('name') name: string, // 提取 body 中的单个字段
    @Body() body: { name: string; email: string }, // 获取整个对象
  ): object {
    return { name, body };
  }

  /* 提取特定 Header，GET /demo/headers */
  @Get('headers')
  public getHeaders(
    @Headers('authorization') auth: string, // 获取单个参数
    @Headers() allHeaders: Record<string, string>, // 获取整个对象
  ): object {
    return { auth, contentType: allHeaders['content-type'] };
  }

  /* 提取客户端IP，GET /demo/ip */
  @Get('ip')
  public getIp(@Ip() ip: string): object {
    /* @Ip() 自动提取发起请求的客户端 IP 地址，等价于 req.ip 或 req.connection.remoteAddress */
    return { ip };
    /* 
    1 安全控制：throw new ForbiddenException('IP 被封禁'); // IP 黑名单/白名单
    2 访问限制（地域限制）：// 只允许特定地区访问
    3 审计日志：// 记录操作来源
    4 防刷限流：// 基于 IP 的速率限制
    5 数据统计：// 统计访问来源分布
    */
  }

  /* 原始Request对象（需要使用底层Express特性时使用） GET /demo/raw */
  @Get('raw')
  public raw(@Req() req: Request): object {
    /* 作用：获取原始的 Express Request 对象，这里的Request类型是Express里的类型
    @Req() 装饰器的功能：
      注入完整的底层 HTTP Request 对象，提供对 Express/Fastify 原生 API 的直接访问
    使用场景和目的：
      1 访问 NestJS 装饰器未覆盖的功能
      2 自定义复杂逻辑
      3 访问中间件添加的自定义属性
      4 文件上传处理
    为什么需要？
      1 NestJS 的装饰器（@Query()、@Body() 等）已经覆盖了 90% 的场景
      2 但某些边缘情况需要访问原始对象的完整能力
      3 @Req() 提供了"逃生舱"，让你能访问底层框架的所有特性
    */
    return {
      method: req.method,
      url: req.url,
      cookies: req.cookies,
    };
  }
}

// ============================================================
// 示例 3：状态码与响应控制
// ============================================================

/**
 * 【场景】精确控制 HTTP 响应状态码、重定向、响应头
 * 【语法点】@HttpCode()、@Redirect()、@Header()
 * 【NestJS 设计意图】声明式控制响应，避免在方法体内手动设置 res.status()
 */

/* HTTP 状态码含义：
  200 OK - 成功，有响应体
  201 Created - 创建成功，有响应体（通常返回新资源）
  204 No Content - 成功，无响应体
  400 Bad Request - 失败，客户端错误
  500 Internal Server Error - 失败，服务器错误
  */

@Controller('response-demo')
class ResponseControlController {
  /* POST /response-demo  POST方法默认返回 201，但可以通过 @HttpCode 修改 */
  @Post()
  @HttpCode(HttpStatus.NO_CONTENT) // 204 No Content - 成功，无响应体
  public createWithNoContent(): void {
    // 返回 void 配合 204，表示操作成功但无响应体
  }
  /* 
  只在正常执行完成时返回 204。如果出错了会抛出异常，返回对应的错误状态码。 
  @HttpCode() 只控制成功响应的状态码
  异常会覆盖这个设置，返回异常对应的状态码，NestJS 的异常过滤器会自动处理错误响应
  */

  /* 静态重定向 GET /response-demo/old-path → 301 重定向到新地址 */
  @Get('old-path')
  @Redirect('https://example.com/new-path', HttpStatus.MOVED_PERMANENTLY)
  public redirectPermanently(): void {}
  /* 
  静态重定向（固定目标），不需要任何实现！ 装饰器搞定一切，重定向的地址写在装饰器里就可以
  动态重定向（根据逻辑决定目标）， @Redirect() // 空装饰器，需要返回重定向配置对象
  */

  /* 动态重定向（根据业务逻辑决定目标 URL） GET /response-demo/dynamic-redirect */
  @Get('dynamic-redirect')
  @Redirect() // 空的 @Redirect() 表示下面返回重定向配置
  public dynamicRedirect(): { url: string; statusCode: number } {
    const isNewVersion: boolean = Math.random() > 0.5;
    return isNewVersion ? { url: '/v2/resource', statusCode: 302 } : { url: '/v1/resource', statusCode: 302 };
  }

  /* 主动设置Response响应对象的响应头  GET /response-demo/cached */
  @Get('cached')
  @Header('Cache-Control', 'public, max-age=3600')
  @Header('X-Custom-Header', 'nestjs-learn')
  public cachedResource(): object {
    /* 
    设置响应头 Cache-Control: public, max-age=3600，告诉浏览器这个响应可以缓存3600秒（1小时），浏览器在1小时内再次请求时，会直接使用缓存，不发请求
    设置自定义响应头 X-Custom-Header: nestjs-learn，可以在浏览器开发者工具的 Network 面板看到
    */
    return { data: '此响应会被浏览器缓存 1 小时' };
  }
  /* 
    1 缓存控制：@Header('Cache-Control', 'no-cache')
    2 跨域设置：@Header('Access-Control-Allow-Origin', '*')
    3 内容类型：@Header('Content-Type', 'text/plain')
    4 自定义业务标识：@Header('X-Request-ID', 'abc123')
  */
}

// ============================================================
// 示例 4：异步处理 —— Promise 与 Observable
// ============================================================

/**
 * 【场景】Controller 方法返回异步数据（数据库查询、外部 API 调用）
 * 【语法点】返回 Promise<T> 或 Observable<T>，NestJS 自动等待结果
 * 【NestJS 设计意图】Controller 无需关心同步/异步，NestJS 自动处理
 *                   返回 Observable 可用于流式响应和 WebSocket
 */
import { Observable, of } from 'rxjs';
import { delay } from 'rxjs/operators';

@Controller('async')
class AsyncController {
  /* 第一种异步方式：返回 Promise —— 最常用的异步方式 */
  /* GET /async/promise */
  @Get('promise')
  public async getAsyncData(): Promise<object> {
    const data: object = await this.simulateDbQuery();
    return { success: true, data };
  }
  // 模拟异步数据库查询
  private async simulateDbQuery(): Promise<object> {
    return new Promise<object>((resolve) => {
      setTimeout(() => {
        resolve({ id: 1, name: '用户1' });
      }, 500);
    });
  }

  /* 第二种异步方式：返回 Observable —— 支持流式处理（RxJS）不是很常用。在实际项目中，直接返回 Observable 的场景相对少见 */
  /* GET /async/observable */
  @Get('observable')
  public getStream(): Observable<object> {
    return of({ message: '流式响应' }).pipe(
      delay(1000), // 模拟 1 秒延迟
    );
  }
  /* 只在需要流式处理、实时推送时才考虑 Observable */
}

// ============================================================
// 示例 5：路由通配符与正则
// ============================================================

/**
 * 【场景】需要灵活匹配路由路径
 * 【语法点】* 匹配任意字符、? 匹配单个字符、括号内支持简单的正则
 * 【NestJS 设计意图】处理一些非标准的 URL 模式，但优先使用明确的路径定义
 */
@Controller('wildcard')
class WildcardController {
  /* 匹配 /wildcard/abcd 和 /wildcard/ab123cd 等（必须以 ab 开头、cd 结尾，中间可以是任意内容） */
  @Get('ab*cd')
  public wildcard(): string {
    return '匹配 ab*cd 模式';
  }

  /* 匹配 /wildcard/file1.txt 和 /wildcard/file2.txt 等（? 匹配单个字符），缺失字符和多个字符都是不行的 */
  @Get('file?.txt')
  public singleChar(): string {
    return '匹配 file?.txt 模式';
  }

  /* 
  匹配任何两段路径：/:resource/:id
  例如：/wildcard/users/123、/wildcard/posts/456、/wildcard/products/abc
  不匹配三段或更多段路径，如：/wildcard/users/123/comments
   */
  @Get(':resource/:id')
  public resource(@Param('resource') resource: string, @Param('id') id: string): object {
    return { resource, id };
  }
}

// ============================================================
// 示例 6：子域路由（Host 匹配）
// ============================================================

/**
 * 【场景】根据子域名分发请求（如 admin.example.com vs api.example.com）
 * 【语法点】@Controller({ host: 'admin.example.com' })
 * 【NestJS 设计意图】支持多租户、微前端等需要按域名分流的高级场景
 *  目的，实现子域名路由，不同的域名访问同一个应用时，路由到不同的控制器
 */

/* 静态固定的子域名路由，目的：管理后台、API 等固定模块*/
@Controller({ host: 'admin.localhost' })
class AdminController {
  @Get()
  public adminIndex(): string {
    return '管理后台首页 —— 只有访问 admin.localhost 才会匹配';
  }
}
/* 
场景：
1 多租户系统：
  @Controller({ host: 'tenant1.example.com' }) 
  @Controller({ host: 'tenant2.example.com' })
2 前后台分离：
  @Controller({ host: 'admin.example.com' })  // 管理后台 
  @Controller({ host: 'api.example.com' })    // API 服务
3 多语言版本
  @Controller({ host: 'en.example.com' })
  @Controller({ host: 'zh.example.com' })
*/

/* 动态可变的子域名路由，目的：一个应用服务多个租户（多租户 SaaS 系统） */
@Controller({ host: ':tenant.localhost' }) // 动态子域名
class TenantController {
  @Get()
  public tenantIndex(@Param('tenant') tenant: string): string {
    return `租户 ${tenant} 的首页`;
  }
}

// ============================================================
// ❌ 常见错误 1：@Body() 接收不到数据
// ============================================================

/**
 * 【错误现象】@Body() 获取的 body 为 undefined 或空对象 {}
 * 【错误原因】未全局注册 ValidationPipe 或未使用 class-transformer 的 DTO 类
 *            — 如果 Content-Type 不是 application/json，Express 默认不解析 body
 * 【正确写法】
 *   1. 在 main.ts 中全局注册 ValidationPipe
 *   2. 确保前端请求 Content-Type: application/json
 *   3. 使用 class-validator + DTO 类来接收
 */

// ❌ 错误写法：
// @Post()
// async create(@Body() body: CreateUserDto) {
//   console.log(body); // 如果是 form-data 请求，可能为空
// }

// ✅ 正确写法：
// // main.ts 中：
// app.useGlobalPipes(new ValidationPipe({ transform: true }));
//
// // DTO 定义：
// class CreateUserDto {
//   @IsString() name: string;
//   @IsEmail() email: string;
// }
//
// // Controller 中：
// @Post()
// async create(@Body() dto: CreateUserDto) { ... }

// ============================================================
// ❌ 常见错误 2：@Param() 参数名拼写错误
// ============================================================

/**
 * 【错误现象】@Param('id') 获取到 undefined
 * 【错误原因】@Param() 的参数名必须与路由中的 :paramName 完全一致
 * 【正确写法】检查参数名拼写，确保大小写一致
 */

// ❌ 错误写法：
// @Get(':userId')
// findOne(@Param('id') id: string) {}  // 'id' 与 ':userId' 不匹配

// ✅ 正确写法：
// @Get(':userId')
// findOne(@Param('userId') userId: string) {}  // 参数名必须一致

// ============================================================
// ❌ 常见错误 3：异步异常未捕获
// ============================================================

/**
 * 【错误现象】客户端收到 500 Internal Server Error，但没有自定义错误信息
 * 【错误原因】在 async 方法中抛出异常，但没有 try-catch，异常被 NestJS 默认处理
 * 【正确写法】使用 NestJS 内置异常类（如 NotFoundException），
 *            或让异常自然抛出由全局 ExceptionFilter 统一处理
 */

// ❌ 错误写法：抛出原始 Error
// @Get(':id')
// async findOne(@Param('id') id: string) {
//   const user = await this.userService.findById(id);
//   if (!user) throw new Error('用户不存在');  // 抛出JavaScript的原始Error，前端收到 500（服务器内部错误），响应体可能没有自定义错误信息
//   return user;
// }

// ✅ 正确写法：使用 NestJS 内置异常类
// @Get(':id')
// async findOne(@Param('id') id: string) {
//   const user = await this.userService.findById(id);
//   if (!user) {
//     throw new NotFoundException(`用户 ${id} 不存在`);  // 抛出NestJS的异常，NestJS 自动映射为正确的 HTTP 状态码，前端收到 404（资源未找到），响应体包含自定义错误信息
//   }
//   return user;
// }

console.log('=== 第 03 章示例代码结束 ===');

// ============================================================
// 本章小结
// ============================================================
/*
 * 【核心要点】
 *   - @Controller('prefix') 为所有路由添加统一前缀
 *   - HTTP 方法装饰器：@Get/@Post/@Put/@Patch/@Delete/@All
 *   - 参数装饰器：@Param/@Query/@Body/@Headers/@Ip，声明式提取数据
 *   - @HttpCode()/@Redirect()/@Header() 控制响应行为
 *   - Controller 调用异步方法可返回 Promise<T> 或 Observable<T>，NestJS 自动处理异步
 *   - 路由通配符 * 和 ? 支持灵活匹配
 *
 * 【与前后章的关联】
 *   - 第 02 章：Controller 必须在模块的 controllers 数组中注册才能生效
 *   - 第 04 章：Controller 通过构造函数注入 Service（DI 容器自动解析）
 *   - 第 06 章：DTO + ValidationPipe 让 @Body() 接收类型安全的数据
 *
 * 【常见面试题】
 *   Q: @Param() 和 @Query() 的区别是什么？
 *   A: @Param() 提取 URL 路径中的动态参数（/users/:id），
 *      @Query() 提取 URL 问号后的查询参数（/users?page=1）。
 *      @Param() 是必需的路由组成部分，@Query() 是可选的过滤/分页条件。
 *
 *   Q: NestJS Controller 如何支持异步？
 *   A: 方法返回 Promise<T> 时，NestJS 自动 await 结果；
 *      返回 Observable<T> 时，NestJS 自动订阅并等待完成。
 *      开发者无需手动调用 res.send()。
 */

// ============================================================
// 🎯 通关检查清单
// ============================================================
/*
 * [ ] 能写出完整的 CRUD Controller（5 个标准端点）
 * [ ] 能区分 @Param、@Query、@Body 的使用场景
 * [ ] 能使用 @HttpCode 和 @Redirect 控制响应
 * [ ] 能说出 NestJS Controller 与 Express Router 的差异
 * [ ] 能指出 1 个常见错误及修复方法
 */
