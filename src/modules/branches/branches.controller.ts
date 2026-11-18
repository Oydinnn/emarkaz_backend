import { Body, Controller, Get, Param, ParseIntPipe, Patch, Post, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation } from "@nestjs/swagger";
import { Role } from "@prisma/client";
import { Roles } from "src/common/decorators/role";
import { AuthGuard } from "src/common/guards/jwt-auth.guard";
import { RolesGuard } from "src/common/guards/role.guard";
import { BranchesService } from "./branches.service";
import { CreateBranchDto } from "./dto/create.dto";
import { UpdateBranchDto } from "./dto/update.dto";

@ApiBearerAuth()
@Controller("branches")
export class BranchesController {
  constructor(private readonly branchesService: BranchesService) {}

  @ApiOperation({ summary: `${Role.SUPERADMIN}` })
  @UseGuards(AuthGuard, RolesGuard)
  @Roles(Role.SUPERADMIN)
  @Get()
  getAllBranches() {
    return this.branchesService.getAllBranches();
  }

  @ApiOperation({ summary: `${Role.SUPERADMIN}` })
  @UseGuards(AuthGuard, RolesGuard)
  @Roles(Role.SUPERADMIN)
  @Get(":id")
  getBranchById(@Param("id", ParseIntPipe) id: number) {
    return this.branchesService.getBranchById(id);
  }

  @ApiOperation({ summary: `Create branch | ${Role.SUPERADMIN}` })
  @UseGuards(AuthGuard, RolesGuard)
  @Roles(Role.SUPERADMIN)
  @Post()
  createBranch(@Body() payload: CreateBranchDto) {
    return this.branchesService.createBranch(payload);
  }

  @ApiOperation({ summary: `Update branch | ${Role.SUPERADMIN}` })
  @UseGuards(AuthGuard, RolesGuard)
  @Roles(Role.SUPERADMIN)
  @Patch(":id")
  updateBranch(
    @Param("id", ParseIntPipe) id: number,
    @Body() payload: UpdateBranchDto,
  ) {
    return this.branchesService.updateBranch(id, payload);
  }
}
