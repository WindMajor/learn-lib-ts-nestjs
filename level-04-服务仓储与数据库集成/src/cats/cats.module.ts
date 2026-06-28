import { Module } from "@nestjs/common";
import { CatsController } from "./cats.controller";
import { CatsService } from "./cats.service";
import { CatsRepository } from "./cats.repository";
import { PrismaModule } from "../database/prisma.module";

@Module({
  imports: [PrismaModule],
  controllers: [CatsController],
  providers: [CatsService, CatsRepository],
  exports: [CatsService],
})
export class CatsModule {}
