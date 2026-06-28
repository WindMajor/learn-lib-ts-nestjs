import { IsString, IsEmail, IsEnum, IsOptional, IsInt, IsBoolean, MinLength } from "class-validator";
import { ApiProperty, PartialType } from "@nestjs/swagger";

export enum UserRole { ADMIN = "ADMIN", DEPARTMENT_MANAGER = "DEPARTMENT_MANAGER", USER = "USER", VIEWER = "VIEWER" }

export class CreateUserDto {
  @ApiProperty({ example: "zhangsan" })
  @IsString() @MinLength(2)
  username!: string;

  @ApiProperty({ example: "zhang@company.com" })
  @IsEmail()
  email!: string;

  @ApiProperty({ example: "123456" })
  @IsOptional() @IsString() @MinLength(6)
  password?: string;

  @ApiProperty({ required: false, example: "张三" })
  @IsOptional() @IsString()
  realName?: string;

  @ApiProperty({ enum: UserRole, default: UserRole.USER })
  @IsOptional() @IsEnum(UserRole)
  role?: UserRole;

  @ApiProperty({ required: false })
  @IsOptional() @IsInt()
  departmentId?: number;
}

export class UpdateUserDto extends PartialType(CreateUserDto) {
  @ApiProperty({ required: false })
  @IsOptional() @IsBoolean()
  isActive?: boolean;
}
