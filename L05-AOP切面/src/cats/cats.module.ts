import { Module } from "@nestjs/common";
import { CatsController } from "./cats.controller";
import { CatsService } from "./cats.service";
import { RoleGuard } from "../common/guards/auth.guard";

@Module({
  controllers: [CatsController],
  providers: [CatsService, RoleGuard],
  exports: [CatsService],
})
export class CatsModule {}
