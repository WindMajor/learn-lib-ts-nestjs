import { Module, Logger, OnModuleInit } from "@nestjs/common";
import { CatsModule } from "./cats/cats.module";

/**
 * WHAT: 根模块——导入 CatsModule
 * 【对比 Level 01】模块更纯净，只做组装不做业务
 */
@Module({
  imports: [CatsModule],
})
export class AppModule implements OnModuleInit {
  private readonly logger = new Logger(AppModule.name);

  onModuleInit() {
    this.logger.log("AppModule 初始化完成");
  }
}
