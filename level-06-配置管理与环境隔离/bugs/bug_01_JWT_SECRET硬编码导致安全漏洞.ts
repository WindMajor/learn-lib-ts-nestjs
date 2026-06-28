/**
 * ================================================================
 * BUG #01: JWT_SECRET 硬编码 → 安全漏洞
 * ================================================================
 *
 * 【错误类型】安全隐患——密钥泄露
 *
 * 【场景】开发者把 JWT_SECRET 写死在代码中：
 *   const jwtSecret = "my-super-secret-key-123456";
 *
 * 【为什么危险？】
 *   1. 代码提交到 Git → 密钥永远留在版本历史中
 *   2. 所有开发者都能看到密钥
 *   3. 如果代码泄露 → 攻击者可以伪造 JWT → 冒充任何用户
 *
 * 【修复方案】
 *   1. .env 文件：JWT_SECRET=xxx（.env 加入 .gitignore）
 *   2. ConfigService：从环境变量读取，不在代码中写死
 *   3. Joi 校验：Joi.string().required().min(32) → 确保密钥足够长
 *
 * 【对比 Go/Rust】
 *   Go/Rust 同样的安全原则：密钥从环境变量/密钥管理服务读取
 *   Rust 的优势：编译后的二进制文件无法提取字符串常量（Rust 编译优化）
 */

// ❌ 危险的硬编码
// export const JWT_SECRET = "my-super-secret-key-123456";

// ✅ 正确的从环境变量读取
// const jwtSecret = process.env.JWT_SECRET;
// if (!jwtSecret) throw new Error("JWT_SECRET 未设置");

console.log("BUG: JWT_SECRET 硬编码 → 永远不要这样做！");
