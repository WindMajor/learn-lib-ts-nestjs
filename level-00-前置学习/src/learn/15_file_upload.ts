/**
 * ============================================================
 * 第 15 章：文件上传与静态文件
 * ============================================================
 *
 * 【学习目标】
 *   1. 掌握 FileInterceptor 处理单文件上传
 *   2. 掌握 FilesInterceptor 处理多文件上传
 *   3. 掌握 Multer 配置：存储目录、文件大小限制、类型过滤
 *   4. 理解文件存储策略：本地磁盘 vs 云存储
 *   5. 掌握 ServeStaticModule 托管静态文件
 *
 * 【与 Express/FastAPI/Spring/Django 的对比提示】
 *   - Express：multer 中间件
 *   - FastAPI：UploadFile + File
 *   - Spring：MultipartFile + @RequestParam
 *   - Django：FileField / ImageField + request.FILES
 *
 * 【与 Vue3 前端的协作关系】
 *   - 前端 <input type="file"> + FormData + Axios 上传
 *   - Content-Type: multipart/form-data（由浏览器自动设置）
 *   - 后端返回文件 URL → 前端直接展示
 */

// 导入假模块避免编译错误
import {
  Controller,
  Post,
  Get,
  Param,
  UseInterceptors,
  UploadedFile,
  UploadedFiles,
  BadRequestException,
  Injectable,
  Module,
} from '@nestjs/common';

// ============================================================
// 示例 1：单文件上传 —— FileInterceptor
// ============================================================

/**
 * 【场景】用户上传头像（单文件）
 * 【语法点】FileInterceptor('fieldName') 提取名为 fieldName 的文件
 *          @UploadedFile() 获取上传的文件
 * 【NestJS 设计意图】FileInterceptor 底层使用 Multer，封装为 NestJS 拦截器
 *                   文件处理从请求中解耦，Controller 接收干净的文件对象
 */

// Multer 文件类型
interface MulterFile {
  fieldname: string; // 表单字段名
  originalname: string; // 原始文件名
  encoding: string; // 文件编码
  mimetype: string; // MIME 类型
  size: number; // 文件大小（字节）
  destination: string; // 存储目录
  filename: string; // 存储后的文件名
  path: string; // 完整路径
  buffer: Buffer; // 文件内容（内存存储模式）
}

@Controller('upload')
class SingleFileController {
  /**
   * 上传单个头像
   * POST /upload/avatar
   * 前端：FormData.append('avatar', file)
   */
  @Post('avatar')
  @UseInterceptors() // 实际：@UseInterceptors(FileInterceptor('avatar', multerOptions))
  public async uploadAvatar(
    @UploadedFile() file: MulterFile,
  ): Promise<{ url: string; filename: string }> {
    // 验证文件是否存在
    if (!file) {
      throw new BadRequestException('请选择要上传的文件');
    }

    // 验证文件类型
    const allowedMimeTypes: string[] = [
      'image/jpeg',
      'image/png',
      'image/gif',
      'image/webp',
    ];
    if (!allowedMimeTypes.includes(file.mimetype)) {
      throw new BadRequestException(
        `不支持的文件类型: ${file.mimetype}。允许: ${allowedMimeTypes.join(', ')}`,
      );
    }

    // 验证文件大小（例如 5MB）
    const maxSize: number = 5 * 1024 * 1024;
    if (file.size > maxSize) {
      throw new BadRequestException(`文件过大，最大允许 5MB`);
    }

    // 返回可访问的 URL
    const url: string = `/uploads/avatars/${file.filename}`;
    return { url, filename: file.originalname };
  }
}

// ============================================================
// 示例 2：多文件上传 —— FilesInterceptor
// ============================================================

/**
 * 【场景】文章上传多张配图
 * 【语法点】FilesInterceptor('images', maxCount) 限制最多多少个文件
 *          @UploadedFiles() 获取文件数组
 * 【NestJS 设计意图】多文件上传是单文件的自然扩展，API 保持一致
 */

