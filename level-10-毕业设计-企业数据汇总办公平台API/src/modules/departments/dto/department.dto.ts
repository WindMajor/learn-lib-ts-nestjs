import { IsString, IsInt, IsOptional, MinLength } from "class-validator";
import { ApiProperty, PartialType } from "@nestjs/swagger";

export class CreateDeptDto {
  @ApiProperty({ example: "技术部" })
  @IsString() @MinLength(1)
  name!: string;

  @ApiProperty({ required: false })
  @IsOptional() @IsInt()
  parentId?: number;

  @ApiProperty({ required: false })
  @IsOptional() @IsInt()
  leaderId?: number;

  @ApiProperty({ required: false })
  @IsOptional() @IsString()
  description?: string;

  @ApiProperty({ required: false, default: 0 })
  @IsOptional() @IsInt()
  sortOrder?: number;
}

export class UpdateDeptDto extends PartialType(CreateDeptDto) {}
