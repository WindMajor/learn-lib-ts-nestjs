/**
 * ============================================================
 * 第 09 章：守卫与权限控制
 * ============================================================
 *
 * 【学习目标】
 *   1. 理解守卫的本质：决定请求是否被允许通过（返回 true/false）
 *   2. 掌握 CanActivate 接口和 ExecutionContext 的使用
 *   3. 掌握 @SetMetadata() + Reflector 实现声明式角色权限
 *   4. 理解 JWT Guard 的工作流程
 *   5. 掌握守卫 vs 中间件的区别：守卫拥有 ExecutionContext + Reflector（元数据），中间件只有 req/res/next
 *
 * 【与 Express/FastAPI/Spring/Django 的对比提示】
 *   - Express：通常用中间件做鉴权（req, res, next → res.status(401)）
 *   - FastAPI：Depends 函数 + HTTPBearer 与 Guard 概念相似
 *   - Spring：Spring Security 的 Filter Chain + @PreAuthorize("hasRole('ADMIN')")
 *   - Django：Permission Classes + @permission_classes 装饰器
 *
 * 【与 Vue3 前端的协作关系】
 *   - 守卫 = Vue Router 的 beforeEach 导航守卫（决定能否进入路由）
 *   - @Roles('admin') = Vue3 路由 meta: { roles: ['admin'] }
 *   - 前端路由守卫阻止 UI 跳转，后端守卫阻止 API 调用 —— 双重保护
 */

import { Injectable, CanActivate, ExecutionContext, SetMetadata, UseGuards, Global, Module, UnauthorizedException, ForbiddenException } from '@nestjs/common';
import { Reflector, APP_GUARD } from '@nestjs/core';
import type { Request } from 'express';
import { Observable } from 'rxjs';
/* 
Observable 是 RxJS（Reactive Extensions for JavaScript）的核心类型。它是一个惰性推送的、多值的数据流——可以随时间发出 0 到多个值，并最终完成或报错。
在实际项目中，绝大多数守卫只用 boolean 或 Promise<boolean> 就足够了，Observable<boolean> 更多出现在微服务或 WebSocket 网关的守卫中。
这个 import 是一个"保留导入"——它告诉学习者："NestJS 守卫支持 Observable 返回类型，虽然本章没用到，但你应该知道它的存在。"
*/

/* 
Guard 只能守护 Controller（或者说路由 Handler）

// ✅ 类级别 —— 守护整个 Controller 的所有方法
@UseGuards(AuthGuard)
@Controller('users')
class UsersController { ... }

// ✅ 方法级别 —— 只守护这一个路由
@Controller('users')
class UsersController {
  @Get('admin')
  @UseGuards(AdminGuard)   // 只有这个方法受 AdminGuard 保护
  getAdminData() { ... }
}

// ✅ 全局 —— 通过 APP_GUARD 守护所有路由
// Module 中：{ provide: APP_GUARD, useClass: AuthGuard }

// ❌ 不能放在 Service 上
// @UseGuards(AuthGuard)   ← 无意义，编译报错或不生效
// class UserService { ... }

*/

// ============================================================
// 示例 1：守卫基础 —— 实现 CanActivate 接口
// ============================================================

/**
 * 【场景】最简守卫：检查请求头中是否有 Authorization Header
 * 【语法点】实现 CanActivate 接口，返回 boolean | Promise<boolean> | Observable<boolean>
 * 【NestJS 设计意图】守卫是一种「二进制决策」（返回 true/false），决定请求能通过或不能通过
 *                   与中间件不同，守卫拥有 ExecutionContext（知道目标 Controller 和方法）
 *                   且能通过 Reflector 读取 @SetMetadata() 装饰器元数据
 * 【ExecutionContext】比 ArgumentsHost 更强大，能获取 Class（控制器）和 Handler（方法）的引用
 */
