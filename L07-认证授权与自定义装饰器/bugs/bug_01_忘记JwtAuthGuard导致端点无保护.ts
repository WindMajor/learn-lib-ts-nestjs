/**
 * ================================================================
 * BUG #01: 忘记 @UseGuards(JwtAuthGuard) → 端点无保护
 * ================================================================
 *
 * 【错误类型】安全漏洞——认证缺失
 *
 * 【场景】
 *   开发者写了需要认证的端点，但忘记添加 @UseGuards(JwtAuthGuard)：
 *
 *   @Get("profile")
 *   getProfile(@CurrentUser() user) {  // ← user 将是 undefined!
 *     return { data: user };
 *   }
 *
 * 【为什么危险？】
 *   1. 任何人都能访问这个端点——无需 Token
 *   2. @CurrentUser() 返回 undefined → 业务逻辑可能崩溃或泄露数据
 *   3. 不抛异常——是一个静默的安全漏洞
 *
 * 【修复方案】
 *   @UseGuards(JwtAuthGuard)  // ← 添加这一行
 *   @Get("profile")
 *   getProfile(@CurrentUser() user) { ... }
 *
 * 【对比 Spring Security】
 *   Spring Security 默认保护所有端点（需要 .permitAll() 放行）——
 *   这比 NestJS 的默认开放更安全。
 */
console.log("BUG: 忘记 @UseGuards → 端点无认证保护！");
