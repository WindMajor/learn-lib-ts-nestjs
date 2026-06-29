/**
 * ============================================================
 * 第 14 章：CORS、RESTful 设计与前后端联调
 * ============================================================
 *
 * 【学习目标】
 *   1. 掌握 CORS 配置：origin、credentials、methods
 *   2. 掌握 RESTful API 设计规范：资源命名、HTTP 方法语义、状态码
 *   3. 掌握 API 版本控制策略
 *   4. 理解前后端联调的完整链路
 *   5. 了解 Swagger/OpenAPI 自动文档生成
 *
 * 【与 Express/FastAPI/Spring/Django 的对比提示】
 *   - Express：cors 中间件
 *   - FastAPI：CORSMiddleware
 *   - Spring：@CrossOrigin 注解 + CorsConfiguration
 *   - Django：django-cors-headers
 *
 * 【与 Vue3 前端的协作关系】
 *   - CORS 配置 = 前端 devServer.proxy 的服务器端对应
 *   - RESTful 规范 = 前端 API 调用时的 URL 和 HTTP 方法约定
 *   - 版本控制 = 前端 API 调用前缀（/api/v1/xxx）
 *   - Swagger = 前端自动生成 TypeScript 类型和 API 调用函数
 */

// ============================================================
// 示例 1：CORS 配置详解
// ============================================================

/**
 * 【场景】前端运行在 http://localhost:5173，后端在 http://localhost:3000
 *         浏览器同源策略阻止跨域请求，需要后端配置 CORS
 * 【语法点】app.enableCors({ ... }) 或使用 @nestjs/platform-express 的 cors
 * 【NestJS 设计意图】CORS 是安全性配置，应在应用入口统一设置
 */

interface CorsConfig {
  /** 允许的前端源（开发环境写具体地址，生产环境写域名） */
  origin:
    | string
    | string[]
    | boolean
    | ((
        origin: string,
        callback: (err: Error | null, allow?: boolean) => void,
      ) => void);
  /** 是否允许携带 Cookie（需要时设为 true） */
  credentials: boolean;
  /** 允许的 HTTP 方法 */
  methods: string[];
  /** 允许的请求头 */
  allowedHeaders: string[];
  /** 预检请求的缓存时间（秒） */
  maxAge: number;
  /** 暴露给前端的响应头 */
  exposedHeaders: string[];
}

// 开发环境 CORS 配置
const devCorsConfig: CorsConfig = {
  origin: ['http://localhost:5173', 'http://localhost:3000'], // Vue3 和 NestJS 自身
  credentials: true, // 允许携带 Cookie
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Request-Id'],
  maxAge: 86400, // 预检请求缓存 24 小时
  exposedHeaders: ['X-Request-Id', 'X-Total-Count'],
};

// 生产环境 CORS 配置（更严格）
const prodCorsConfig: CorsConfig = {
  origin: (
    origin: string,
    callback: (err: Error | null, allow?: boolean) => void,
  ) => {
    const allowedOrigins: string[] = [
      'https://example.com',
      'https://admin.example.com',
    ];
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error(`Origin ${origin} 不允许跨域访问`));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  maxAge: 86400,
  exposedHeaders: [],
};

// 在 main.ts 中使用：
// const isProduction = process.env.NODE_ENV === 'production';
// app.enableCors(isProduction ? prodCorsConfig : devCorsConfig);

// ============================================================
// 示例 2：RESTful API 设计规范
// ============================================================

/**
 * 【场景】设计一个符合 RESTful 规范的 API
 * 【设计原则】
 *   1. 资源用名词复数：/users、/posts、/comments
 *   2. HTTP 方法表达动作：GET（查询）、POST（创建）、PUT（全量更新）、PATCH（增量更新）、DELETE（删除）
 *   3. 层级关系用路径嵌套：/users/:userId/posts
 *   4. 状态码语义化：200（成功）、201（已创建）、204（成功无内容）、400（参数错误）、404（不存在）
 */