@Injectable()
class SimpleAuthGuard implements CanActivate {
  public canActivate(context: ExecutionContext): boolean {
    const request: Request = context.switchToHttp().getRequest<Request>();
    /* 
    context.switchToHttp() 切换到HTTP模式，声明"我要处理的是 HTTP 协议"，返回值是一个 HttpArgumentsHost，专门给出 HTTP 模式的工具方法
    .getRequest<Request>() 取出Express的req对象

    为什么不能直接拿 req？
      中间件是直接拿的：use(req: Request, res: Response, next: NextFunction) { ... }
      但 Guard 不一样——它拿到的是 ExecutionContext，一个"多面手"包装器。原因是 NestJS 不只服务 HTTP 一种协议：
                         ┌── HTTP（Express/Fastify）
      ExecutionContext ──┼── WebSocket（Socket.io）
                         └── Microservice（TCP/Redis/NATS/gRPC）

      同一个 Guard 配置可能被用在不同协议的 handler 上，所以 NestJS 先给你一个统一的 ExecutionContext，你需要显式声明"我处理的是 HTTP"，才能拿到对应的底层对象。

    */

    const authHeader: string | undefined = request.headers['authorization'];
    /* 从 HTTP 请求中取出 Authorization 请求头，这是 HTTP 协议标准的认证字段
    目的：守卫需要知道"你是谁"，Authorization 头就是客户端报上来的身份凭证。没有它，守卫直接拒绝
    */

    if (!authHeader) {
      console.log('没有 Authorization Header，拒绝访问');
      throw new UnauthorizedException('缺少 Authorization 请求头');
    }

    return true; // 允许通过
  }
}

// ============================================================
// 示例 2：ExecutionContext 深度使用
// ============================================================

/**
 * 【场景】守卫需要知道是哪个 Controller 的哪个方法被调用
 * 【语法点】context.getClass() 获取 Controller 类，context.getHandler() 获取方法引用
 * 【NestJS 设计意图】ExecutionContext 提供完整的调用上下文，让守卫能根据目标类/方法做出决策
 */
@Injectable()
class ExecutionContextDemoGuard implements CanActivate {
  public canActivate(context: ExecutionContext): boolean {
    // 获取目标 Controller 类
    const controllerClass = context.getClass();
    /* 拿到当前请求命中的那个 Controller 类的构造函数引用

      // 假设有这样一个 Controller
      @Controller('users')
      @UseGuards(MyGuard)
      class UsersController {
        @Get(':id')
        findOne() { ... }
      }
      // 当请求 GET /users/1 进入 MyGuard 时：
      const ctrl = context.getClass();
      ctrl.name           // → "UsersController"
      // ctrl 就是 UsersController 这个类本身，不是实例

    目的：让守卫知道自己守卫的是谁，从而能做出基于目标的差异化决策
    为什么中间件做不到这个？中间件在第一环执行，此时 NestJS 还没做路由匹配，不知道"后面是谁处理这个请求"。Guard 在中间件之后、路由匹配之后执行，所以它知道答案。
     */

    const controllerName: string = controllerClass.name;
    /* 得到了当前请求命中的 Handler 所属的类的类名称
    在 HTTP 和微服务的场景下这就是 Controller，在 WebSocket 场景下就是 Gateway。
    */

    console.log(`守卫：拦截 Controller "${controllerName}"`);

    // 获取目标方法
    const handler = context.getHandler();
    /* 
    返回当前请求将要调用的那个 Controller 方法（Handler）的函数引用
      @Controller('users')
      class UsersController {
        @Get()
        findAll() { ... }       // ← 请求 GET /users 命中 → handler = findAll

        @Get(':id')
        findOne() { ... }       // ← 请求 GET /users/1 命中 → handler = findOne
      }
    目的：让守卫从"知道是哪个 Controller"进一步精确到**"知道是哪个方法"**，实现更细粒度的权限控制

     */
    const methodName: string = handler.name;
    console.log(`守卫：拦截方法 "${methodName}"`);

    // 获取 HTTP 请求对象
    const request: Request = context.switchToHttp().getRequest<Request>();
    console.log(`守卫：请求路径 ${request.method} ${request.url}`);

    return true;
  }
}

// ============================================================
// 示例 3：JWT 认证 Guard（核心示例）
// ============================================================

/**
 * 【场景】验证 JWT Token，提取用户信息并附加到 request 上
 * 【语法点】注入 JwtService，解析 Token，将用户信息挂到 request.user
 * 【NestJS 设计意图】Guard 可以操作 request 对象（如附加 user），
 *                   下游的 Controller 和 Service 可以直接使用 request.user
 */

// 模拟 JwtService（实际来自 @nestjs/jwt）
// 统一角色类型
type Role = 'USER' | 'EDITOR' | 'ADMIN';

