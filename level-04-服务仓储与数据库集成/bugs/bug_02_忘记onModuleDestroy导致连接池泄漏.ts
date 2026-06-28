/**
 * ================================================================
 * BUG #02: 忘记实现 onModuleDestroy → 连接池泄漏
 * ================================================================
 *
 * 【错误类型】资源泄漏——应用重启多次后数据库拒绝连接
 *
 * 【真实表现】
 *   - 应用正常启动、正常响应
 *   - 按 Ctrl+C 关闭 → 进程立即退出
 *   - 多次启动/停止后 → 数据库报错 "too many clients"
 *   - 查看 pg_stat_activity → 大量 idle 连接未释放
 *
 * 【为什么会这样】
 *   PrismaClient 在 $connect() 时建立连接池（默认 10 个连接）。
 *   这些连接是 TCP 长连接——即使 Node.js 进程退出，
 *   数据库端的连接不会立即释放（需要等 TCP keepalive 超时或数据库端检测）。
 *
 *   如果 onModuleDestroy 中没有调用 $disconnect()：
 *   1. Node.js 进程退出
 *   2. PrismaClient 没有主动关闭连接
 *   3. PostgreSQL 认为连接仍然活跃（直到超时）
 *   4. 10 个连接被占用
 *   5. 下一次启动又建立 10 个连接
 *   6. 累积到 PostgreSQL 的 max_connections（默认 100）
 *   7. → "FATAL: sorry, too many clients already"
 *
 * 【对比 Spring Boot】
 *   Spring Boot 的 HikariCP 连接池自动管理生命周期。
 *   @PreDestroy 自动调用 HikariDataSource.close()
 *   开发者不需要手动处理——除非自定义连接池
 *
 * 【对比 Go + GORM】
 *   Go 通常用 defer sqlDB.Close()：
 *   db, _ := gorm.Open(...)
 *   sqlDB, _ := db.DB()
 *   defer sqlDB.Close()
 *   如果忘记 defer → 同样连接泄漏
 *
 * 【如何修复】
 *   在 PrismaService 中实现 OnModuleDestroy：
 *     async onModuleDestroy() {
 *       await this.$disconnect();
 *     }
 *
 *   并且确保 NestJS 的优雅关闭触发 onModuleDestroy：
 *     app.enableShutdownHooks(); // 在 main.ts 中
 */

// BUG: PrismaService 没有实现 OnModuleDestroy
/*
@Injectable()
class BuggyPrismaService extends PrismaClient implements OnModuleInit {
  async onModuleInit() {
    await this.$connect();  // 建立连接池
  }
  // BUG: 缺少 onModuleDestroy()！
}

// 修复后:
@Injectable()
class FixedPrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  async onModuleInit() { await this.$connect(); }

  async onModuleDestroy() {
    await this.$disconnect();  // ← 关键修复
  }
}
*/
