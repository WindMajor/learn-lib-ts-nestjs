import { Module } from "@nestjs/common";
import { CatsController } from "./cats.controller";
import { CatsService } from "./cats.service";
import { CatsRepository } from "./cats.repository";
// WHAT: DrizzleModule 替换 PrismaModule
// WHY: Drizzle 作为新的 ORM 方案，更接近原生 SQL
import { DrizzleModule } from "../db/drizzle.module";

@Module({
  imports: [DrizzleModule],
  controllers: [CatsController],
  providers: [CatsService, CatsRepository],
  exports: [CatsService],
})
export class CatsModule {}