interface JwtPayload {
  sub: number; // 用户 ID
  email: string;
  role: Role;
  iat: number; // 签发时间
  exp: number; // 过期时间
}

interface AttachedUser {
  id: number;
  email: string;
  role: Role;
}

@Injectable()
class MockJwtService {
  public verify(token: string): JwtPayload {
    // 实际使用 jsonwebtoken 库的 verify 方法
    // 此处简化：假设 Token 合法
    return {
      sub: 1,
      email: 'user@example.com',
      role: 'USER',
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + 604800,
    };
  }
}

// 扩展 Express Request 类型（实际放在 types/express.d.ts 中）
interface AuthenticatedRequest extends Request {
  user: AttachedUser; // ← 扩展出来的额外属性
}

@Injectable()
class JwtAuthGuard implements CanActivate {
  constructor(private readonly jwtService: MockJwtService) {}

  public canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    /* 
    和之前 getRequest<Request>() 一样取 req 对象，但这次泛型参数换成了AuthenticatedRequest
    因为 Express 原生的 Request 类型没有 user 字段，而这个 Guard 需要往 request.user 上挂载用户信息
    目的：让 TypeScript 允许你在 request 上读写 .user
    */

    const token: string | undefined = this.extractTokenFromHeader(request);
    /* 提取Token */

    if (!token) {
      // 抛出 UnauthorizedException 比返回 false 更好：客户端得到明确的 401 + 友好提示
      throw new UnauthorizedException('请先登录'); // 401 未认证
    }
    /* 
    401（未认证）vs 403（未授权）的区别：
      没带 Token → 401；
      带了 Token 但权限不够 → 403
    这样有了语义区分，前端也能根据状态码做不同处理（401 → 跳登录页，403 → 提示无权限）
    */

    try {
      const payload: JwtPayload = this.jwtService.verify(token);
      /* 
      作用：对 JWT Token 做验签 + 解码，证明 Token 是服务器签发的、没有被篡改，并取出里面存的用户信息
      目的：JWT 的核心理念是自包含——用户信息直接编码在 Token 里面，不需要查数据库。verify() 之后 Guard 就能拿到用户身份，接着把它挂到 request.user 上
      这里可能抛出异常：
        Token 过期	  exp 时间戳已经过了
        签名不匹配	   Token 被篡改或用了错误密钥
        格式不对	     不是三段 base64url 结构
        发行者不对  	 iss 字段不匹配预期
      */

      // 将用户信息附加到 request 上（下游可用 @Req() 获取）
      request.user = {
        id: payload.sub,
        email: payload.email,
        role: payload.role,
      };
      return true;
      /* return true 只是表示"放行"，request 对象本身是引用传递，Guard 往它身上挂的 .user 会原封不动地流转到 Interceptor、Controller、Service 中 */
    } catch (error) {
      console.error('Token 验证失败:', error);
      throw new UnauthorizedException('Token 无效或已过期');
    }
  }

  private extractTokenFromHeader(request: Request): string | undefined {
    /* extract 提取 */

    const authHeader: string | undefined = request.headers['authorization'];
    /* 从 HTTP 请求中取出 Authorization 请求头，这是 HTTP 协议标准的认证字段
    目的：守卫需要知道"你是谁"，Authorization 头就是客户端报上来的身份凭证。没有它，守卫直接拒绝
    */
    if (!authHeader) return undefined; // 连头部都没有

    const [type, token] = authHeader.split(' ');
    /* 
    按空格切开 Authorization 头，把"方案名"和"凭证"拆成两个变量，解构赋值
      "Bearer eyJhbGciOiJI...".split(' ') // → ["Bearer", "eyJhbGciOiJI..."]
    */

    return type === 'Bearer' ? token : undefined;
    /* 
    对认证方案做最后一道校验：是 Bearer 就返回纯 Token，不是就返回 undefined（视为无效）。
    Authorization 头有很多种方案，这个 Guard 只认 Bearer（JWT）：
      // ✅ 通过
      "Bearer eyJhbGciOiJI..."  → type="Bearer" → 返回 "eyJhbGciOiJI..."

      // ❌ 拒绝 —— 不是 JWT，返回 undefined
      "Basic YWRtaW46..."       → type="Basic"  → 返回 undefined
      "Digest abc..."           → type="Digest" → 返回 undefined
      "ApiKey 12345"            → type="ApiKey" → 返回 undefined
    */
  }
}

