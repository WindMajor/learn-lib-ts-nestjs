import { Module } from "@nestjs/common";
import { CatsController } from "./cats.controller";
import { CatsService } from "./cats.service";
import { UppercasePipe, OptionalIntPipe } from "../pipes/uppercase.pipe";

@Module({
  controllers: [CatsController],
  providers: [CatsService, UppercasePipe, OptionalIntPipe],
  exports: [CatsService],
})
export class CatsModule {}
