import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { IsNotEmpty, IsOptional, IsString, MinLength } from "class-validator";

export class LoginDto {
  @ApiPropertyOptional({ example: "770-markaz", description: "Markaz kodi (Branch.slug). SUPERADMIN uchun bo'sh qoldiriladi" })
  @IsOptional()
  @IsString()
  branch_slug?: string;

  @ApiProperty({ example: "+998901234567" })
  @IsString()
  @IsNotEmpty()
  phone!: string;

  @ApiProperty({ example: "Parol123!" })
  @IsString()
  @MinLength(6)
  @IsNotEmpty()
  password!: string;
}
