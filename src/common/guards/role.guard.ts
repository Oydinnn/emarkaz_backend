import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from "@nestjs/common";
import { Reflector } from "@nestjs/core";

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    // Handler yoki controller darajasidagi @Roles(...) ni o'qiydi
    const roles = this.reflector.getAllAndOverride<string[]>("roles", [
      context.getHandler(),
      context.getClass(),
    ]);
    // @Roles yo'q bo'lsa: oldin TypeError (500) berardi, endi faqat AuthGuard yetarli
    if (!roles || roles.length === 0) return true;

    const req = context.switchToHttp().getRequest();
    if (!roles.includes(req["user"]?.role)) {
      throw new ForbiddenException();
    }
    return true;
  }
}
