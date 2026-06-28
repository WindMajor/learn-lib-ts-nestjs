/**
 * ================================================================
 * BUG #01: AOP 执行顺序误解——Interceptor 中修改 user 但 Guard 已执行完
 * ================================================================
 *
 * 【错误类型】逻辑错误——认证绕过
 *
 * 【场景】
 *   开发者误解了 AOP 执行顺序，以为 Interceptor 在 Guard 之前执行，
 *   在 Interceptor 中设置 request.user，然后在 Guard 中读取——
 *   但 Guard 其实已经开始执行了！
 *
 *   实际顺序：Guard → Interceptor
 *   如果 Guard 放在 Interceptor 之后 → Guard 中的 user 总是 undefined
 *
 * 【为什么会这样】
 *   NestJS 的请求管线有严格的执行顺序：
 *   Middleware → Guard → Interceptor → Pipe → Controller
 *
 *   如果你在 Interceptor 中修改 request 对象（如设置 user），
 *   然后期望 Guard 能读到它——对不起，Guard 已经执行完了！
 *
 *   【对比 Express】
 *     Express 的中间件按 app.use() 的顺序执行——你可以自由控制顺序。
 *     NestJS 的 AOP 各层有固定的顺序——你只能在各层内部调整顺序。
 *
 *   【对比 Spring】
 *     Spring Security Filter Chain 有固定的执行顺序，不可以随意调整。
 *     与 NestJS 的 AOP 顺序同理——认证必须先于授权。
 *
 * 【如何修复】
 *   方案 1: 在 Middleware 中设置 request.user（Middleware 在 Guard 之前）
 *   方案 2: 在 Guard 中完成所有认证逻辑——不要依赖其他 AOP 层
 *   方案 3: 用自定义装饰器从 JWT 解析用户（Level 07）
 */

// BUG: 错误的 AOP 层级依赖关系
// 假设的代码：
//
// @UseInterceptors(UserSetterInterceptor) // ← 期望在这里设置 user
// @UseGuards(AuthGuard)                   // ← 期望这里读到 user
// @Get('profile')
// getProfile() {}
//
// 结果：AuthGuard 执行时，UserSetterInterceptor 还没执行！
// → request.user === undefined → 认证失败
