/**
 * ============================================================
 * 第 13 章：JWT 认证与授权
 * ============================================================
 *
 * 【学习目标】
 *   1. 掌握 JWT 认证的完整流程：登录 → 签发 Token → 携带访问
 *   2. 掌握 @nestjs/jwt 的 JwtService 签发与验证
 *   3. 掌握 @nestjs/passport + passport-jwt 策略
 *   4. 掌握密码安全：bcryptjs 哈希
 *   5. 理解 Refresh Token 机制
 *
 * 【与 Express/FastAPI/Spring/Django 的对比提示】
 *   - Express：passport.js + jsonwebtoken 手动组合
 *   - FastAPI：python-jose + OAuth2PasswordBearer
 *   - Spring：Spring Security + jjwt / nimbus-jose-jwt
 *   - Django：djangorestframework-simplejwt + permission_classes
 *
 * 【与 Vue3 前端的协作关系】
 *   - 前端登录后存储 Token（localStorage/httpOnly Cookie）
 *   - Axios 请求拦截器自动附加 Authorization: Bearer <token>
 *   - 前端检测 401 → Token 过期 → 跳转登录页或刷新 Token
 *   - 前端路由守卫检查是否有 Token 决定是否展示登录页
 */

import { Injectable, UnauthorizedException, Module } from '@nestjs/common';

// ============================================================
// 示例 1：bcryptjs 密码哈希（安全基础）
// ============================================================

/**
 * 【场景】注册时哈希密码，登录时验证密码
 * 【语法点】bcrypt.hash(plainText, saltRounds) 和 bcrypt.compare(plainText, hash)
 * 【安全原则】绝不存储明文密码！bcrypt 自动加盐，对抗彩虹表攻击
 *            使用异步 version，不要用同步方法（阻塞事件循环）
 */

const bcrypt_13 = {
  hash: async (password: string, saltRounds: number): Promise<string> => {
    console.log(`[bcrypt] 哈希密码（${saltRounds} 轮加密）`);
    // 实际：return bcrypt.hash(password, saltRounds);
    return `$2b$${saltRounds}$hashed_${password}`; // 模拟哈希值
  },
  compare: async (plainText: string, hash: string): Promise<boolean> => {
    console.log('[bcrypt] 比对密码');
    // 实际：return bcrypt.compare(plainText, hash);
    return hash.endsWith(`hashed_${plainText}`);
  },
};

@Injectable()
class PasswordService {
  private readonly SALT_ROUNDS: number = 12; // 12 轮加密，平衡安全与性能

  /**
   * 哈希密码（注册时使用）
   */
  public async hashPassword(plainPassword: string): Promise<string> {
    return bcrypt_13.hash(plainPassword, this.SALT_ROUNDS);
  }

  /**
   * 验证密码（登录时使用）
   * 使用恒定时间比较防止时序攻击
   */
  public async verifyPassword(
    plainPassword: string,
    hashedPassword: string,
  ): Promise<boolean> {
    return bcrypt_13.compare(plainPassword, hashedPassword);
  }
}

// ============================================================
// 示例 2：JWT 签发与验证
// ============================================================

/**
 * 【场景】使用 @nestjs/jwt 的 JwtService 签发和验证 Token
 * 【语法点】jwtService.signAsync(payload, options) 签发
 *          jwtService.verifyAsync(token) 验证
 * 【NestJS 设计意图】JwtService 封装了 jsonwebtoken 库，提供 Promise API
 */

interface JwtPayload_13 {
  sub: number; // subject —— 用户 ID（JWT 标准字段）
  email: string;
  role: 'USER' | 'EDITOR' | 'ADMIN';
}

interface TokenPair {
  accessToken: string;
  refreshToken: string;
}

// 模拟 JwtService
@Injectable()
class MockJwtService_13 {
  private readonly secret: string;
  private readonly expiresIn: string;

