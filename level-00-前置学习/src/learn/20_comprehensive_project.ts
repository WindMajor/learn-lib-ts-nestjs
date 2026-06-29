/**
 * ============================================================
 * 第 20 章：综合实战 —— 用户-文章系统
 * ============================================================
 *
 * 【学习目标】
 *   1. 整合前 19 章知识点构建完整的用户-文章 API 系统
 *   2. 理解各模块的协作方式：Auth → Users → Posts → Drizzle
 *   3. 掌握从 Schema 到 API 的完整开发流程
 *   4. 理解部署方案：Dockerfile + docker-compose
 *   5. 理解前后端协作全链路
 *
 * 【系统架构】
 *   AppModule (根模块)
 *   ├── DrizzleModule (全局数据库连接)
 *   ├── ConfigModule (全局配置)
 *   ├── AuthModule (认证：登录、注册、JWT)
 *   │   ├── AuthController
 *   │   ├── AuthService
 *   │   ├── JwtStrategy (Passport)
 *   │   └── JwtAuthGuard / RolesGuard
 *   ├── UsersModule (用户 CRUD)
 *   │   ├── UsersController
 *   │   ├── UsersService
 *   │   └── DTOs
 *   └── PostsModule (文章 CRUD)
 *       ├── PostsController
 *       ├── PostsService
 *       └── DTOs
 *
 * 【与 Express/FastAPI/Spring/Django 的对比提示】
 *   - Express：大约需要 2x-3x 代码量来实现同样的模块化架构
 *   - FastAPI：项目结构类似，但 NestJS 的 DI 和模块系统更强
 *   - Spring Boot：架构模式几乎一致（Controller/Service/Repository）
 *   - Django：Django Admin 自带 CRUD 管理界面，NestJS 需要 Swagger 补充
 *
 * 【与 Vue3 前端的协作关系】
 *   - 本系统为前端提供完整的 RESTful API
 *   - 前端通过 Axios 调用 /api/v1/auth、/api/v1/users、/api/v1/posts
 *   - 前端路由守卫 + 后端 Guard = 双重安全保护
 *   - Swagger 文档可直接生成前端 TypeScript 类型和 API 函数
 */

import {
  Injectable,
  Controller,
  Get,
  Post,
  Put,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  Module,
  Global,
  OnModuleInit,
  OnModuleDestroy,
  HttpStatus,
  BadRequestException,
  NotFoundException,
  UnauthorizedException,
  ForbiddenException,
} from '@nestjs/common';

// ============================================================
// 第一部分：Drizzle Schema 回顾（src/db/schema.ts）
// ============================================================

/**
 * 见项目根目录 src/db/schema.ts：
 *
 * model User {
 *   id        Int       @id @default(autoincrement())
 *   email     String    @unique
 *   name      String?
 *   password  String
 *   avatar    String?
 *   role      Role      @default(USER)
 *   isActive  Boolean   @default(true)
 *   createdAt DateTime  @default(now())
 *   updatedAt DateTime  @updatedAt
 *   posts     Post[]
 *   @@map("users")
 * }
 *
 * model Post {
 *   id        Int       @id @default(autoincrement())
 *   title     String
 *   content   String?
 *   published Boolean   @default(false)
 *   viewCount Int       @default(0)
 *   authorId  Int
 *   author    User      @relation(fields: [authorId], references: [id])
 *   deletedAt DateTime?
 *   createdAt DateTime  @default(now())
 *   updatedAt DateTime  @updatedAt
 *   @@index([authorId])
 *   @@index([deletedAt])
 *   @@map("posts")
 * }
 *
 * enum Role { USER EDITOR ADMIN }
 */

// ============================================================
// 第二部分：DrizzleModule（第 12 章）
// ============================================================

/**
 * DrizzleService：封装 drizzle-orm + pg Pool，管理数据库连接生命周期
 * 对应后端面试常见问题："如何管理数据库连接？"
 */