// ============================================================
// 示例 4：@SetMetadata() + Reflector 实现角色权限（RBAC 核心）
// ============================================================
/**
 * 【场景】声明式角色控制：@Roles('admin') 装饰器 + RolesGuard
 * 【语法点】@SetMetadata() 存储元数据，Reflector 读取元数据
 * 【NestJS 设计意图】元数据是 Guard 的核心能力——让装饰器成为 Guard 的"配置语言"
 *                   这与 Spring Security 的 @PreAuthorize 理念完全一致
 */

/* 
RBAC（Role-Based Access Control）角色访问控制
是啥：不是给每个用户单独分配权限，而是创建"角色"，把权限打包给角色，再把角色赋给用户，用户不直接接触权限，必须通过角色这个"中间层"
作用与目的：把权限管理从 O(n×m) 降到 O(n+m)
                          不用 RBAC	          用 RBAC
  100 用户 × 20 权限	    2000 条关系	           3 个角色 + 100 条用户-角色关系
  新增一个管理员	          逐条赋 20 个权限	    给 ADMIN 角色即可
  新增一个权限"导出报表"	  逐个用户赋权	          给 ADMIN 角色加这个权限，所有管理员自动继承

一句话：RBAC 就是在用户和权限之间插入"角色"这个中间层，让权限分配从"逐人逐项"变成"改一次角色，所有人自动同步"，本质是用间接层消除复杂度——这是软件工程中最经典的解耦思想之一。
*/

// 1. 定义角色元数据的 Key（使用 Symbol 保证唯一性，避免与其他元数据 Key 冲突）
const ROLES_KEY: unique symbol = Symbol('roles');

// 2. 创建 @Roles() 装饰器（组合 @SetMetadata）
const Roles = (...roles: Role[]): MethodDecorator & ClassDecorator => {
  return SetMetadata(ROLES_KEY, roles);
};

// 3. 创建 RolesGuard
@Injectable()
class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  public canActivate(context: ExecutionContext): boolean {
    // 从目标方法和目标类上读取 @Roles() 设置的元数据
    // getAllAndOverride: 方法级 > 类级（方法级覆盖类级）
    const requiredRoles: Role[] | undefined = this.reflector.getAllAndOverride<Role[]>(ROLES_KEY, [context.getHandler(), context.getClass()]);
    /* 
    作用：从方法和类两个目标上读取 @Roles() 设置的元数据，方法级覆盖类级，返回第一个非 undefined 的值。
    数组顺序决定优先级——getHandler() 在前，getClass() 在后：
      // 场景 A：方法上有 @Roles
      @Roles('USER')                    // ← 类级：允许 USER
      class PostsController {
        @Roles('ADMIN')                 // ← 方法级：只有 ADMIN
        deletePost() { ... }
      }
      // → 查 getHandler() → 有值 ['ADMIN'] → 返回 ['ADMIN']
      //   getClass() 不查了

      // 场景 B：只有类上有 @Roles
      @Roles('USER')                    // ← 只有类级
      class PostsController {
        getPosts() { ... }              // ← 方法上没有 @Roles
      }
      // → 查 getHandler() → undefined → 接着查 getClass() → ['USER'] → 返回 ['USER']

      // 场景 C：都没有 @Roles
      class PostsController {
        getPublicPosts() { ... }        // ← 公开接口
      }
      // → 查 getHandler() → undefined → 查 getClass() → undefined → 返回 undefined

    为什么不用 get() 而用 getAllAndOverride()？
      方法                   行为                        适合场景
      get()	                只查单个目标	                只关心方法或只关心类
      getAll()	            查所有目标，返回数组的数组	    [['ADMIN'], ['USER']]
      getAllAndMerge()	    查所有目标，合并数组	         类 + 方法角色取并集
      getAllAndOverride()	  查所有目标，方法覆盖类 ✅	    RBAC：方法级权限优先
    */

    // 如果没有 @Roles() 装饰器，说明不需要角色权限，直接放行
    if (!requiredRoles || requiredRoles.length === 0) {
      return true;
    }

    // 从 JwtAuthGuard 附加的 user 中获取角色
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const user: AttachedUser = request.user;

    if (!user) {
      // JwtAuthGuard 未执行或 user 未挂载（如全局只注册了 RolesGuard 而忘了 JwtAuthGuard）
      throw new ForbiddenException('无法获取用户信息');
    }

