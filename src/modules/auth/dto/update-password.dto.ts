import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { IsNotEmpty, IsOptional, IsPhoneNumber, IsString } from "class-validator";

export class UpdatePasswordDto {
  @ApiPropertyOptional({ example: "770-markaz" })
  @IsOptional()
  @IsString()
  branch_slug?: string;

  @ApiProperty()
  @IsString()
  @IsPhoneNumber("UZ")
  phone: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  password: string;
}
