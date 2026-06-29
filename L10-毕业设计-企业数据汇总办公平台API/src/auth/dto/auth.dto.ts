import { IsString, MinLength, IsEmail, IsOptional } from "class-validator";
import { ApiProperty } from "@nestjs/swagger";

export class LoginDto {
  @ApiProperty({ example: "admin" })
  @IsString() @MinLength(2)
  username!: string;

  @ApiProperty({ example: "admin123" })
  @IsString() @MinLength(6)
  password!: string;
}

export class RegisterDto {
  @ApiProperty({ example: "zhangsan" })
  @IsString() @MinLength(2)
  username!: string;

  @ApiProperty({ example: "zhang@company.com" })
  @IsEmail()
  email!: string;

  @ApiProperty({ example: "123456" })
  @IsString() @MinLength(6)
  password!: string;

  @ApiProperty({ required: false })
  @IsOptional() @IsString()
  realName?: string;
}
