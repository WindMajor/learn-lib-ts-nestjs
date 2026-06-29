import { Controller, Get, Logger } from "@nestjs/common";
import { DatabaseInfoService } from "./database-info.service";

/**
 * WHAT: Database 信息控制器——查询数据库连接状态
 *
 * WHY: 这个 Controller 展示了 IoC 容器如何自动注入互不相关的 Service：
 *   DatabaseInfoService 依赖 DATABASE_CONNECTION（自定义 Token）
 *   → DatabaseInfoService 被注册在 DatabaseModule 的 providers 中
 *   → DatabaseInfoController 被注册在 DatabaseModule 的 controllers 中
 *   → IoC 容器自动创建 DatabaseInfoController 时发现需要 DatabaseInfoService
 *   → 在当前 Module 的 providers 中找到 → 创建 DatabaseInfoService
 *   → 发现需要 DATABASE_CONNECTION → 在 DatabaseModule 的 providers 中找到
 *   → 调用 useFactory → 注入 factory 的依赖 DB_CONFIG → 返回 connection
 *   → IoC 容器自动完成：DB_CONFIG → DATABASE_CONNECTION → DatabaseInfoService → DatabaseInfoController
 *
 * 【对比 Express】
 *   Express 需要手动完成这一切：
 *   1. const config = { host: '...', port: 5432 };
 *   2. const connection = createConnection(config);
 *   3. const dbService = new DatabaseInfoService(connection);
 *   4. app.get('/database/info', (req, res) => res.json(dbService.getStatus()));
 *   代码行数差不多，但 NestJS 的可测试性和可维护性好得多——
 *   你可以在测试中替换任意一层的实现。
 */
@Controller("database")
export class DatabaseInfoController {
  constructor(private readonly dbService: DatabaseInfoService) {}

  private readonly logger = new Logger(DatabaseInfoController.name);

  @Get("info")
  getInfo() {
    this.logger.log("处理 GET /database/info 请求");
    return this.dbService.getStatus();
  }
}
