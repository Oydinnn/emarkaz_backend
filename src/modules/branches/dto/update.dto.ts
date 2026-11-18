import { ApiPropertyOptional, PartialType } from "@nestjs/swagger";
import { IsEnum, IsOptional } from "class-validator";
import { Status } from "@prisma/client";
import { CreateBranchDto } from "./create.dto";

export class UpdateBranchDto extends PartialType(CreateBranchDto) {
  @ApiPropertyOptional({ enum: Status })
  @IsOptional()
  @IsEnum(Status)
  status?: Status;
}