  constructor() {
    this.secret = process.env['JWT_SECRET'] ?? 'default-secret';
    this.expiresIn = process.env['JWT_EXPIRATION'] ?? '15m';
  }

  public async signAsync(
    payload: JwtPayload_13,
    options?: { expiresIn?: string; secret?: string },
  ): Promise<string> {
    console.log(`[JWT] 签发 Token: sub=${payload.sub}, role=${payload.role}`);
    // 实际使用：return this.jwtService.signAsync(payload, options);
    // Token 结构：header.payload.signature
    const header: string = Buffer.from(
      JSON.stringify({ alg: 'HS256', typ: 'JWT' }),
    ).toString('base64url');
    const payloadStr: string = Buffer.from(
      JSON.stringify({
        ...payload,
        iat: Math.floor(Date.now() / 1000),
        exp: Math.floor(Date.now() / 1000) + 900, // 15 分钟
      }),
    ).toString('base64url');
    const signature: string = 'mock_signature';
    return `${header}.${payloadStr}.${signature}`;
  }

  public async verifyAsync(token: string): Promise<JwtPayload_13> {
    console.log('[JWT] 验证 Token');
    // 实际使用：return this.jwtService.verifyAsync(token);
    const parts: string[] = token.split('.');
    if (parts.length !== 3) {
      throw new Error('Token 格式无效');
    }
    const payload: JwtPayload_13 = JSON.parse(
      Buffer.from(parts[1] ?? '', 'base64url').toString(),
    );
    return payload;
  }
}

// ============================================================
// 示例 3：AuthService —— 登录与注册
// ============================================================

/**
 * 【场景】完整的认证业务逻辑
 * 【语法点】注册 → 哈希密码 → 存储；登录 → 验证密码 → 签发 Token
 * 【NestJS 设计意图】AuthService 是纯业务逻辑，不处理 HTTP 细节
 */

// 模拟用户数据库
const mockUserDb: Map<
  number,
  { id: number; email: string; password: string; name: string; role: string }
> = new Map();

@Injectable()
class AuthService_13 {
  constructor(
    private readonly jwtService: MockJwtService_13,
    private readonly passwordService: PasswordService,
  ) {}

  /**
   * 注册新用户
   */
  public async register(
    email: string,
    password: string,
    name: string,
  ): Promise<TokenPair> {
    // 1. 检查邮箱是否已注册
    for (const user of mockUserDb.values()) {
      if (user.email === email) {
        throw new UnauthorizedException('邮箱已被注册');
      }
    }

    // 2. 哈希密码
    const hashedPassword: string =
      await this.passwordService.hashPassword(password);

    // 3. 创建用户
    const id: number = mockUserDb.size + 1;
    mockUserDb.set(id, {
      id,
      email,
      password: hashedPassword,
      name,
      role: 'USER',
    });

    // 4. 签发 Token
    return this.generateTokens(id, email, 'USER');
  }

  /**
   * 登录
   */
  public async login(email: string, password: string): Promise<TokenPair> {
    // 1. 查找用户
    let user:
      | { id: number; email: string; password: string; role: string }
      | undefined;
    for (const u of mockUserDb.values()) {
      if (u.email === email) {
        user = u;
        break;
      }
    }

    if (!user) {
      throw new UnauthorizedException('邮箱或密码错误');
    }

    // 2. 验证密码
    const isPasswordValid: boolean = await this.passwordService.verifyPassword(
      password,
      user.password,
    );
    if (!isPasswordValid) {
      throw new UnauthorizedException('邮箱或密码错误');
    }

    // 3. 签发 Token
    return this.generateTokens(
      user.id,
      user.email,
      user.role as 'USER' | 'EDITOR' | 'ADMIN',
    );
  }

