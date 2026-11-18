import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { IsOptional, IsString, Matches, MinLength } from "class-validator";

export class CreateBranchDto {
  @ApiProperty({ example: "770 Markaz" })
  @IsString()
  @MinLength(2)
  name!: string;

  @ApiProperty({
    example: "770-markaz",
    description: "Login paytidagi markaz kodi: kichik lotin harflari, raqamlar va tire",
  })
  @IsString()
  @Matches(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, {
    message: "slug faqat kichik lotin harflari, raqamlar va tiredan iborat bo'lishi kerak",
  })
  slug!: string;

  @ApiPropertyOptional({ example: "Toshkent, Chilonzor" })
  @IsOptional()
  @IsString()
  address?: string;

  @ApiPropertyOptional({ example: "+998901112233" })
  @IsOptional()
  @IsString()
  phone?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  logo?: string;
}