// 模拟 Drizzle DB（实际项目使用 drizzle-orm）
class MockDrizzleDb_20 {
  public user = {
    findUnique: async (args: { where: { id?: number; email?: string } }) =>
      null as UserRecord | null,
    findMany: async (args: {
      where?: Record<string, unknown>;
      skip?: number;
      take?: number;
      orderBy?: Record<string, string>;
    }) => [] as Record<string, unknown>[],
    create: async (args: { data: Record<string, unknown> }) =>
      ({
        id: 1,
        ...args.data,
      }) as UserRecord,
    update: async (args: {
      where: { id: number };
      data: Record<string, unknown>;
    }) => ({ id: args.where.id, ...args.data }) as UserRecord,
    delete: async (args: { where: { id: number } }) =>
      ({ id: args.where.id }) as UserRecord,
    count: async (args: { where?: Record<string, unknown> }) => 0,
  };
  public post = {
    findUnique: async (args: {
      where: { id: number };
      include?: Record<string, boolean>;
    }) => null as Record<string, unknown> | null,
    findMany: async (args: {
      where?: Record<string, unknown>;
      skip?: number;
      take?: number;
      orderBy?: Record<string, string>;
      include?: Record<string, boolean>;
    }) => [] as Record<string, unknown>[],
    create: async (args: { data: Record<string, unknown> }) =>
      ({
        id: 1,
        ...args.data,
      }) as Record<string, unknown>,
    update: async (args: {
      where: { id: number };
      data: Record<string, unknown>;
    }) => ({ id: args.where.id, ...args.data }) as Record<string, unknown>,
    delete: async (args: { where: { id: number } }) =>
      ({ id: args.where.id }) as Record<string, unknown>,
    count: async (args: { where?: Record<string, unknown> }) => 0,
  };
  public $transaction = async <T>(
    fn: (tx: MockDrizzleDb_20) => Promise<T>,
  ): Promise<T> => fn(this);
  public $connect = async () => {
    console.log('[Drizzle] 已连接数据库');
  };
  public $disconnect = async () => {
    console.log('[Drizzle] 已断开数据库连接');
  };
}

@Injectable()
class DrizzleService_20
  extends MockDrizzleDb_20
  implements OnModuleInit, OnModuleDestroy
{
  public async onModuleInit(): Promise<void> {
    await this.$connect();
  }
  public async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
  }
}

@Global()
@Module({ providers: [DrizzleService_20], exports: [DrizzleService_20] })
class DrizzleModule_20 {}

// ============================================================
// 第三部分：DTO 定义（第 06 章）
// ============================================================

// 用户 DTO
class CreateUserDto {
  public email: string = '';
  public password: string = '';
  public name: string = '';
}

class UpdateUserDto {
  public name?: string;
  public email?: string;
  public avatar?: string;
}

class LoginDto {
  public email: string = '';
  public password: string = '';
}

class RefreshTokenDto {
  public refreshToken: string = '';
}

// 文章 DTO
class CreatePostDto {
  public title: string = '';
  public content: string = '';
  public published: boolean = false;
}

class UpdatePostDto {
  public title?: string;
  public content?: string;
  public published?: boolean;
}

// 分页查询 DTO
class PaginationQueryDto {
  public page: number = 1;
  public limit: number = 20;
  public search?: string;
  public sortBy: string = 'createdAt';
  public sortOrder: 'asc' | 'desc' = 'desc';
}

// ============================================================
// 第四部分：AuthModule（第 09、13 章）
// ============================================================

// 用户类型定义
interface UserRecord {
  id: number;
  email: string;
  name: string | null;
  password: string;
  role: 'USER' | 'EDITOR' | 'ADMIN';
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

interface JwtPayload_20 {
  sub: number;
  email: string;
  role: 'USER' | 'EDITOR' | 'ADMIN';
}

// ---- AuthService ----
@Injectable()
class AuthService_20 {
  constructor(private readonly drizzle: DrizzleService_20) {}

  /**
   * 用户注册
   * 流程：检查邮箱唯一性 → 哈希密码 → 创建用户 → 签发 Token
   */
  public async register(dto: CreateUserDto): Promise<{
    user: Partial<UserRecord>;
    tokens: { accessToken: string; refreshToken: string };
  }> {
    // 检查邮箱唯一性
    const existing: UserRecord | null = await this.drizzle.user.findUnique({
      where: { email: dto.email },
    });
    if (existing) {
      throw new BadRequestException({ code: 40901, message: '邮箱已被注册' });
    }

    // 哈希密码（实际使用 await bcrypt.hash(dto.password, 12)）
    const hashedPassword: string = `hashed_${dto.password}`;

    // 创建用户
    const user: UserRecord = await this.drizzle.user.create({
      data: {
        email: dto.email,
        password: hashedPassword,
        name: dto.name,
      },
    });

    // 签发 Token
    const tokens = this.generateTokens(user);

    // 返回用户（排除密码）
    const { password, ...userWithoutPassword } = user;
    return { user: userWithoutPassword, tokens };
  }

