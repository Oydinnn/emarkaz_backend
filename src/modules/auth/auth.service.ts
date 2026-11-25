import { Injectable, UnauthorizedException } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { Role, Status } from '@prisma/client';
import { PrismaService } from 'src/core/database/prisma.service';
import { JwtGenerateToken } from 'src/common/utills/jwt';
import { LoginDto } from './dto/login.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';

/** User / Student / Teacher uchun bitta umumiy ko'rinish */
interface Account {
    kind: 'user' | 'student' | 'teacher';
    id: number;
    email: string | null;
    password: string;
    role: Role;
    branch_id: number | null;
}

@Injectable()
export class AuthService {
    constructor(
        private prisma: PrismaService,
        private jwtGenerateToken: JwtGenerateToken,
    ) { }

    /** Login oldidan token yo'q, shuning uchun tenant filtrisiz (xom) klient */
    private get raw() {
        return this.prisma.$raw();
    }

    /** slug yo'q -> null (SUPERADMIN). slug bor lekin noto'g'ri/nofaol -> undefined */
    private async resolveBranchId(slug?: string): Promise<number | null | undefined> {
        if (!slug) return null;
        const branch = await this.raw.branch.findUnique({ where: { slug } });
        if (!branch || branch.status !== Status.active) return undefined;
        return branch.id;
    }

    private async findAccount(phone: string, branchId: number | null): Promise<Account | null> {
        if (branchId === null) {
            const admin = await this.raw.user.findFirst({
                where: { phone, branch_id: null, role: Role.SUPERADMIN },
            });
            return admin ? { kind: 'user', ...this.pick(admin), role: admin.role } : null;
        }

        const where = { branch_id_phone: { branch_id: branchId, phone } };

        const user = await this.raw.user.findUnique({ where });
        if (user) return { kind: 'user', ...this.pick(user), role: user.role };

        const student = await this.raw.student.findUnique({ where });
        if (student) return { kind: 'student', ...this.pick(student), role: Role.STUDENT };

        const teacher = await this.raw.teacher.findUnique({ where });
        if (teacher) return { kind: 'teacher', ...this.pick(teacher), role: Role.TEACHER };

        return null;
    }

    private pick(r: { id: number; email: string | null; password: string; branch_id: number | null }) {
        return { id: r.id, email: r.email, password: r.password, branch_id: r.branch_id };
    }

    async userLogin(payload: LoginDto) {
        const fail = () => new UnauthorizedException("Markaz kodi, telefon raqam yoki parol noto'g'ri");

        const branchId = await this.resolveBranchId(payload.branch_slug);
        if (branchId === undefined) throw fail();

        const acc = await this.findAccount(payload.phone, branchId);
        if (!acc) throw fail();

        const isMatch = await bcrypt.compare(payload.password, acc.password);
        if (!isMatch) throw fail();

        const tokenPayload = { id: acc.id, email: acc.email, role: acc.role, branch_id: acc.branch_id };
        return {
            success: true,
            message: "Tizimga muvaffaqiyatli kirdingiz",
            role: acc.role,
            branch_id: acc.branch_id,
            accessToken: this.jwtGenerateToken.generateAccessToken(tokenPayload),
            refreshToken: this.jwtGenerateToken.generateRefreshToken(tokenPayload),
        };
    }

    async refreshToken(payload: RefreshTokenDto) {
        const user = await this.jwtGenerateToken.verifyToken(payload.token);
        if (!user || user.typ !== "refresh") throw new UnauthorizedException("Invalid token");
        delete user.exp;
        delete user.iat;
        const accessToken = this.jwtGenerateToken.generateAccessToken(user);
        return { success: true, message: "Token refreshed succesfully", accessToken };
    }
}
