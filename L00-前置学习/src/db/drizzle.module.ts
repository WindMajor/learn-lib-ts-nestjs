// ============================================================
// DrizzleModule —— 全局注册 DrizzleService
// ============================================================

import { Global, Module } from '@nestjs/common';
import { DrizzleService } from './drizzle.service';

/**
 * DrizzleModule
 *
 * 将 DrizzleService 注册为全局 Provider，所有模块都可以注入使用。
 * 在 AppModule 中只需导入一次即可。
 *
 * 使用方式：
 *   @Module({
 *     imports: [DrizzleModule],
 *   })
 *   class AppModule {}
 */
@Global()
@Module({
  providers: [DrizzleService],
  exports: [DrizzleService],
})
export class DrizzleModule {}