    // 检查用户角色是否在允许的角色列表中
    return requiredRoles.some((role: Role) => user.role === role);
    /* 作用：检查用户拥有的那个角色是否出现在接口要求的角色列表中。只要命中一个就放行
    为什么用 some 而不是 includes？
      // 两种写法等价
      requiredRoles.some(role => user.role === role)
      requiredRoles.includes(user.role)
    用 some 的考量：
      语义更清晰："要求角色列表中，是否存在一个角色，用户的角色等于它？" → 这就是 RBAC 检查的原生表达
      includes 写法更短但语义上把 requiredRoles 当成了被查找的集合，而 some 更贴合"逐个检查"的心智模型
    一句话：some() 就是"白名单匹配器"——用户的角色只要出现在接口要求的角色白名单中，就算通过
    */
  }
}

// 4. 使用示例
// 示例 A：类级别守卫 —— 所有方法统一保护
@UseGuards(JwtAuthGuard, RolesGuard)
class GuardDemoController {
  // 没有 @Roles → RolesGuard 放行（但 JwtAuthGuard 仍需要 Token）
  public getPublicData(): string {
    return '公开数据';
  }

  // 有 @Roles：JwtAuthGuard + RolesGuard 两个守卫先后串行，按声明顺序，必须同时通过（AND 逻辑）
  // JwtAuthGuard 验证 Token → RolesGuard 验证角色要求为 ADMIN
  @Roles('ADMIN')
  public getAdminData(): string {
    return '管理员数据';
  }

  // 允许 EDITOR 或 ADMIN
  @Roles('EDITOR', 'ADMIN')
  public managePosts(): string {
    return '文章管理';
  }
}

// 示例 B：方法级守卫覆盖类级守卫
// 核心规则：只要方法上写了 @UseGuards()，就会完全替换类级守卫，不是追加！
// 类级 → @UseGuards(JwtAuthGuard, RolesGuard) 两个守卫对所有方法生效
// 方法级 → @UseGuards(XXX) 单独写，类级守卫一个都不剩
@UseGuards(JwtAuthGuard, RolesGuard) // ← 类级：所有方法默认需要 JWT + 角色
class MethodLevelDemoController {
  // ✅ 没写 @UseGuards → 继承类级的 JwtAuthGuard + RolesGuard
  @Roles('ADMIN')
  public getAdminData(): string {
    return '管理员数据';
  }

  // ✅ 写了 @UseGuards(SimpleAuthGuard) → 类级的 JwtAuthGuard 和 RolesGuard 全被替换
  @UseGuards(SimpleAuthGuard)
  public simpleCheck(): string {
    return '安全检查（仅需 Authorization 头）';
  }

  // ✅ 写了 @UseGuards(JwtAuthGuard) → 类级的 RolesGuard 被替换了，只剩 JwtAuthGuard
  @UseGuards(JwtAuthGuard)
  public getProfile(): string {
    return '个人资料（仅需登录）';
  }
}

// ============================================================
// 示例 5：守卫组合与全局守卫
// ============================================================

/**
 * 【场景】组合多个守卫、全局注册守卫
 * 【语法点】@UseGuards(Guard1, Guard2) 顺序执行
 *          APP_GUARD Token 注册全局守卫
 * 【NestJS 设计意图】守卫是可以堆叠的——每个守卫只关注一个职责
 */

// 守卫 1：检查 IP 白名单
@Injectable()
class IpWhitelistGuard implements CanActivate {
  private readonly allowedIps: Set<string> = new Set(['127.0.0.1', '::1', '::ffff:127.0.0.1']);

