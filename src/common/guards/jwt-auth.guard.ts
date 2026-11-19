import { BadRequestException, CanActivate, ExecutionContext, Injectable, NotFoundException, UnauthorizedException } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { Role } from "@prisma/client";
import { setTenant } from "../tenant/tenant.context";
import { PrismaService } from "src/core/database/prisma.service";

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(private jwtService: JwtService, private prisma: PrismaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest();

    let user: any;
    try {
      const token = req.headers.authorization?.split(" ")[1];
      if (!token) throw new Error("no token");
      user = this.jwtService.verify(token);
      if (user.typ !== "access") throw new Error("not access token");
    } catch {
      throw new UnauthorizedException();
    }

    if (user.role === Role.SUPERADMIN) {
      // SUPERADMIN: x-branch-id bo'lsa shu filial nomidan, bo'lmasa hamma filialni ko'radi
      const h = req.headers["x-branch-id"];
      if (h === undefined || h === "") {
        setTenant({ mode: "all" });
      } else {
        const id = Number(h);
        if (!Number.isInteger(id) || id <= 0) {
          throw new BadRequestException("x-branch-id noto'g'ri");
        }
        const branch = await this.prisma.$raw().branch.findUnique({ where: { id }, select: { id: true } });
        if (!branch) throw new NotFoundException("Filial topilmadi");
        setTenant({ mode: "branch", branchId: id });
      }
    } else {
      // Boshqa rollar: faqat tokendagi filial. x-branch-id e'tiborga olinmaydi.
      if (!Number.isInteger(user.branch_id)) {
        throw new UnauthorizedException("Token eskirgan, qayta kiring");
      }
      setTenant({ mode: "branch", branchId: user.branch_id });
    }

    req["user"] = user;
    return true;
  }
}
