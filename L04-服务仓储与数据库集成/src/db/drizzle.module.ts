// WHAT: DrizzleModule——全局模块，使 DrizzleService 在整个应用中可用
//
// WHY: @Global() → 任何模块无需显式 import 即可注入 DrizzleService
//   适合数据库/配置/日志等基础设施模块
//
// WARNING: @Global() 不要滥用！只有基础设施模块适合全局。

import { Global, Module } from '@nestjs/common';
import { DrizzleService } from './drizzle.service';

@Global()
@Module({
  providers: [DrizzleService],
  exports: [DrizzleService],
})
export class DrizzleModule {}
