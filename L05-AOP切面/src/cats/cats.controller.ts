import {
  Controller, Get, SetMetadata, UseGuards, Logger,
  NotFoundException,
} from "@nestjs/common";
import { CatsService, Cat } from "./cats.service";
import { RoleGuard } from "../common/guards/auth.guard";

@Controller("cats")
export class CatsController {
  constructor(private readonly svc: CatsService) {}
  private readonly logger = new Logger(CatsController.name);

  /**
   * WHAT: GET /cats —— 公开端点，无需任何角色
   *
   * 【AOP 执行链路】
   *   LoggingInterceptor(前) → TransformInterceptor(前) → AuthGuard → Controller → Interceptor(后)
   *
   *   AuthGuard 检查 Authorization 头，有 token 就放行（模拟宽松认证）
   */
  @Get()
  findAll(): Cat[] {
    this.logger.log("🎯 Controller: findAll() 执行");
    return this.svc.findAll();
  }

  /**
   * WHAT: GET /cats/admin —— 需要 admin 角色
   *
   * @SetMetadata('roles', ['admin']) 设置元数据
   * @UseGuards(RoleGuard) 绑定 RoleGuard（在 AuthGuard 之后执行）
   *
   * 测试：
   *   curl http://localhost:3000/cats/admin -H "Authorization: Bearer test"
   *   → 403 (user 角色不是 admin)
   *
   *   curl "http://localhost:3000/cats/admin?role=admin" -H "Authorization: Bearer test"
   *   → 可以手动模拟 admin 角色（AuthGuard 从 query 参数读取模拟角色）
   */
  @Get("admin")
  @SetMetadata("roles", ["admin"])
  @UseGuards(RoleGuard)
  findAdminCats(): Cat[] {
    this.logger.log("🎯 Controller: findAdminCats() 执行 — 角色验证通过");
    return this.svc.findByRole("admin");
  }

  /**
   * WHAT: GET /cats/error —— 触发异常测试 ExceptionFilter
   */
  @Get("error")
  triggerError(): Cat[] {
    this.logger.log("🎯 Controller: triggerError() — 即将抛出异常");
    // 故意抛出异常 → ExceptionFilter 会捕获并返回统一格式
    throw new NotFoundException("这只猫不存在——测试异常");
  }

  /**
   * WHAT: GET /cats/slow —— 慢请求，测试 LoggingInterceptor 的耗时记录
   */
  @Get("slow")
  async slowRequest(): Promise<{ message: string }> {
    this.logger.log("🎯 Controller: slowRequest() 开始");
    // 模拟慢查询
    await new Promise((resolve) => setTimeout(resolve, 2000));
    this.logger.log("🎯 Controller: slowRequest() 完成");
    return { message: "慢请求完成（观察控制台耗时日志）" };
  }
}
