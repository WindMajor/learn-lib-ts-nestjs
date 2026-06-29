/**
 * ================================================================
 * BUG #02: @Roles() 装饰了但忘记加 RolesGuard → RBAC 被绕过
 * ================================================================
 *
 * 【错误类型】授权绕过——Guard 缺失
 *
 * 【场景】
 *   开发者添加了 @Roles('admin') 但只绑定了 JwtAuthGuard：
 *
 *   @UseGuards(JwtAuthGuard)         // ← 有认证
 *   @Roles('admin')                  // ← 设了角色要求
 *   @Get("admin")
 *   adminEndpoint() { ... }          // ← 但 RolesGuard 没绑定！
 *
 * 【为什么危险？】
 *   1. @Roles() 只是设置了元数据，没有任何 Guard 读取它
 *   2. 任何已认证用户（包括 user 角色）都能访问 admin 端点
 *   3. 不会报错——元数据静静地躺在那里，不被使用
 *
 * 【修复方案】
 *   @UseGuards(JwtAuthGuard, RolesGuard)  // ← 添加 RolesGuard
 *   @Roles('admin')
 *   @Get("admin")
 *   adminEndpoint() { ... }
 *
 *   Guard 按声明顺序执行——JwtAuthGuard 先执行（设置 request.user），
 *   然后 RolesGuard 读取 request.user.role 做权限判断。
 *
 * 【对比 Spring Security】
 *   Spring 的 @PreAuthorize 自带 AOP 拦截——不需要单独绑定 Guard。
 *   这是 NestJS 灵活性的代价：你需要显式绑定所有 Guard。
 */
console.log("BUG: @Roles() 元数据设置了但 RolesGuard 未绑定——RBAC 被绕过！");