  public canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<Request>();
    const ip: string = (request.ip ?? '') || (request.socket.remoteAddress ?? ''); // || 是短路求值，左边有非空值就直接返回，只有左边是空值才会执行右边
    /* 
    作用：获取客户端的真实 IP，两路兜底就是为了覆盖"有代理"和"没代理"两种场景，确保永远拿得到（最差也能拿到原始 TCP 连接的 IP）。
    第一路：request.ip。
      取 Express 自带的 req.ip 属性——它有"代理感知"能力
    第二路：request.socket.remoteAddress
      取原始 TCP socket 的 IP——永远能拿到，但完全没有代理感知。如果在 nginx 后面，它只能拿到 nginx 的内网 IP。

    ① request.ip 是什么？
      ├── null/undefined → '' → ②
      ├── ''            → ②
      └── '1.2.3.4'    → 直接返回 ✅
    ② request.socket.remoteAddress 是什么？
      ├── null/undefined → '' → 返回空串（安全的哨兵值）
      └── '1.2.3.4'      → 返回 ✅

    为什么需要两路？
      场景	                      request.ip	        socket.remoteAddress
      裸连（无代理）	              客户端 IP ✅	        客户端 IP ✅（一样）
      有代理 + trust proxy	       客户端真实 IP ✅	    nginx 内网 IP ❌
      有代理 + 未设 trust proxy	    nginx 内网 IP ❌	     nginx 内网 IP ❌
      两个都异常（极罕见）	          空 ✅	              空 ✅

    */

    if (!this.allowedIps.has(ip)) {
      console.log(`IP ${ip} 不在白名单中`);
      throw new ForbiddenException('IP 不在白名单中');
    }

    return true; // IP 在白名单中 → 放行进入下一步
  }
}

// 守卫 2：检查 Content-Type（要求 JSON 格式）
@Injectable()
class ContentTypeGuard implements CanActivate {
  public canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<Request>();
    const method: string = request.method.toUpperCase();
    /* 作用：获取到当前HTTP的方法，然后把 HTTP 方法统一转成大写，确保后续比较不出错 */

    const contentType: string | undefined = request.headers['content-type'];
    /* 
    作用：取出HTTP请求头中的Content-Type，它告诉服务器我发过来的请求体是什么格式，比如："application/json"
    目的：防止客户端用错误的格式发数据。如果客户端发了 text/plain 或 multipart/form-data，服务端按照 JSON 解析就会出错或行为异常。
    */

    // 只对有请求体的方法做检查（GET/DELETE 等不需要）
    const hasBody: boolean = ['POST', 'PUT', 'PATCH'].includes(method);
    if (hasBody && (!contentType || !contentType.includes('application/json'))) {
      /* 有请求体但 Content-Type 不是 JSON → 抛异常，NestJS 自动转为 403 响应 */
      throw new ForbiddenException(`Content-Type 必须为 application/json，当前为 ${contentType ?? '缺失'}`);
    }

    return true;
  }
}

// 守卫 3：API Key 验证（服务间调用）
@Injectable()
class ApiKeyGuard implements CanActivate {
  public canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<Request>();
    const apiKey: string | undefined = request.headers['x-api-key'] as string | undefined;
    /* 
    作用：取出自定义 Header x-api-key，用于服务间调用的身份验证
    Authorization: Bearer xxx 是给人（前端用户）用的
    x-api-key 是给机器（后端服务）用的：调用DeepSeek等 AI 大模型 API 时传的 sk-xxx 就是这种 API Key，本质一模一样。
    场景不同，Header 不同：
                JWT (Authorization)	         API Key (x-api-key)
      谁用	    前端用户	                     后端服务/第三方
      格式	    Bearer eyJ... 三段 base64	    sk-xxx 纯字符串
      校验	    验签 + 解码 JWT	                直接字符串比对
      典型场景	用户登录后调 API	                微服务间调用、Webhook
    */

    if (!apiKey || apiKey !== process.env['API_KEY']) {
      /* 
      本文示例（最简单）：环境变量，只适用于一个 Key、一个调用方的场景
      生产级：数据库 + 缓存
        DeepSeek 有成千上万用户，每个用户有不同的 Key，存数据库+Redis缓存
        必须存哈希后的值，不能存明文key
      */
      throw new ForbiddenException('API Key 无效或缺失');
    }

    return true;
  }
}

// 组合使用多个守卫
@UseGuards(
  IpWhitelistGuard, // 先检查 IP
  ContentTypeGuard, // 再检查Body格式
  ApiKeyGuard, // 再检查 API Key
  JwtAuthGuard, // 最后验证 JWT
)
class MultiGuardController {}

// 全局注册守卫（适用于需要所有路由统一保护）
// APP_GUARD 是 NestJS 的多提供者令牌（multi-provider token），写多行就会全部注册，按声明顺序执行
@Global()
@Module({
  providers: [
    { provide: APP_GUARD, useClass: JwtAuthGuard }, // ① 先验证 Token
    { provide: APP_GUARD, useClass: RolesGuard }, // ② 再检查角色
    { provide: APP_GUARD, useClass: IpWhitelistGuard }, // ③ 也可以加 IP 白名单
  ],
})
class GlobalGuardModule {}