// NestJS 中 RESTful 路由示例
class RestfulApiDesign {
  // 用户资源
  public static readonly userRoutes = {
    list: 'GET    /users             —— 获取用户列表（支持分页、筛选、排序）',
    create: 'POST   /users             —— 创建用户',
    detail: 'GET    /users/:id         —— 获取用户详情',
    update: 'PATCH  /users/:id         —— 部分更新用户',
    replace: 'PUT    /users/:id         —— 全量替换用户',
    delete: 'DELETE /users/:id         —— 删除用户',
    posts: 'GET    /users/:id/posts   —— 获取用户的文章列表',
  };

  // 文章资源
  public static readonly postRoutes = {
    list: 'GET    /posts              —— 获取文章列表',
    create: 'POST   /posts              —— 创建文章',
    detail: 'GET    /posts/:id          —— 获取文章详情',
    update: 'PATCH  /posts/:id          —— 更新文章',
    delete: 'DELETE /posts/:id          —— 删除文章',
    publish: 'POST   /posts/:id/publish  —— 发布文章（自定义动作）',
    comments: 'GET    /posts/:id/comments —— 获取文章评论',
  };

  // 搜索（非资源类端点）
  public static readonly otherRoutes = {
    search: 'GET    /search?q=keyword&type=posts  —— 全局搜索',
    health: 'GET    /health                        —— 健康检查',
    metrics: 'GET    /metrics                       —— 监控指标',
  };
}

// HTTP 状态码正确使用指南
const httpStatusGuide = {
  // 2xx 成功
  '200': 'OK —— GET/PUT/PATCH 成功',
  '201': 'Created —— POST 创建成功（返回新资源位置）',
  '204': 'No Content —— DELETE 成功，无响应体',

  // 3xx 重定向
  '301': 'Moved Permanently —— 资源永久移动',
  '304': 'Not Modified —— 缓存未过期',

  // 4xx 客户端错误
  '400': 'Bad Request —— 参数验证失败',
  '401': 'Unauthorized —— 未认证',
  '403': 'Forbidden —— 已认证但无权限',
  '404': 'Not Found —— 资源不存在',
  '409': 'Conflict —— 资源冲突',
  '429': 'Too Many Requests —— 请求频率超限',

  // 5xx 服务端错误
  '500': 'Internal Server Error —— 未预期的服务器错误',
  '503': 'Service Unavailable —— 服务暂时不可用（维护/过载）',
};

// ============================================================
// 示例 3：API 版本控制
// ============================================================

/**
 * 【场景】API 需要版本迭代，同时保持向后兼容
 * 【策略】三种版本控制方式：
 *   1. URI 版本：/api/v1/users（最常用，直观）
 *   2. Header 版本：Accept: application/vnd.api+json;version=1
 *   3. Query 参数版本：/users?version=1
 * 【NestJS 设计意图】app.enableVersioning() 支持多种版本控制策略
 */

import {
  VersioningType,
  Controller,
  Get,
  VERSION_NEUTRAL,
} from '@nestjs/common';

// main.ts 中全局启用 URI 版本控制
const versioningConfig = {
  type: VersioningType.URI, // 通过 URI 控制版本
  defaultVersion: '1', // 默认版本（未指定时使用）
  prefix: 'api/v', // 版本前缀（可选）
};

// Controller 级别的版本控制
@Controller({ path: 'users', version: '1' })
class UsersV1Controller {
  @Get()
  public findAll(): string {
    return 'v1 用户列表';
  }
}

@Controller({ path: 'users', version: '2' })
class UsersV2Controller {
  @Get()
  public findAll(): string {
    return 'v2 用户列表（包含更多字段）';
  }
}

// 版本中立的路由（不随版本变化）
@Controller({ path: 'health', version: VERSION_NEUTRAL })
class HealthController {
  @Get()
  public check(): object {
    return { status: 'ok' };
  }
}

// 方法级别的版本
class MethodVersionController {
  @Get()
  public v1Method(): string {
    return 'v1';
  }

