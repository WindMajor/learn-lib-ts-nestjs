import {
  Controller, Get, Post, Patch, Delete,
  Param, Body, ParseIntPipe, HttpCode, HttpStatus, Logger,
} from "@nestjs/common";
import { UserService, User } from "./user.service";
import { CreateUserDto, UpdateUserDto } from "./dto/user.dto";

@Controller("users")
export class UserController {
  private readonly logger = new Logger(UserController.name);

  constructor(private readonly userService: UserService) {}

  @Get()
  findAll(): User[] {
    return this.userService.findAll();
  }

  @Get(":id")
  findOne(@Param("id", ParseIntPipe) id: number): User {
    return this.userService.findOne(id);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  create(@Body() dto: CreateUserDto): User {
    this.logger.log(`创建用户: ${dto.name}`);
    return this.userService.create(dto);
  }

  @Patch(":id")
  update(
    @Param("id", ParseIntPipe) id: number,
    @Body() dto: UpdateUserDto,
  ): User {
    return this.userService.update(id, dto);
  }

  @Delete(":id")
  @HttpCode(HttpStatus.OK)
  remove(@Param("id", ParseIntPipe) id: number) {
    return this.userService.remove(id);
  }
}