// ============================================================
// 示例 6：异步 Guard（数据库查询权限）
// ============================================================

/**
 * 【场景】需要查询数据库才能判断权限（如检查资源所有权）
 * 【语法点】canActivate 返回 Promise<boolean>，NestJS 自动等待
 * 【NestJS 设计意图】守卫支持异步操作，权限检查可能需要数据库查询
 */

@Injectable()
class OwnershipGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  public async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const user: AttachedUser = request.user;
    /* 作用：从 request 上读取上一个 Guard（JwtAuthGuard）贴上去的用户信息 user
    目的：OwnershipGuard 需要知道"当前请求是谁发的"，才能判断这个人是不是资源的所有者。
      但 OwnershipGuard 自己不做认证，它假设前面的 JwtAuthGuard 已经验证并挂好了 request.user
    不同Guard负责不同内容，职责分离！
    */

    // 管理员可以跳过所有权检查
    if (user.role === 'ADMIN') {
      return true;
    }

    // 从路径参数中获取资源 ID
    const paramId = request.params['id'];
    /* 作用：从 URL 路径参数中取出资源 ID，比如 DELETE /posts/42 中的 42
    目的：OwnershipGuard 需要知道"要操作哪个资源"，才能查这个资源属于谁，判断当前用户有没有权利操作它
    为什么用 params['id'] 而不是 params.id？
      和 headers['authorization'] 一样——TypeScript 类型问题。Express 的 params 类型是 ParamsDictionary，key 是动态的，. 语法行不通：
     */

    const resourceId: string = typeof paramId === 'string' ? paramId : Array.isArray(paramId) ? (paramId[0] ?? '') : '';
    /* 作用：把 request.params['id'] 从混乱类型 string | string[] | undefined 强制收窄为干净的 string
    实际上正常路由几乎不会出数组。这个 Array.isArray 检查纯粹是 TypeScript 类型防守
    */
    if (!resourceId) {
      /* resourceId 必然是 string，所以 !resourceId 只会匹配空字符串 '' */
      throw new ForbiddenException('缺少资源 ID');
    }

    // 查询资源的所有者（模拟异步数据库查询）
    const resource = await this.findResourceById(parseInt(resourceId, 10));
    /* 用 URL 路径里的资源 ID 去查数据库，找出这个资源属于谁 */
    if (!resource) {
      throw new ForbiddenException('资源不存在或无权访问');
    }

    // 判断当前用户是否是资源的所有者
    return resource.ownerId === user.id;
  }

  private async findResourceById(id: number): Promise<{ ownerId: number } | null> {
    // 模拟数据库查询
    return new Promise<{ ownerId: number } | null>((resolve) => {
      /* 类型要么是null，要么是一个对象字面量，这个对象字面量必须有一个属性 ownerId，且该属性是number类型的 */
      setTimeout(() => {
        resolve({ ownerId: 1 });
      }, 100);
    });
  }
}
/* 
异步 Guard 没啥特别，因为 NestJS 把复杂度全吞了。真正的"特别"其实不在这几行代码里——在于框架内部。
这正是 NestJS 设计成功的地方——把异步支持做得太自然了，自然到你感觉不到它的存在。就像你呼吸空气一样，不需要意识到空气的存在。
*/

// ============================================================
// ❌ 常见错误 1：忘记在 Controller 上应用 @UseGuards()
// ============================================================

/**
 * 【错误现象】Guard 定义好了但不生效，未登录用户也能访问
 * 【错误原因】创建了 Guard 类但忘记用 @UseGuards() 装饰控制器或方法
 * 【正确写法】@UseGuards() 可以用于类级别或方法级别
 */

// ❌ 错误写法：
// class UsersController {
//   @Get()  // 忘记 @UseGuards(JwtAuthGuard)
//   findAll() { return []; }
// }

// ✅ 正确写法（类级别）：
// @UseGuards(JwtAuthGuard)  // 保护所有方法
// class UsersController { ... }

// ✅ 正确写法（方法级别）：
// class UsersController {
//   @Get()
//   @UseGuards(JwtAuthGuard)  // 只保护这个方法
//   findAll() { return []; }
// }