  /**
   * 刷新 Token
   */
  public async refreshToken(refreshToken: string): Promise<TokenPair> {
    try {
      const payload: JwtPayload_13 =
        await this.jwtService.verifyAsync(refreshToken);
      return this.generateTokens(payload.sub, payload.email, payload.role);
    } catch {
      throw new UnauthorizedException('Refresh Token 无效或已过期');
    }
  }

  /**
   * 生成 Token 对
   */
  private async generateTokens(
    userId: number,
    email: string,
    role: 'USER' | 'EDITOR' | 'ADMIN',
  ): Promise<TokenPair> {
    const payload: JwtPayload_13 = { sub: userId, email, role };

    const [accessToken, refreshToken] = await Promise.all([
      this.jwtService.signAsync(payload, { expiresIn: '15m' }),
      this.jwtService.signAsync(payload, { expiresIn: '7d' }),
    ]);

    return { accessToken, refreshToken };
  }
}

// ============================================================
// 示例 4：JWT Passport 策略
// ============================================================

/**
 * 【场景】使用 passport-jwt 策略自动从请求头提取并验证 Token
 * 【语法点】继承 PassportStrategy(Strategy)，实现 validate() 方法
 * 【NestJS 设计意图】Passport 是认证中间件标准，NestJS 封装了它方便使用
 */

// 模拟 PassportStrategy
class PassportStrategy {
  constructor(
    private readonly options: { jwtFromRequest: unknown; secretOrKey: string },
  ) {
    console.log(
      `[Passport] 初始化 JWT 策略，密钥: ${options.secretOrKey.substring(0, 10)}...`,
    );
  }
}

// JWT 策略
@Injectable()
class JwtStrategy extends PassportStrategy {
  constructor() {
    super({
      jwtFromRequest: 'ExtractJwt.fromAuthHeaderAsBearerToken()', // 从 Authorization: Bearer <token> 提取
      secretOrKey: process.env['JWT_SECRET'] ?? 'default-secret',
    });
  }

  /**
   * Passport 在验证 Token 成功后调用此方法
   * 返回值会被注入到 request.user 中
   */
  public async validate(payload: JwtPayload_13): Promise<JwtPayload_13> {
    // 可以在这里做额外的验证（如用户是否被禁用）
    console.log(
      `[JwtStrategy] 验证用户: sub=${payload.sub}, email=${payload.email}`,
    );
    return payload;
  }
}

// ============================================================
// 示例 5：Auth Module 完整组装
// ============================================================

/**
 * 【场景】AuthModule 的完整定义
 * 【语法点】imports [JwtModule.register()]、providers [AuthService, JwtStrategy]
 * 【NestJS 设计意图】模块封装认证相关的所有组件，明确的职责边界
 */

// 模拟 JwtModule
const JwtModule_13 = {
  register: (options: {
    secret: string;
    signOptions: { expiresIn: string };
  }) => ({
    module: class JwtRootModule {},
    global: true,
    providers: [
      {
        provide: MockJwtService_13,
        useFactory: () => new MockJwtService_13(),
      },
      {
        provide: 'JWT_OPTIONS',
        useValue: options,
      },
    ],
    exports: [MockJwtService_13],
  }),
};

@Module({
  imports: [
    JwtModule_13.register({
      secret: process.env['JWT_SECRET'] ?? 'default-secret',
      signOptions: { expiresIn: '15m' },
    }),
  ],
  providers: [AuthService_13, PasswordService, JwtStrategy],
  exports: [AuthService_13, MockJwtService_13],
})
class AuthModule_13 {}

// ============================================================
// 示例 6：Auth Controller
// ============================================================

/**
 * 【场景】认证相关的 HTTP 端点
 * 【语法点】@Controller('auth') 统一前缀
 */

// ---- 模拟 @nestjs/common 装饰器 ----
import { Controller, Post, Body, UseGuards } from '@nestjs/common';

// 登录 DTO
class LoginDto {
  public email: string = '';
  public password: string = '';
}

// 注册 DTO
class RegisterDto {
  public email: string = '';
  public password: string = '';
  public name: string = '';
}