  /**
   * 用户登录
   */
  public async login(dto: LoginDto): Promise<{
    user: Partial<UserRecord>;
    tokens: { accessToken: string; refreshToken: string };
  }> {
    const user: UserRecord | null = await this.drizzle.user.findUnique({
      where: { email: dto.email },
    });

    if (!user || !user.isActive) {
      throw new UnauthorizedException({
        code: 40100,
        message: '邮箱或密码错误',
      });
    }

    // 验证密码（实际使用 await bcrypt.compare(dto.password, user.password)）
    if (user.password !== `hashed_${dto.password}`) {
      throw new UnauthorizedException({
        code: 40100,
        message: '邮箱或密码错误',
      });
    }

    const tokens = this.generateTokens(user);
    const { password, ...userWithoutPassword } = user;
    return { user: userWithoutPassword, tokens };
  }

  /**
   * 刷新 Token
   */
  public async refreshToken(
    dto: RefreshTokenDto,
  ): Promise<{ accessToken: string; refreshToken: string }> {
    try {
      // 实际使用 jwtService.verifyAsync(dto.refreshToken)
      const payload: JwtPayload_20 = JSON.parse(
        Buffer.from(
          dto.refreshToken.split('.')[1] ?? '',
          'base64url',
        ).toString(),
      );
      const user: UserRecord | null = await this.drizzle.user.findUnique({
        where: { id: payload.sub },
      });

      if (!user || !user.isActive) {
        throw new UnauthorizedException('用户不存在或已禁用');
      }

      return this.generateTokens(user);
    } catch {
      throw new UnauthorizedException({
        code: 40101,
        message: 'Refresh Token 无效或已过期',
      });
    }
  }

  /**
   * 验证 Token（供 Guard 使用）
   */
  public async validateToken(token: string): Promise<JwtPayload_20> {
    // 实际使用 jwtService.verifyAsync(token)
    const payload: JwtPayload_20 = {
      sub: 1,
      email: 'user@example.com',
      role: 'USER',
    };
    return payload;
  }

  private generateTokens(user: UserRecord): {
    accessToken: string;
    refreshToken: string;
  } {
    const payload: JwtPayload_20 = {
      sub: user.id,
      email: user.email,
      role: user.role,
    };
    // 实际使用 jwtService.signAsync(payload, { expiresIn: '15m' })
    const accessToken: string = `access.${Buffer.from(JSON.stringify(payload)).toString('base64url')}.sig`;
    const refreshToken: string = `refresh.${Buffer.from(JSON.stringify(payload)).toString('base64url')}.sig`;
    return { accessToken, refreshToken };
  }
}

// ---- AuthController ----
@Controller('auth')
class AuthController_20 {
  constructor(private readonly authService: AuthService_20) {}

  @Post('register')
  public async register(
    @Body() dto: CreateUserDto,
  ): Promise<{ code: number; data: Record<string, unknown>; message: string }> {
    const result = await this.authService.register(dto);
    return { code: 201, data: result, message: '注册成功' };
  }

  @Post('login')
  public async login(
    @Body() dto: LoginDto,
  ): Promise<{ code: number; data: Record<string, unknown>; message: string }> {
    const result = await this.authService.login(dto);
    return { code: 200, data: result, message: '登录成功' };
  }

