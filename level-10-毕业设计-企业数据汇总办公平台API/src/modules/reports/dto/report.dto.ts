import { IsString, IsEnum, IsInt, IsOptional, IsObject, MinLength } from "class-validator";
import { ApiProperty, PartialType } from "@nestjs/swagger";

export enum ReportCategory { DATA_SUMMARY = "DATA_SUMMARY", FINANCE_INCOME = "FINANCE_INCOME", HR_PERSONNEL = "HR_PERSONNEL", PROJECT_PROGRESS = "PROJECT_PROGRESS" }

export class CreateReportDto {
  @ApiProperty({ example: "2024年Q1销售额汇总" })
  @IsString() @MinLength(1)
  title!: string;

  @ApiProperty({ enum: ReportCategory, default: ReportCategory.DATA_SUMMARY })
  @IsOptional() @IsEnum(ReportCategory)
  category?: ReportCategory;

  @ApiProperty({ example: { revenue: 1000000, growth: "15%", note: "含线下渠道" } })
  @IsObject()
  content!: Record<string, any>;

  @ApiProperty()
  @IsInt()
  departmentId!: number;
}

export class UpdateReportDto extends PartialType(CreateReportDto) {}