// 刷新 Token DTO
class RefreshTokenDto {
  public refreshToken: string = '';
}

@Controller('auth')
class AuthController_13 {
  constructor(private readonly authService: AuthService_13) {}

  /**
   * 注册
   * POST /auth/register
   */
  @Post('register')
  public async register(@Body() dto: RegisterDto): Promise<TokenPair> {
    return this.authService.register(dto.email, dto.password, dto.name);
  }

  /**
   * 登录
   * POST /auth/login
   *
   * 前端调用示例：
   *   const { accessToken, refreshToken } = await axios.post('/auth/login', { email, password });
   *   localStorage.setItem('access_token', accessToken);
   */
  @Post('login')
  public async login(@Body() dto: LoginDto): Promise<TokenPair> {
    return this.authService.login(dto.email, dto.password);
  }

  /**
   * 刷新 Token
   * POST /auth/refresh
   *
   * 前端 Token 过期处理：
   *   axios.interceptors.response.use(
   *     null,
   *     async (error) => {
   *       if (error.response?.status === 401) {
   *         const refreshToken = localStorage.getItem('refresh_token');
   *         const { accessToken } = await axios.post('/auth/refresh', { refreshToken });
   *         localStorage.setItem('access_token', accessToken);
   *         error.config.headers.Authorization = `Bearer ${accessToken}`;
   *         return axios(error.config);  // 重试原始请求
   *       }
   *       return Promise.reject(error);
   *     }
   *   );
   */
  @Post('refresh')
  public async refreshToken(@Body() dto: RefreshTokenDto): Promise<TokenPair> {
    return this.authService.refreshToken(dto.refreshToken);
  }
}

// ============================================================
// 示例 7：与前端协作 —— Vue3 前端认证流程
// ============================================================

/**
 * 【场景】Vue3 前端完整的登录认证流程（注释形式）
 *
 * 1. 登录页调用 API：
 *    const res = await authApi.login({ email, password });
 *    localStorage.setItem('access_token', res.accessToken);
 *    localStorage.setItem('refresh_token', res.refreshToken);
 *    router.push('/dashboard');
 *
 * 2. Axios 拦截器自动附加 Token：
 *    axios.interceptors.request.use(config => {
 *      const token = localStorage.getItem('access_token');
 *      if (token) {
 *        config.headers.Authorization = `Bearer ${token}`;
 *      }
 *      return config;
 *    });
 *
 * 3. 路由守卫检查是否登录：
 *    router.beforeEach((to, from, next) => {
 *      const token = localStorage.getItem('access_token');
 *      if (to.meta.requiresAuth && !token) {
 *        next('/login');
 *      } else {
 *        next();
 *      }
 *    });
 *
 * 4. 前端路由守卫 vs 后端 Guard 的分工：
 *    - 前端路由守卫：UI 层面的保护（防止看到不该看的页面）
 *    - 后端 Guard：数据层面的保护（防止获取不该获取的数据）
 *    - 两者同时存在，前端提高用户体验，后端保证安全
 */

// ============================================================
// ❌ 常见错误 1：JWT Secret 硬编码或提交到 Git
// ============================================================

/**
 * 【错误现象】Token 被轻松伪造，安全漏洞
 * 【错误原因】Secret 硬编码在代码中，或者 .env 文件被提交到 Git
 * 【正确写法】Secret 从环境变量读取，.env 必须在 .gitignore 中
 */

// ❌ 错误写法：
// const jwtSecret = 'mySuperSecretKey123';  // 硬编码！所有人能看到
// const jwtSecret = 'dev-secret';            // 太简单！容易被暴力破解

// ✅ 正确写法：
// const jwtSecret = process.env.JWT_SECRET;  // 从环境变量读取
// // .env 文件在 .gitignore 中，不提交到 Git
// // JWT_SECRET 至少 32 个字符，由随机密码生成器生成