  @Post('refresh')
  public async refreshToken(
    @Body() dto: RefreshTokenDto,
  ): Promise<{ code: number; data: Record<string, unknown>; message: string }> {
    const tokens = await this.authService.refreshToken(dto);
    return { code: 200, data: tokens, message: 'Token 刷新成功' };
  }
}

// ---- JwtAuthGuard（第 09 章） ----
// 模拟 ExecutionContext 类型（实际从 @nestjs/common 导入）
type ExecContext = {
  switchToHttp: () => { getRequest: () => Record<string, unknown> };
};
@Injectable()
class JwtAuthGuard_20 {
  public canActivate(): boolean {
    // 实际实现：提取 Token → 验证 → 附加 user 到 request
    return true;
  }
}

// ---- RolesGuard（第 09 章） ----
@Injectable()
class RolesGuard_20 {
  public canActivate(): boolean {
    return true;
  }
}

// ---- AuthModule ----
@Module({
  imports: [],
  controllers: [AuthController_20],
  providers: [AuthService_20, JwtAuthGuard_20, RolesGuard_20],
  exports: [AuthService_20, JwtAuthGuard_20, RolesGuard_20],
})
class AuthModule_20 {}

// ============================================================
// 第五部分：UsersModule（第 05 章）
// ============================================================

/**
 * UsersService：纯业务逻辑，不操作 HTTP
 */
@Injectable()
class UsersService_20 {
  constructor(private readonly drizzle: DrizzleService_20) {}

  /**
   * 获取用户列表（分页 + 搜索 + 排序）
   */
  public async findAll(
    query: PaginationQueryDto,
  ): Promise<{ items: UserRecord[]; total: number }> {
    const { page, limit, search, sortBy, sortOrder } = query;
    const skip: number = (page - 1) * limit;

    const where: Record<string, unknown> = {};
    if (search) {
      where['OR'] = [
        { name: { contains: search } },
        { email: { contains: search } },
      ];
    }

    const [items, total] = await Promise.all([
      this.drizzle.user.findMany({
        where,
        skip,
        take: limit,
        orderBy: { [sortBy]: sortOrder },
      }),
      this.drizzle.user.count({ where }),
    ]);

    return { items: items as unknown as UserRecord[], total };
  }

  public async findById(id: number): Promise<UserRecord> {
    const user: UserRecord | null = await this.drizzle.user.findUnique({
      where: { id },
    });
    if (!user)
      throw new NotFoundException({
        code: 40401,
        message: `用户 ${id} 不存在`,
      });
    return user;
  }

  public async update(id: number, dto: UpdateUserDto): Promise<UserRecord> {
    const user: UserRecord = await this.findById(id); // 确认存在
    return this.drizzle.user.update({
      where: { id },
      data: dto as Record<string, unknown>,
    });
  }

  public async delete(id: number): Promise<UserRecord> {
    await this.findById(id); // 确认存在
    return this.drizzle.user.delete({ where: { id } });
  }
}

// ---- UsersController ----
@Controller('users')
class UsersController_20 {
  constructor(private readonly usersService: UsersService_20) {}

  @Get()
  public async findAll(
    @Query() query: PaginationQueryDto,
  ): Promise<{ items: UserRecord[]; total: number }> {
    return this.usersService.findAll(query);
  }

  @Get(':id')
  public async findOne(@Param('id') id: string): Promise<UserRecord> {
    return this.usersService.findById(parseInt(id, 10));
  }

  @Patch(':id')
  public async update(
    @Param('id') id: string,
    @Body() dto: UpdateUserDto,
  ): Promise<UserRecord> {
    return this.usersService.update(parseInt(id, 10), dto);
  }

  @Delete(':id')
  public async remove(@Param('id') id: string): Promise<void> {
    await this.usersService.delete(parseInt(id, 10));
  }
}

// ---- UsersModule ----
@Module({
  imports: [],
  controllers: [UsersController_20],
  providers: [UsersService_20],
  exports: [UsersService_20],
})
class UsersModule_20 {}

// ============================================================
// 第六部分：PostsModule（第 05、12 章）
// ============================================================

/**
 * PostsService：处理文章 CRUD + 软删除
 */
@Injectable()
class PostsService_20 {
  constructor(private readonly drizzle: DrizzleService_20) {}

  public async findAll(
    query: PaginationQueryDto & { authorId?: number },
  ): Promise<{ items: Record<string, unknown>[]; total: number }> {
    const { page, limit, sortBy, sortOrder, authorId, search } = query;
    const where: Record<string, unknown> = { deletedAt: null };

    if (authorId) where['authorId'] = authorId;
    if (search) {
      where['OR'] = [
        { title: { contains: search } },
        { content: { contains: search } },
      ];
    }

    const [items, total] = await Promise.all([
      this.drizzle.post.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { [sortBy]: sortOrder },
        include: { author: true },
      }),
      this.drizzle.post.count({ where }),
    ]);

