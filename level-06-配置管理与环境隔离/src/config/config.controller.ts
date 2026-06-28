import { Controller, Get } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";

/**
 * WHAT: ConfigController——演示如何在 Controller 中使用配置
 *
 * WHY: ConfigService 是一个普通的 NestJS Provider，可以像其他 Service 一样注入
 */
@Controller("config")
export class ConfigController {
  constructor(private readonly config: ConfigService) {}

  /**
   * GET /config —— 查看当前应用配置（仅开发环境可用！
   *
   * WARNING: 生产环境绝对不要暴露配置！
   */
  @Get()
  getConfig() {
    return {
      // 使用命名空间读取结构化配置（类型安全）
      database: this.config.get("database"),
      jwt: this.config.get("jwt"),
      redis: this.config.get("redis"),

      // 读取单个配置项
      nodeEnv: this.config.get("nodeEnv"),
      port: this.config.get("port"),
    };
  }
}
