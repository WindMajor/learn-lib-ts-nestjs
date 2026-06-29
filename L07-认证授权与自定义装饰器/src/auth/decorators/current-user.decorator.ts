import { createParamDecorator, ExecutionContext } from "@nestjs/common";

/**
 * WHAT: @CurrentUser() 自定义参数装饰器——直接从 request 中提取用户信息
 *
 * 【核心原理——createParamDecorator 的工作原理】
 *   1. 装饰器在 Controller 方法参数上使用：getProfile(@CurrentUser() user: UserPayload)
 *   2. NestJS 在请求处理管线中调用这个工厂函数
 *   3. 工厂函数接收两个参数：
 *      - data: 装饰器的参数（如 @CurrentUser('userId') 中的 'userId'）
 *      - ctx: ExecutionContext——获取当前请求上下文
 *   4. 返回的值赋给 Controller 参数
 *
 *   这个装饰器等价于手动写：
 *   @Get('profile')
 *   getProfile(@Req() req: Request) {
 *     const user = req.user;
 *     return this.userService.findById(user.userId);
 *   }
 *   但 @CurrentUser() 更语义化——一眼就知道这个参数是"当前登录用户"
 *
 * 【对比 FastAPI】
 *   FastAPI 的依赖注入：
 *   def get_current_user(token: str = Depends(oauth2_scheme)):
 *       return decode_token(token)
 *
 *   @app.get("/profile")
 *   def profile(user = Depends(get_current_user)):
 *       return user
 *
 *   NestJS 的 @CurrentUser() + JwtAuthGuard 实现了同样的效果——
 *   但 NestJS 用装饰器而非函数参数
 *
 * 【对比 Go Gin】
 *   Go 通常从 context 读取：
 *   user, _ := c.Get("user")
 *   没有装饰器语法糖——Go 不支持这类元编程
 *
 * 【对比 Spring】
 *   @AuthenticationPrincipal UserDetails user —— Spring Security 的原生支持
 *   效果完全一致——从 SecurityContext 提取当前用户
 */
export const CurrentUser = createParamDecorator(
  (data: string | undefined, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest();
    const user = request.user;

    // 如果指定了字段名（如 @CurrentUser('userId')），只返回该字段
    return data ? user?.[data] : user;
  },
);