    return { items, total };
  }

  public async findById(id: number): Promise<Record<string, unknown>> {
    const post = await this.drizzle.post.findUnique({
      where: { id },
      include: { author: true },
    });
    if (!post)
      throw new NotFoundException({
        code: 40402,
        message: `文章 ${id} 不存在`,
      });
    return post;
  }

  public async create(
    authorId: number,
    dto: CreatePostDto,
  ): Promise<Record<string, unknown>> {
    return this.drizzle.post.create({
      data: { ...dto, authorId },
    });
  }

  public async update(
    id: number,
    dto: UpdatePostDto,
  ): Promise<Record<string, unknown>> {
    return this.drizzle.post.update({
      where: { id },
      data: dto as Record<string, unknown>,
    });
  }

  /**
   * 软删除（第 12 章）
   */
  public async softDelete(id: number): Promise<Record<string, unknown>> {
    return this.drizzle.post.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
  }
}

// ---- PostsController ----
@Controller('posts')
class PostsController_20 {
  constructor(private readonly postsService: PostsService_20) {}

  @Get()
  public async findAll(
    @Query() query: PaginationQueryDto,
  ): Promise<{ items: Record<string, unknown>[]; total: number }> {
    return this.postsService.findAll(query);
  }

  @Get(':id')
  public async findOne(
    @Param('id') id: string,
  ): Promise<Record<string, unknown>> {
    return this.postsService.findById(parseInt(id, 10));
  }

  @Post()
  @UseGuards(JwtAuthGuard_20) // 需要登录
  public async create(
    @Body() dto: CreatePostDto,
  ): Promise<Record<string, unknown>> {
    const userId: number = 1; // 实际从 @User('id') 获取
    return this.postsService.create(userId, dto);
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard_20)
  public async update(
    @Param('id') id: string,
    @Body() dto: UpdatePostDto,
  ): Promise<Record<string, unknown>> {
    return this.postsService.update(parseInt(id, 10), dto);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard_20)
  public async remove(@Param('id') id: string): Promise<void> {
    await this.postsService.softDelete(parseInt(id, 10));
  }
}

// ---- PostsModule ----
@Module({
  controllers: [PostsController_20],
  providers: [PostsService_20],
})
class PostsModule_20 {}

// ============================================================
// 第七部分：AppModule（全局配置组装）
// ============================================================

/**
 * 【架构设计原则】
 *   - DrizzleModule: @Global() 全局模块，所有 Service 直接注入 DrizzleService
 *   - ConfigModule: 全局配置管理
 *   - AuthModule: 认证逻辑独立封装
 *   - UsersModule / PostsModule: 业务功能模块
 */

@Module({
  imports: [
    DrizzleModule_20, // 全局数据库连接（@Global 标记）
    AuthModule_20, // 认证模块
    UsersModule_20, // 用户模块
    PostsModule_20, // 文章模块
  ],
  controllers: [],
  providers: [
    // 全局守卫（使用 APP_GUARD Token 注册）
    // { provide: APP_GUARD, useClass: JwtAuthGuard },
    // 全局拦截器
    // { provide: APP_INTERCEPTOR, useClass: TransformInterceptor },
    // 全局过滤器
    // { provide: APP_FILTER, useClass: AllExceptionsFilter },
    // 全局管道
    // { provide: APP_PIPE, useClass: ValidationPipe },
  ],
})
class AppModule_20 {}

// ============================================================
// 第八部分：main.ts（全局配置）
// ============================================================

/**
 * 【main.ts 全局配置清单】
 */
const mainTsConfig = {
  description: '生产级 NestJS 应用的 main.ts 配置',
  setup: [
    "1. import 'reflect-metadata';  // 第一行",
    '2. 创建应用：const app = await NestFactory.create(AppModule);',
    "3. 全局前缀：app.setGlobalPrefix('api/v1');",
    '4. CORS：app.enableCors({ origin, credentials: true });',
    '5. 全局管道：app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true, forbidNonWhitelisted: true }));',
    '6. 全局过滤器：app.useGlobalFilters(new AllExceptionsFilter());',
    '7. 全局拦截器：app.useGlobalInterceptors(new TransformInterceptor());',
    "8. Swagger：SwaggerModule.setup('api/docs', app, document);",
    '9. 监听端口：await app.listen(process.env.PORT ?? 3000);',
  ],
};

