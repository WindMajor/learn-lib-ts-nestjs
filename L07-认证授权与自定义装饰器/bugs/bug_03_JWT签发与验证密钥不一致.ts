/**
 * ================================================================
 * BUG #03: JWT 签发和验证使用不同密钥 → Token 验证失败
 * ================================================================
 *
 * 【错误类型】配置不一致——密钥不匹配
 *
 * 【场景】
 *   AuthModule 中签发 JWT 用的密钥：
 *     JwtModule.register({ secret: "secret-key-A" })
 *
 *   JwtStrategy 中验证 JWT 用的密钥：
 *     super({ secretOrKey: "secret-key-B" })
 *
 * 【现象】
 *   - 登录成功（Token 签发正常）
 *   - 携带 Token 访问受保护端点 → 401 "Unauthorized"
 *   - 错误信息：invalid signature
 *
 * 【为什么难以排查？】
 *   1. 登录成功 → 说明签发端没问题
 *   2. 端点返回 401 → 看起来像 Token 过期或格式错误
 *   3. JWT 的签名验证是二进制的——肉眼无法比对
 *   4. 错误信息 "invalid signature" 不够具体
 *
 * 【修复方案】
 *   使用统一的环境变量 JWT_SECRET（通过 ConfigService）：
 *
 *   // AuthModule
 *   JwtModule.registerAsync({
 *     useFactory: (config: ConfigService) => ({
 *       secret: config.get('jwt.secret'),
 *     }),
 *     inject: [ConfigService],
 *   })
 *
 *   // JwtStrategy
 *   constructor(config: ConfigService) {
 *     super({ secretOrKey: config.get('jwt.secret') });
 *   }
 *
 * 【对比 Go/Rust】
 *   相同的原则——签发和验证必须使用相同的密钥。
 *   Rust 的优势：const 编译期保证密钥不会被意外修改。
 */
console.log("BUG: JWT 签发和验证使用不同密钥 → 所有 Token 验证失败！");
