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
  // GET /users —— 获取所有用户
  @Get()
  public findAll(): string {
    return '返回所有用户列表';
  }

  // GET /users/:id —— 获取单个用户（:id 是动态路径参数）
  @Get(':id')
  public findOne(@Param('id') id: string): string {
    return `返回用户 ${id}`;
  }

  // POST /users —— 创建用户
  @Post()
  public create(@Body() body: Record<string, unknown>): string {
    return `创建用户: ${JSON.stringify(body)}`;
  }

  // PUT /users/:id —— 全量更新用户
  @Put(':id')
  public update(
    @Param('id') id: string,
    @Body() body: Record<string, unknown>,
  ): string {
    return `全量更新用户 ${id}: ${JSON.stringify(body)}`;
  }

  // PATCH /users/:id —— 部分更新用户
  @Patch(':id')
  public partialUpdate(
    @Param('id') id: string,
    @Body() body: Record<string, unknown>,
  ): string {
    return `部分更新用户 ${id}: ${JSON.stringify(body)}`;
  }

  // DELETE /users/:id —— 删除用户
  @Delete(':id')
  public remove(@Param('id') id: string): string {
    return `删除用户 ${id}`;
  }

  // @All() 匹配所有 HTTP 方法（慎用，常用于代理或通配路由）
  @All('wildcard')
  public handleAllMethods(): string {
    return '处理所有 HTTP 方法';
  }
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
  // 路径参数：@Param('key') 提取指定参数，也可以 @Param() 获取整个 params 对象
  @Get(':userId/posts/:postId')
  public getPost(
    @Param('userId') userId: string,
    @Param('postId') postId: string,
    @Param() allParams: Record<string, string>, // { userId: '1', postId: '42' }
  ): object {
    return { userId, postId, allParams };
  }

  // 查询参数：GET /demo/search?keyword=nestjs&page=1&limit=10
  @Get('search')
  public search(
    @Query('keyword') keyword: string, // 提取单个查询参数
    @Query() allQuery: { page: string; limit: string }, // 获取所有查询参数
  ): object {
    return { keyword, allQuery };
  }

  // 请求体：POST /demo/create  Content-Type: application/json
  @Post('create')
  public create(
    @Body() body: { name: string; email: string },
    @Body('name') name: string, // 提取 body 中的单个字段
  ): object {
    return { body, name };
  }

  // 请求头：提取特定 Header
  @Get('headers')
  public getHeaders(
    @Headers('authorization') auth: string,
    @Headers() allHeaders: Record<string, string>,
  ): object {
    return { auth, contentType: allHeaders['content-type'] };
  }

  // 客户端 IP
  @Get('ip')
  public getIp(@Ip() ip: string): object {
    return { ip };
  }

  // 原始 Request 对象（需要使用底层 Express 特性时使用）
  @Get('raw')
  public raw(@Req() req: Request): object {
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
@Controller('response-demo')
class ResponseControlController {
  // 默认 POST 返回 201，但可以通过 @HttpCode 修改
  @Post()
  @HttpCode(HttpStatus.NO_CONTENT) // 204 No Content
  public createWithNoContent(): void {
    // 返回 void 配合 204，表示操作成功但无响应体
  }

  // GET /response-demo/old-path → 301 重定向到新地址
  @Get('old-path')
  @Redirect('https://example.com/new-path', HttpStatus.MOVED_PERMANENTLY)
  public redirectPermanently(): void {}

  // 动态重定向（根据业务逻辑决定目标 URL）
  @Get('dynamic-redirect')
  @Redirect() // 空的 @Redirect() 表示下面返回重定向配置
  public dynamicRedirect(): { url: string; statusCode: number } {
    const isNewVersion: boolean = Math.random() > 0.5;
    return isNewVersion
      ? { url: '/v2/resource', statusCode: 302 }
      : { url: '/v1/resource', statusCode: 302 };
  }

  // 设置自定义响应头
  @Get('cached')
  @Header('Cache-Control', 'public, max-age=3600')
  @Header('X-Custom-Header', 'nestjs-learn')
  public cachedResource(): object {
    return { data: '此响应会被浏览器缓存 1 小时' };
  }
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
  // 返回 Promise —— 最常用的异步方式
  @Get('promise')
  public async getAsyncData(): Promise<object> {
    const data: object = await this.simulateDbQuery();
    return { success: true, data };
  }

  // 返回 Observable —— 支持流式处理（RxJS）
  @Get('observable')
  public getStream(): Observable<object> {
    return of({ message: '流式响应' }).pipe(
      delay(1000), // 模拟 1 秒延迟
    );
  }

  // 模拟异步数据库查询
  private async simulateDbQuery(): Promise<object> {
    return new Promise<object>((resolve) => {
      setTimeout(() => {
        resolve({ id: 1, name: '用户1' });
      }, 500);
    });
  }
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
  // 匹配 /wildcard/ab 和 /wildcard/abcd 和 /wildcard/ab_anything
  @Get('ab*cd')
  public wildcard(): string {
    return '匹配 ab*cd 模式';
  }

  // 匹配 /wildcard/users/123 和 /wildcard/posts/456
  // 但不匹配 /wildcard/users/123/comments
  @Get(':resource/:id')
  public resource(
    @Param('resource') resource: string,
    @Param('id') id: string,
  ): object {
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
 */
@Controller({ host: 'admin.localhost' })
class AdminController {
  @Get()
  public adminIndex(): string {
    return '管理后台首页 —— 只有访问 admin.localhost 才会匹配';
  }
}

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

// ❌ 错误写法：
// @Get(':id')
// async findOne(@Param('id') id: string) {
//   const user = await this.userService.findById(id);
//   if (!user) throw new Error('用户不存在');  // 原始 Error，前端收到 500
//   return user;
// }

// ✅ 正确写法：
// @Get(':id')
// async findOne(@Param('id') id: string) {
//   const user = await this.userService.findById(id);
//   if (!user) {
//     throw new NotFoundException(`用户 ${id} 不存在`);  // 前端收到 404
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
 *   - Controller 方法可返回 Promise<T> 或 Observable<T>，NestJS 自动处理异步
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