// ============================================================
// 第九部分：.env 配置清单
// ============================================================

const envConfig = {
  description: '所需环境变量',
  variables: {
    PORT: '3000',
    DATABASE_URL:
      'postgresql://nestjs_user:nestjs_pass@localhost:5432/nestjs_learn?schema=public',
    JWT_SECRET: 'your-super-secret-key-at-least-32-characters',
    JWT_EXPIRATION: '15m',
    JWT_REFRESH_EXPIRATION: '7d',
    CORS_ORIGIN: 'http://localhost:5173',
    NODE_ENV: 'development',
    UPLOAD_DIR: './uploads',
    MAX_FILE_SIZE: '10485760',
  },
};

// ============================================================
// 第十部分：与 Vue3 前端协作
// ============================================================

/**
 * 【Vue3 前端协作全链路】
 *
 * 1. 登录 API 调用与 Token 存储
 * 2. Axios 拦截器自动附加 Token
 * 3. 401 错误处理（刷新 Token 或跳转登录）
 * 4. 前端路由守卫 + 后端 Guard 的分工
 */

// 前端登录示例（注释）：
const vue3LoginExample = `
// stores/auth.ts
export const useAuthStore = defineStore('auth', () => {
  const user = ref<User | null>(null);
  const accessToken = ref(localStorage.getItem('access_token') || '');
  const refreshToken = ref(localStorage.getItem('refresh_token') || '');

  async function login(email: string, password: string) {
    const res = await axios.post('/api/v1/auth/login', { email, password });
    const { user: userData, tokens } = res.data;
    user.value = userData;
    accessToken.value = tokens.accessToken;
    refreshToken.value = tokens.refreshToken;
    localStorage.setItem('access_token', tokens.accessToken);
    localStorage.setItem('refresh_token', tokens.refreshToken);
  }

  function logout() {
    user.value = null;
    accessToken.value = '';
    refreshToken.value = '';
    localStorage.removeItem('access_token');
    localStorage.removeItem('refresh_token');
    router.push('/login');
  }

  return { user, accessToken, login, logout };
});

// utils/axios.ts
axios.interceptors.request.use((config) => {
  const token = localStorage.getItem('access_token');
  if (token) {
    config.headers.Authorization = \`Bearer \${token}\`;
  }
  return config;
});

axios.interceptors.response.use(
  (res) => res.data,
  async (error) => {
    if (error.response?.status === 401 && !error.config._retry) {
      error.config._retry = true;
      try {
        const refreshToken = localStorage.getItem('refresh_token');
        const res = await axios.post('/api/v1/auth/refresh', { refreshToken });
        localStorage.setItem('access_token', res.data.accessToken);
        error.config.headers.Authorization = \`Bearer \${res.data.accessToken}\`;
        return axios(error.config);
      } catch {
        const auth = useAuthStore();
        auth.logout();
      }
    }
    return Promise.reject(error.response?.data);
  }
);

// router/index.ts
router.beforeEach((to, from, next) => {
  const token = localStorage.getItem('access_token');
  if (to.meta.requiresAuth && !token) {
    next('/login');
  } else {
    next();
  }
});
`;

// ============================================================
// 第十一部分：部署 —— Dockerfile + docker-compose
// ============================================================

/**
 * 【Dockerfile 多阶段构建】（连接 Docker 学习项目）
 */
const dockerfileExample = `
# ===== Stage 1: 构建 =====
FROM node:22-alpine AS builder
WORKDIR /app
COPY package*.json pnpm-lock.yaml ./
RUN npm install -g pnpm && pnpm install --frozen-lockfile
COPY . .
RUN npx drizzle-kit generate
RUN pnpm run build

# ===== Stage 2: 运行 =====
FROM node:22-alpine AS runner
WORKDIR /app
RUN addgroup --system --gid 1001 nestjs && adduser --system --uid 1001 nestjs
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./
COPY --from=builder /app/drizzle ./drizzle
USER nestjs
EXPOSE 3000
CMD ["node", "dist/main"]
`;

/**
 * 【docker-compose.yml 完整服务】（连接 Docker 学习项目）
 * 见项目根目录 docker-compose.yml：
 *   - postgres:16-alpine (端口 5432)
 *   - redis:7-alpine (端口 6379，可选)
 *   - 如果部署 NestJS 应用，可添加 app 服务
 */

