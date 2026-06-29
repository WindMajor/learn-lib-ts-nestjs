import { Controller, Post, Body, Get, UseGuards } from "@nestjs/common";
import { AuthService } from "./auth.service";
import { JwtAuthGuard } from "./guards/jwt-auth.guard";
import { RolesGuard } from "./guards/roles.guard";
import { Roles } from "./decorators/roles.decorator";
import { CurrentUser } from "./decorators/current-user.decorator";

class LoginDto {
  username!: string;
  password!: string;
}

@Controller("auth")
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  /**
   * POST /auth/login —— 登录获取 Token
   * 
   * 测试命令:
   * curl -X POST http://localhost:3000/auth/login \
   *   -H "Content-Type: application/json" \
   *   -d '{"username":"admin","password":"admin123"}'
   */
  @Post("login")
  login(@Body() dto: LoginDto) {
    return this.authService.login(dto.username, dto.password);
  }

  /**
   * GET /auth/profile —— 获取当前用户信息（需要 JWT）
   * 
   * @UseGuards(JwtAuthGuard) → 需要 Authorization: Bearer <token>
   * @CurrentUser() → 自动提取 request.user
   *
   * 【对比 Express】需要手动 req.user
   * 【对比 Spring】@AuthenticationPrincipal 效果一致
   */
  @UseGuards(JwtAuthGuard)
  @Get("profile")
  getProfile(
    @CurrentUser() user: { userId: number; username: string; role: string },
  ) {
    return { message: "获取个人资料成功", data: user };
  }

  /**
   * GET /auth/admin —— 仅 admin 角色可访问
   * 
   * @UseGuards(JwtAuthGuard, RolesGuard) → 需要认证 + admin 角色
   * @Roles('admin') → 标记所需角色
   *
   * 测试：
   * 1. 用 admin/admin123 登录 → 获取 token
   * 2. curl http://localhost:3000/auth/admin -H "Authorization: Bearer <token>"
   * 3. 用 user/user123 登录 → 403 Forbidden
   */
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles("admin")
  @Get("admin")
  adminEndpoint(@CurrentUser() user: { username: string }) {
    return { message: `欢迎管理员 ${user.username}`, data: [] };
  }
}