// ============================================================
// ❌ 常见错误 2：未处理 Token 过期导致 401
// ============================================================

/**
 * 【错误现象】用户操作一半突然被登出
 * 【错误原因】Token 过期后没有刷新机制
 * 【正确写法】实现 Refresh Token 机制，Access Token 短期（15min），Refresh Token 长期（7d）
 */

// ❌ 错误写法（没有刷新机制）：
// 只签发一个长期 Token → Token 泄露后风险大 → 无效化困难

// ✅ 正确写法（双 Token 机制）：
// Access Token: 15 分钟（频繁传输，短生命周期降低泄露风险）
// Refresh Token: 7 天（稀传输，用于获取新的 Access Token）

// ============================================================
// ❌ 常见错误 3：bcrypt 同步方法阻塞事件循环
// ============================================================

/**
 * 【错误现象】高并发下登录/注册接口响应变慢
 * 【错误原因】bcrypt.hashSync() / bcrypt.compareSync() 是 CPU 密集型操作，
 *            同步执行会阻塞整个事件循环
 * 【正确写法】始终使用异步版本 bcrypt.hash() / bcrypt.compare()
 */

// ❌ 错误写法：
// const hash = bcrypt.hashSync(password, 10);     // 同步 = 阻塞
// const match = bcrypt.compareSync(pw, hash);      // 同步 = 阻塞

// ✅ 正确写法：
// const hash = await bcrypt.hash(password, 12);    // 异步
// const match = await bcrypt.compare(pw, hash);     // 异步

console.log('=== 第 13 章示例代码结束 ===');

// ============================================================
// 本章小结
// ============================================================
/*
 * 【核心要点】
 *   - 密码安全：bcrypt 异步哈希 + 恒定时间比较
 *   - JWT 结构：Header.Payload.Signature，Payload 不存敏感信息（base64 可解码）
 *   - JwtService 封装签发和验证，提供 Promise API
 *   - Passport JWT 策略自动从请求头提取 Token
 *   - 双 Token 模式：Access Token (15min) + Refresh Token (7d)
 *   - 前端存储 Token + Axios 拦截器 + 路由守卫 → 全链路认证
 *
 * 【与前后章的关联】
 *   - 第 09 章：JwtAuthGuard 实际使用本章的 JwtService 验证 Token
 *   - 第 07 章：认证失败抛 UnauthorizedException → 全局 ExceptionFilter 格式化
 *   - 第 20 章：综合实战完整演示 AuthModule 的集成
 *
 * 【常见面试题】
 *   Q: JWT Token 的缺点是什么？如何解决？
 *   A: 缺点：1）无法主动失效（签发后无法撤销）
 *            2）Payload 只是 base64 编码（不是加密），不能存敏感信息
 *            3）Token 大小较大（每次请求都要携带）
 *      解决方案：1）短有效期 + Refresh Token
 *               2）服务端维护黑名单（失效 Token 列表）
 *               3）HTTPS 传输，防御中间人攻击
 *
 *   Q: Cookie vs localStorage 存储 Token 哪个更安全？
 *   A: httpOnly Cookie：不可通过 JS 访问，防御 XSS 攻击，但需要防御 CSRF。
 *      localStorage：方便前端操作，但易受 XSS 攻击获取。
 *      推荐方案：httpOnly Cookie 存储 Refresh Token + localStorage 存储 Access Token，
 *      或全部使用 httpOnly Cookie 配合 SameSite=Strict。
 */
// ============================================================
// 🎯 通关检查清单
// ============================================================
/*
 * [ ] 能写出完整的注册/登录/刷新 Token 流程
 * [ ] 能使用 bcrypt 哈希密码（异步版本）
 * [ ] 能使用 JwtService 签发和验证 Token
 * [ ] 能解释 Access Token 和 Refresh Token 的区别
 * [ ] 能指出 1 个常见错误及修复方法
 */