const fullDockerCompose = `
# 完整部署示例（在现有 docker-compose.yml 基础上添加）
services:
  postgres:
    image: postgres:16-alpine
    environment:
      POSTGRES_USER: nestjs_user
      POSTGRES_PASSWORD: nestjs_pass
      POSTGRES_DB: nestjs_learn
    ports:
      - "5432:5432"
    volumes:
      - pgdata:/var/lib/postgresql/data

  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"

  app:
    build:
      context: .
      dockerfile: Dockerfile
    ports:
      - "3000:3000"
    depends_on:
      postgres:
        condition: service_healthy
    environment:
      DATABASE_URL: postgresql://nestjs_user:nestjs_pass@postgres:5432/nestjs_learn?schema=public
      JWT_SECRET: \${JWT_SECRET}
    volumes:
      - ./uploads:/app/uploads

  nginx:
    image: nginx:alpine
    ports:
      - "80:80"
    volumes:
      - ./nginx.conf:/etc/nginx/conf.d/default.conf
    depends_on:
      - app

volumes:
  pgdata:
`;

// ============================================================
// ❌ 常见综合错误合辑
// ============================================================

/**
 * 【错误 1】全局管道未注册 APP_PIPE，导致 ValidationPipe 不生效
 *   → 在 AppModule 的 providers 中使用 APP_PIPE Token 注册
 *
 * 【错误 2】Module 中忘记 exports 某个 Service，导致其他模块无法注入
 *   → 检查 Module 的 exports 数组是否包含需要共享的 Provider
 *
 * 【错误 3】Guard 中注入的 Service 在 Guard 的 Module 中未导入
 *   → Guard 所在 Module 的 imports 中导入该 Service 所属的 Module
 *
 * 【错误 4】CORS 配置后前端仍然报跨域错误
 *   → 检查 origin 是否精确匹配（包括端口），检查 credentials 是否前后端同时开启
 *
 * 【错误 5】Swagger 文档正常但请求返回 404
 *   → 检查全局前缀是否与 Swagger 的 server 配置一致
 */

console.log('=== 第 20 章示例代码结束 ===');

// ============================================================
// 架构设计问答
// ============================================================
/*
 * Q: 为什么这样分层？
 * A: NestJS 采用三层架构：
 *    1. Controller 层：处理 HTTP 请求/响应
 *    2. Service 层：处理业务逻辑
 *    3. Data Access 层：处理数据库操作（DrizzleService）
 *    这种分层让每层的职责明确、可独立测试、易于替换。
 *
 * Q: 模块如何划分？
 * A: 按功能域划分（Auth/Users/Posts），而不是按技术层划分。
 *    每个模块包含自己的 Controller、Service、DTO、Guard。
 *    共享的基础设施（Drizzle、Config）注册为全局模块。
 *    模块之间通过 DI 容器通信，避免直接耦合。
 *
 * Q: DTO 放在哪？
 * A: 放在所属模块的 dto/ 目录下（如 users/dto/create-user.dto.ts）。
 *    避免创建全局的 types/ 目录，这违反了模块内聚原则。
 *    共享的 DTO（如分页查询）可以放在 common/dto/ 下。
 *
 * Q: 错误怎么处理？
 * A: 1. Service 层抛出语义化异常（NotFoundException、BadRequestException 等）
 *    2. 全局 ExceptionFilter 统一捕获并格式化为 { code, message, data } 格式
 *    3. 业务错误码（如 40401）与 HTTP 状态码（如 404）分开设计
 *    4. 前端 Axios 拦截器根据 code 做分支处理
 *
 * Q: 如何保证 API 的安全性？
 * A: 1. JWT 认证（JwtAuthGuard）— 验证用户身份
 *    2. RBAC 权限控制（RolesGuard）— 控制操作权限
 *    3. DTO 验证（ValidationPipe）— 过滤非法输入
 *    4. CORS + Helmet — 消除常见 Web 漏洞
 *    5. 不泄露堆栈信息 — ExceptionFilter 返回友好错误
 *
 * Q: 这个系统的性能瓶颈在哪？
 * A: 1. 数据库查询 — 需要索引优化、连接池配置
 *    2. JWT 验证 — 每次请求都验证 Token（高并发时考虑 Redis 缓存）
 *    3. 文件上传 — 磁盘 I/O 瓶颈，生产环境用云存储
 *    4. 单实例 — 高并发需要水平扩展 + 负载均衡
 *    5. 定时任务 — 多实例重复执行，需要分布式锁
 */

