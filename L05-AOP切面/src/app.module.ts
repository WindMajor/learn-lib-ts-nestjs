import { Module } from "@nestjs/common";
import { APP_GUARD } from "@nestjs/core";
import { CatsModule } from "./cats/cats.module";
import { AuthGuard } from "./common/guards/auth.guard";

@Module({
  imports: [CatsModule],
  providers: [
    // WHAT: 使用 APP_GUARD 令牌注册全局 Guard
    // WHY: 这样可以在 AuthGuard 中使用依赖注入（如注入 UserService）
    //   而 app.useGlobalGuards(new AuthGuard()) 无法注入依赖
    // 【对比 Spring】Spring 的 @Component 自动成为全局 Bean
    {
      provide: APP_GUARD,
      useClass: AuthGuard,
    },
  ],
})
export class AppModule {}