@Controller('upload')
class MultipleFileController {
  /**
   * 上传多张文章配图（最多 5 张）
   */
  @Post('images')
  @UseInterceptors() // 实际：@UseInterceptors(FilesInterceptor('images', 5, multerOptions))
  public async uploadImages(
    @UploadedFiles() files: MulterFile[],
  ): Promise<{ urls: string[]; count: number }> {
    if (!files || files.length === 0) {
      throw new BadRequestException('请至少选择一张图片');
    }

    if (files.length > 5) {
      throw new BadRequestException('最多只能上传 5 张图片');
    }

    const urls: string[] = files.map(
      (file: MulterFile) => `/uploads/images/${file.filename}`,
    );

    return { urls, count: files.length };
  }
}

// ============================================================
// 示例 3：Multer 配置详解
// ============================================================

/**
 * 【场景】配置 Multer 的存储策略、文件名生成、文件过滤
 * 【语法点】diskStorage（磁盘存储）、memoryStorage（内存存储）
 * 【NestJS 设计意图】Multer 配置是可复用的，可以在多个 FileInterceptor 中共享
 */

import { diskStorage, memoryStorage } from 'multer';
import { extname, join } from 'path';

// 配置 1：磁盘存储 + 自定义文件名
const diskStorageConfig = {
  storage: diskStorage({
    // 存储目录
    destination: join(process.cwd(), 'uploads', 'avatars'),
    // 自定义文件名：时间戳 + 随机字符串 + 原始扩展名
    filename: (
      _req: unknown,
      file: MulterFile,
      callback: (error: Error | null, filename: string) => void,
    ) => {
      const uniqueSuffix: string = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
      const ext: string = extname(file.originalname);
      callback(null, `${file.fieldname}-${uniqueSuffix}${ext}`);
      // 生成的文件名示例：avatar-1623456789123-456789012.jpeg
    },
  }),
};

// 配置 2：内存存储（处理完毕后直接上传到云存储）
const memoryStorageConfig = {
  storage: memoryStorage(),
};

// 配置 3：文件过滤器（只允许图片）
const imageFilter = (
  _req: unknown,
  file: MulterFile,
  callback: (error: Error | null, acceptFile: boolean) => void,
) => {
  if (!file.originalname.match(/\.(jpg|jpeg|png|gif|webp)$/i)) {
    return callback(new BadRequestException('只允许上传图片文件'), false);
  }
  callback(null, true);
};

// 配置 4：文件大小限制
const fileLimits = {
  fileSize: 10 * 1024 * 1024, // 10MB
  files: 5, // 最多 5 个文件
};

// 完整配置
const multerOptions = {
  ...diskStorageConfig,
  fileFilter: imageFilter,
  limits: fileLimits,
};

// ============================================================
// 示例 4：文件存储策略 —— 本地 vs 云存储
// ============================================================

/**
 * 【场景】根据不同环境选择存储策略
 * 【设计决策】
 *   本地磁盘：
 *     - 优点：开发简单、延迟低、零成本
 *     - 缺点：无法水平扩展、单点故障、存储容量有限
 *   云存储（OSS/S3）：
 *     - 优点：弹性扩容、CDN 加速、高可用、生命周期管理
 *     - 缺点：增加成本、上传延迟、需要管理凭证
 * 【推荐】开发用本地，生产用云存储，通过接口抽象切换
 */

interface FileStorageProvider {
  upload(file: Buffer, filename: string, mimetype: string): Promise<string>;
  delete(url: string): Promise<void>;
  getSignedUrl(key: string, expiresIn: number): Promise<string>;
}

// 本地存储实现
@Injectable()
class LocalFileStorage implements FileStorageProvider {
  private readonly uploadDir: string = join(process.cwd(), 'uploads');

  public async upload(
    file: Buffer,
    filename: string,
    mimetype: string,
  ): Promise<string> {
    const fs = await import('fs/promises');
    const filepath: string = join(this.uploadDir, filename);
    await fs.writeFile(filepath, file);
    return `/uploads/${filename}`;
  }