// ============================================================
// 本章小结
// ============================================================
/*
 * 【核心要点】
 *   本章整合了前 19 章的所有知识点，构建了一个完整的用户-文章系统：
 *   - DrizzleModule：全局数据库连接
 *   - AuthModule：JWT 认证（登录、注册、Token 刷新）
 *   - UsersModule：用户 CRUD
 *   - PostsModule：文章 CRUD + 软删除
 *   - AppModule：统一导入、全局管线配置
 *   - main.ts：全局前缀、CORS、管道、拦截器、过滤器
 *   - .env：所有配置项清单
 *   - Dockerfile + docker-compose：部署方案
 *
 * 【系统完整 API 列表】
 *   POST   /api/v1/auth/register   — 用户注册
 *   POST   /api/v1/auth/login      — 用户登录
 *   POST   /api/v1/auth/refresh    — 刷新 Token
 *   GET    /api/v1/users           — 用户列表
 *   GET    /api/v1/users/:id       — 用户详情
 *   PATCH  /api/v1/users/:id       — 更新用户
 *   DELETE /api/v1/users/:id       — 删除用户
 *   GET    /api/v1/posts           — 文章列表
 *   GET    /api/v1/posts/:id       — 文章详情
 *   POST   /api/v1/posts           — 创建文章 [需登录]
 *   PATCH  /api/v1/posts/:id       — 更新文章 [需登录]
 *   DELETE /api/v1/posts/:id       — 删除文章 [需登录]
 *
 * 【前后端协作全链路回顾】
 *   前端登录 → 后端签发 JWT → 前端存储 Token
 *   → 前端 Axios 拦截器附加 Token → 后端 JwtAuthGuard 验证
 *   → 后端 RolesGuard 检查权限 → 后端 Service 执行业务
 *   → 后端 Interceptor 包装响应 → 前端 Axios 拦截器解包
 *   → 前端展示数据
 *   异常链：后端 ExceptionFilter → 前端 Axios 错误拦截 → 前端 UI 提示
 *
 * 【下一步学习方向】
 *   1. @nestjs/bull 队列：异步任务处理（邮件、报表）
 *   2. @nestjs/microservices：微服务架构
 *   3. @nestjs/graphql：GraphQL API 替代方案
 *   4. Kubernetes：容器编排和自动扩缩容
 *   5. 监控体系：Prometheus + Grafana + Sentry
 *   6. CI/CD：GitHub Actions 自动化测试和部署
 */

// ============================================================
// 🎯 通关检查清单
// ============================================================
/*
 * [ ] 能画出系统的模块架构图
 * [ ] 能手写一个完整的 Module（Controller + Service + DTO）
 * [ ] 能理解登录注册的完整认证链路
 * [ ] 能说出软删除的实现方式和应用场景
 * [ ] 能写出 Dockerfile 和生产级 docker-compose
 * [ ] 能回答架构设计问答中的所有问题
 * [ ] 能设计完整的前后端协作方案
 */

console.log(`
╔══════════════════════════════════════════════════════════════╗
║                                                              ║
║   恭喜！你已完成 NestJS 系统化学习的全部 20 章内容！         ║
║                                                              ║
║   你现在应该能够：                                            ║
║   ✅ 理解 NestJS 的模块化架构和 DI 容器机制                   ║
║   ✅ 编写 Controller、Service、Guard、Interceptor、Filter     ║
║   ✅ 使用 Drizzle + PostgreSQL 进行数据库操作                 ║
║   ✅ 实现 JWT 认证和 RBAC 权限控制                            ║
║   ✅ 设计 RESTful API 并配置 CORS                             ║
║   ✅ 编写单元测试和 E2E 测试                                  ║
║   ✅ 部署 NestJS 应用到 Docker 容器                           ║
║   ✅ 与 Vue3 前端完整协作                                     ║
║                                                              ║
║   下一步：创建你自己的 NestJS 项目，实践这些知识！            ║
║                                                              ║
╚══════════════════════════════════════════════════════════════╝
`);
