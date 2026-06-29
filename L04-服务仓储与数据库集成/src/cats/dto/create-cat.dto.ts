import { IsString, IsInt, Min, Max, MinLength, MaxLength } from "class-validator";

export class CreateCatDto {
  @IsString()
  @MinLength(1)
  @MaxLength(50)
  name!: string;

  @IsInt()
  @Min(0)
  @Max(30)
  age!: number;

  @IsString()
  @MinLength(1)
  breed!: string;
}
