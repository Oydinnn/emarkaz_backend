import { Injectable, UnauthorizedException } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";

@Injectable()
export class JwtGenerateToken {
  constructor(private jwtService: JwtService) {}

  generateAccessToken(payload: any) {
    const { exp, iat, typ, ...rest } = payload;
    return this.jwtService.sign({ ...rest, typ: "access" }, { expiresIn: "1h" });
  }

  generateRefreshToken(payload: any) {
    const { exp, iat, typ, ...rest } = payload;
    return this.jwtService.sign({ ...rest, typ: "refresh" }, { expiresIn: "7d" });
  }

  verifyToken(token: string) {
    try {
      return this.jwtService.verify(token, { secret: process.env.JWT_SECRET });
    } catch (error) {
      throw new UnauthorizedException("Invalid token");
    }
  }
}