  public async delete(url: string): Promise<void> {
    const fs = await import('fs/promises');
    const filepath: string = join(process.cwd(), url.replace(/^\//, ''));
    await fs.unlink(filepath).catch(() => {});
  }

  public async getSignedUrl(key: string, _expiresIn: number): Promise<string> {
    return `/uploads/${key}`;
  }
}

// 云存储实现（S3/OSS 接口，简化版）
@Injectable()
class S3FileStorage implements FileStorageProvider {
  public async upload(
    file: Buffer,
    filename: string,
    mimetype: string,
  ): Promise<string> {
    // 实际使用 @aws-sdk/client-s3 或 ali-oss
    console.log(
      `[S3] 上传文件: ${filename} (${mimetype}, ${file.length} bytes)`,
    );
    return `https://cdn.example.com/uploads/${filename}`;
  }

  public async delete(url: string): Promise<void> {
    console.log(`[S3] 删除文件: ${url}`);
  }

  public async getSignedUrl(key: string, expiresIn: number): Promise<string> {
    console.log(`[S3] 生成签名 URL: ${key} (${expiresIn}s)`);
    return `https://cdn.example.com/uploads/${key}?token=signed`;
  }
}

// 模块配置：根据环境切换实现
@Module({
  providers: [
    {
      provide: 'FILE_STORAGE',
      useClass:
        process.env['NODE_ENV'] === 'production'
          ? S3FileStorage
          : LocalFileStorage,
    },
  ],
  exports: ['FILE_STORAGE'],
})
class FileStorageModule {}

// ============================================================
// 示例 5：静态文件服务 —— ServeStaticModule
// ============================================================

/**
 * 【场景】托管上传的文件，让前端能直接通过 URL 访问
 * 【语法点】ServeStaticModule.forRoot({ rootPath, serveRoot })
 * 【NestJS 设计意图】静态文件是常见需求，ServeStaticModule 避免每个项目重复配置
 */

// ServeStaticModule 配置
const serveStaticConfig = {
  rootPath: join(process.cwd(), 'uploads'), // 文件系统路径
  serveRoot: '/uploads', // 对应的 URL 路径前缀
  exclude: ['/api/(.*)'], // 排除 API 路由
  serveStaticOptions: {
    index: false, // 不显示目录
    maxAge: '30d', // 浏览器缓存 30 天
    setHeaders: (
      res: { setHeader: (k: string, v: string) => void },
      _path: string,
    ) => {
      res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
    },
  },
};

// 在 AppModule 中导入：
// @Module({
//   imports: [ServeStaticModule.forRoot(serveStaticConfig)],
// })

// ============================================================
// 示例 6：与前端协作 —— Vue3 文件上传
// ============================================================

/**
 * 【场景】Vue3 前端文件上传的完整代码示例（注释形式）
 *
 * 1. 单文件上传：
 *    const uploadAvatar = async (file: File) => {
 *      const formData = new FormData();
 *      formData.append('avatar', file);
 *      const res = await axios.post('/api/upload/avatar', formData, {
 *        headers: { 'Content-Type': 'multipart/form-data' },
 *        onUploadProgress: (e) => {
 *          const percent = Math.round((e.loaded * 100) / e.total);
 *          console.log(`上传进度: ${percent}%`);
 *        },
 *      });
 *      return res.data.url;  // → '/uploads/avatars/xxx.jpeg'
 *    };
 *
 * 2. 前端展示上传的图片：
 *    <img :src="`http://localhost:3000${imageUrl}`" />
 *    或通过 Nginx 代理时：
 *    <img :src="imageUrl" />   // Nginx 会将 /uploads/ 代理到后端
 *
 * 3. 拖拽上传：
 *    const handleDrop = (e: DragEvent) => {
 *      const files = e.dataTransfer?.files;
 *      if (files) uploadImages(Array.from(files));
 *    };
 *
 * 4. 预览上传前的图片：
 *    const previewUrl = ref<string>('');
 *    const handleFileChange = (e: Event) => {
 *      const file = (e.target as HTMLInputElement).files?.[0];
 *      if (file) previewUrl.value = URL.createObjectURL(file);
 *    };
 */

// ============================================================
// ❌ 常见错误 1：未安装 @types/multer 导致类型缺失
// ============================================================

/**
 * 【错误现象】TS 报错：Cannot find module 'multer' 或 MulterFile 类型不存在
 * 【错误原因】multer 的类型定义是独立的 @types/multer 包
 * 【正确写法】npm install -D @types/multer
 */

// ❌ 错误：
// import { FileInterceptor } from '@nestjs/platform-express';
// → 运行时报错：Cannot find module 'multer'

// ✅ 正确：
// npm install multer @types/multer
// import { FileInterceptor } from '@nestjs/platform-express';  // 类型完整

// ============================================================
// ❌ 常见错误 2：文件过大未限制导致内存溢出
// ============================================================

/**
 * 【错误现象】上传大文件时服务器内存占用飙升甚至崩溃
 * 【错误原因】没有设置 fileSize 限制，或使用 memoryStorage 存储大文件
 * 【正确写法】设置 limits.fileSize 限制 + 大文件使用 diskStorage
 */

// ❌ 错误写法：
// const multerOptions = { storage: memoryStorage() };  // 大文件占满内存

// ✅ 正确写法：
const safeMulterOptions = {
  storage: diskStorage({ ...diskStorageConfig.storage }), // 存到磁盘
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB 上限
};

// ============================================================
// ❌ 常见错误 3：路径遍历攻击（文件名包含 ../）
// ============================================================

/**
 * 【错误现象】攻击者上传文件名为 ../../../etc/passwd 的文件，覆盖系统文件
 * 【错误原因】直接使用用户提供的文件名存储，没有做安全处理
 * 【正确写法】使用自定义文件名生成（时间戳+随机字符串），忽略用户原始文件名
 */

// ❌ 错误写法：
// diskStorage({
//   filename: (req, file, cb) => {
//     cb(null, file.originalname);  // 直接使用用户输入，危险！
//   },
// });

// ✅ 正确写法：
// diskStorage({
//   filename: (req, file, cb) => {
//     // 使用 UUID 或时间戳，完全忽略用户提供的文件名
//     const ext = extname(file.originalname);
//     cb(null, `${uuidv4()}${ext}`);
//   },
// });

console.log('=== 第 15 章示例代码结束 ===');

// ============================================================
// 本章小结
// ============================================================
/*
 * 【核心要点】
 *   - FileInterceptor 单文件，FilesInterceptor 多文件，AnyFilesInterceptor 任意文件
 *   - Multer 配置：storage 模式（disk vs memory）、文件过滤器、大小限制
 *   - 文件命名安全：不信任用户提供的文件名，使用 UUID/时间戳
 *   - 本地存储（开发）vs 云存储（生产）通过接口抽象切换
 *   - ServeStaticModule 托管上传目录供前端访问
 *
 * 【与前后章的关联】
 *   - 第 03 章：文件上传需要通过 Controller 和装饰器处理
 *   - 第 06 章：文件上传也应验证（文件类型、大小）
 *   - 第 12 章：文件元数据可以存储在数据库中
 *
 * 【常见面试题】
 *   Q: diskStorage 和 memoryStorage 什么时候用？
 *   A: diskStorage：文件直接存磁盘，适合大文件和本地存储；
 *      memoryStorage：文件存在内存 Buffer 中，适合：
 *      1）需要处理后直接上传到云存储（不经磁盘中转）
 *      2）小文件（如缩略图）
 *      3）一次性处理（如用 sharp 压缩后直接上传）
 */
// ============================================================
// 🎯 通关检查清单
// ============================================================
/*
 * [ ] 能写单文件和多文件上传的 Controller
 * [ ] 能配置 Multer 的存储、过滤和大小限制
 * [ ] 能通过接口抽象切换本地和云存储
 * [ ] 能说出 1 个路径遍历攻击的防护方法
 * [ ] 能指出 1 个常见错误及修复方法
 */
