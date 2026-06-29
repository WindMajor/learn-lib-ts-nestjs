import { IsString, IsEmail, IsInt, Min, Max, IsOptional } from "class-validator";

export class CreateUserDto {
  @IsString()
  name!: string;

  @IsEmail()
  email!: string;

  @IsInt()
  @Min(1)
  @Max(150)
  age!: number;
}

export class UpdateUserDto {
  @IsString()
  @IsOptional()
  name?: string;

  @IsEmail()
  @IsOptional()
  email?: string;

  @IsInt()
  @Min(1)
  @Max(150)
  @IsOptional()
  age?: number;
}
