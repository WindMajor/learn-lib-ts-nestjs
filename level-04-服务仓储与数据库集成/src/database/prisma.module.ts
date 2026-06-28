import { Global, Module } from "@nestjs/common";
import { PrismaService } from "./prisma.service";

/**
 * WHAT: PrismaModule——全局模块，使 PrismaService 在整个应用中可用
 *
 * WHY: @Global() 装饰器标记为全局模块：
 *   - 任何模块无需 imports: [PrismaModule] 即可注入 PrismaService
 *   - 避免了在每个 Feature Module 中重复 import PrismaModule
 *
 * 【对比 TypeORM】
 *   TypeOrmModule.forRoot() 自动全局可用
 *   用 Prisma 需要手动创建全局模块——但逻辑一样
 *
 * WARNING: @Global() 不要滥用！
 *   只有 Database/Config/Logger 这种基础设施模块适合全局。
 *   业务模块应该是局部（需要显式 import）——保持模块边界清晰。
 */
@Global()
@Module({
  providers: [PrismaService],
  exports: [PrismaService],
})
export class PrismaModule {}