  @Get()
  public v2Method(): string {
    return 'v2';
  }
}

// ============================================================
// 示例 4：分页参数设计规范
// ============================================================

/**
 * 【场景】列表接口的分页参数标准
 * 【设计原则】统一分页参数命名，方便前端自动处理分页
 */

interface PaginationQuery {
  /** 页码（从 1 开始） */
  page: number;
  /** 每页数量 */
  limit: number;
  /** 排序字段 */
  sortBy?: string;
  /** 排序方向 */
  sortOrder?: 'asc' | 'desc';
  /** 搜索关键词 */
  search?: string;
}

// 标准分页响应
interface PaginatedResponse_14<T> {
  items: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasNext: boolean;
    hasPrevious: boolean;
  };
}

// 分页查询的默认值约定
const PAGINATION_DEFAULTS = {
  page: 1,
  limit: 20,
  maxLimit: 100, // 最大每页数量，防止恶意大请求
  sortOrder: 'desc' as const,
};

// 前端 URL 示例：
// GET /api/v1/posts?page=2&limit=20&sortBy=createdAt&sortOrder=desc&search=nestjs

// ============================================================
// 示例 5：前后端联调完整链路
// ============================================================

/**
 * 【场景】开发环境和生产环境的前后端通信配置
 * 【设计说明】开发时前端通过 Vite proxy 代理到后端，
 *            生产时通过 Nginx 反向代理统一部署
 */

// 开发环境（Vue3 vite.config.ts）
const viteDevConfig = {
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:3000', // 代理到 NestJS 开发服务器
        changeOrigin: true,
        // 路径重写：如果后端没有 /api 前缀，可以去掉
        // rewrite: (path) => path.replace(/^\/api/, ''),
      },
      '/uploads': {
        target: 'http://localhost:3000', // 静态文件也通过代理
        changeOrigin: true,
      },
    },
  },
};

// 生产环境 Nginx 配置（注释形式）
const nginxConfig = `
# /etc/nginx/sites-available/api.example.com
server {
    listen 80;
    server_name api.example.com;

    # 代理到 NestJS
    location /api/ {
        proxy_pass http://localhost:3000/api/;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # 静态文件直接由 Nginx 提供
    location /uploads/ {
        alias /app/uploads/;
        expires 30d;
        add_header Cache-Control "public, immutable";
    }

    # 前端 SPA
    location / {
        proxy_pass http://localhost:5173;
        proxy_set_header Host $host;
    }
}
`;

// ============================================================
// 示例 6：Swagger/OpenAPI 自动文档生成
// ============================================================

/**
 * 【场景】自动生成 API 文档，前后端共享接口定义
 * 【语法点】@nestjs/swagger 的 ApiTags、ApiOperation、ApiResponse 装饰器
 * 【NestJS 设计意图】代码即文档，前端可以从 Swagger JSON 生成 TypeScript 类型和 API 调用代码
 */

// @ApiTags('users')          // 标记 API 分组
// @ApiOperation({ summary: '获取用户列表' })  // 接口说明
// @ApiQuery({ name: 'page', required: false }) // 查询参数
// @ApiResponse({ status: 200, description: '成功', type: UserVo })  // 响应类型
class SwaggerDemoController {
  // @Get()
  // @ApiOperation({ summary: '获取用户列表' })
  // @ApiQuery({ name: 'page', type: Number, required: false })
  // @ApiResponse({ status: 200, type: [UserVo] })
  public findAll(): unknown[] {
    return [];
  }
}

// 与前端协作工作流：
// 1. 后端写好 Swagger 装饰器
// 2. 前端运行 openapi-generator 或 orval 从 Swagger JSON 生成代码
//    npx @openapitools/openapi-generator-cli generate -i http://localhost:3000/api/docs-json -g typescript-axios -o src/api
// 3. 前端直接使用生成的 API 函数，类型 100% 准确

// ============================================================
// ❌ 常见错误 1：CORS 配置了但 Cookie 传递失败
// ============================================================