// ============================================================
// ❌ 常见错误 2：Guard 内抛出异常未正确处理
// ============================================================

/**
 * 【错误现象】Guard 返回 false 只收到默认 403，没有自定义错误信息
 * 【错误原因】返回 false 时 NestJS 只触发默认的 ForbiddenException
 * 【正确写法】需要自定义错误信息时，在 Guard 中抛出特定的 HttpException
 */

// ❌ 错误写法（只返回 false，无法提供友好信息）：
// class SilentGuard implements CanActivate {
//   canActivate() {
//     return false;  // 客户端只收到 { statusCode: 403, message: 'Forbidden' }
//   }
// }

// ✅ 正确写法（抛出异常，提供详细信息）：
// import { UnauthorizedException, ForbiddenException } from '@nestjs/common';
// class VerboseGuard implements CanActivate {
//   canActivate(context: ExecutionContext) {
//     const request = context.switchToHttp().getRequest();
//     if (!request.headers.authorization) {
//       throw new UnauthorizedException('请先登录');  // 401
//     }
//     if (!hasPermission) {
//       throw new ForbiddenException('您没有权限执行此操作');  // 403
//     }
//     return true;
//   }
// }

// ============================================================
// ❌ 常见错误 3：元数据 Key 拼写不一致
// ============================================================

/**
 * 【错误现象】@Roles() 设置了角色但 RolesGuard 读取不到
 * 【错误原因】SetMetadata('role', ...) vs Reflector.get('roles', ...) Key 不一致
 * 【正确写法】使用常量或 Symbol 定义元数据 Key，避免魔法字符串
 */

// ❌ 错误写法：
// // 装饰器中
// SetMetadata('role', ['admin']);   // 单数
// // Guard 中
// reflector.get('roles', handler);   // 复数 → 读不到！

// ✅ 正确写法：
// const ROLES_KEY = Symbol('roles');  // 使用 Symbol 保证唯一性
// SetMetadata(ROLES_KEY, ['admin']);
// reflector.get(ROLES_KEY, handler);

console.log('=== 第 09 章示例代码结束 ===');

// ============================================================
// 本章小结
// ============================================================
/*
 * 【核心要点】
 *   - 守卫实现 CanActivate，返回 true/false 决定请求是否继续
 *   - ExecutionContext > ArgumentsHost：可获取 Class、Handler 和 Reflector
 *   - @SetMetadata() + Reflector 是 RBAC 的实现基础
 *   - JwtAuthGuard 验证 Token 并附加 user 到 request
 *   - RolesGuard 读取 @Roles() 元数据并与用户角色对比
 *   - 守卫支持异步（返回 Promise<boolean>）用于数据库权限查询
 *
 * 【与前后章的关联】
 *   - 第 08 章：Guard 功能上可以替代鉴权中间件，且更强大（有 ExecutionContext + Reflector 元数据能力）
 *   - 第 10 章：Interceptor 不能做"拒绝访问"（返回 false），这是 Guard 的专属能力
 *   - 第 13 章：passport-jwt 实际工作方式就是本章 JwtAuthGuard 的完整实现
 *
 * 【常见面试题】
 *   Q: 守卫和中间件有什么区别？
 *   A: 1. 守卫在中间件之后执行
 *      2. 守卫能访问 DI 容器（注入 Service）和 Reflector（读取元数据）
 *      3. 守卫返回 true/false 控制是否放行，中间件通过 next() 控制
 *      4. 守卫知道调用的是哪个 Controller 和 Handler，中间件只知道 URL
 *
 *   Q: 如何实现基于角色的访问控制（RBAC）？
 *   A: 1. 定义 @Roles('admin') 装饰器（用 SetMetadata 存储角色）
 *      2. 实现 RolesGuard（用 Reflector 读取角色）
 *      3. 与 JwtAuthGuard 组合使用：先验证 Token，再检查角色
 */
// ============================================================
// 🎯 通关检查清单
// ============================================================
/*
 * [ ] 能手写一个简单的 CanActivate 守卫
 * [ ] 能实现 @Roles() + RolesGuard 的 RBAC 权限控制
 * [ ] 能解释 ExecutionContext 比 ArgumentsHost 多出的能力
 * [ ] 能说出 Guard 和 Middleware 的 3 个关键区别
 * [ ] 能指出 1 个常见错误及修复方法
 */