/**
 * 【错误现象】CORS 配置没问题，但 Cookie 无法携带给后端
 * 【错误原因】缺少 credentials: true（前后端都要配）
 *            - 后端：app.enableCors({ credentials: true })
 *            - 前端：axios.defaults.withCredentials = true
 *            两者缺一不可
 * 【正确写法】同时配置前后端
 */

// ❌ 错误配置：
// 后端设置了 CORS origin，但 credentials: false
// 前端没有设置 withCredentials: true

// ✅ 正确配置：
// 后端 main.ts：
// app.enableCors({ origin: 'http://localhost:5173', credentials: true });
// 前端 Axios：
// axios.defaults.withCredentials = true;

// ============================================================
// ❌ 常见错误 2：API 路径版本混乱
// ============================================================

/**
 * 【错误现象】同一资源有多个版本，路由互相冲突
 * 【错误原因】没有统一的版本控制策略，有的用 /v1/，有的用 ?version=1
 * 【正确写法】选定一种版本策略后全局统一使用
 */

// ❌ 错误：
// @Controller('users')           // 无版本
// @Controller('v2/users')        // URI 版本
// @Controller({ path: 'users', version: '1' })  // NestJS 版本系统
// → 三种方式混用！

// ✅ 正确：统一使用 app.enableVersioning({ type: VersioningType.URI })

// ============================================================
// ❌ 常见错误 3：前端代理配置与后端路由不匹配
// ============================================================

/**
 * 【错误现象】前端请求 /api/users 但在浏览器中看到 /users 请求
 * 【错误原因】Vite proxy 的 rewrite 规则与后端路由前缀不一致
 * 【正确写法】对齐前端代理路径和后端路由前缀
 */

// 场景 1：后端路由带 /api 前缀
// → Vite proxy: '/api' → 'http://localhost:3000'（不 rewrite）
// → 请求 /api/users → 代理到 http://localhost:3000/api/users ✅

// 场景 2：后端路由不带 /api 前缀
// → Vite proxy: '/api' → 'http://localhost:3000' (rewrite: /^\/api// → '')
// → 请求 /api/users → 代理到 http://localhost:3000/users ✅

console.log('=== 第 14 章示例代码结束 ===');

// ============================================================
// 本章小结
// ============================================================
/*
 * 【核心要点】
 *   - CORS 配置：origin + credentials + methods，前后端都要配置
 *   - RESTful：资源用名词复数，HTTP 方法表达动作，状态码语义化
 *   - 版本控制：URI 版本（/api/v1/）最常用
 *   - 分页参数标准化：page, limit, sortBy, sortOrder
 *   - 开发代理（Vite proxy）vs 生产反向代理（Nginx）
 *   - Swagger/OpenAPI 前后端共享接口定义
 *
 * 【与前后章的关联】
 *   - 第 01 章：main.ts 中的 CORS 配置
 *   - 第 10 章：拦截器的响应包装与本章的统一响应格式搭配
 *   - 第 07 章：异常过滤器的错误格式与 HTTP 状态码规范对应
 *
 * 【常见面试题】
 *   Q: 什么是预检请求（Preflight Request）？
 *   A: 浏览器在发送跨域请求前，先发送 OPTIONS 请求询问服务器是否允许。
 *      简单请求（GET/POST + 标准 Content-Type）不会触发预检；
 *      复杂请求（自定义 Header、PUT/DELETE 等）会触发。
 *      通过 maxAge 配置预检缓存时间减少 OPTIONS 请求。
 */
// ============================================================
// 🎯 通关检查清单
// ============================================================
/*
 * [ ] 能正确配置 CORS（origin + credentials）
 * [ ] 能设计符合 RESTful 规范的 API 端点
 * [ ] 能配置 API 版本控制（URI 方式）
 * [ ] 能说出 1 个与 Express CORS 中间件的配置差异
 * [ ] 能指出 1 个常见错误及修复方法
 */
