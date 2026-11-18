import { Injectable, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { randomInt } from 'crypto';
import * as bcrypt from 'bcrypt';
import { Role, Status } from '@prisma/client';
import { PrismaService } from 'src/core/database/prisma.service';
import { RedisService } from 'src/common/redis/redis.service';
import { EskizService } from 'src/common/services/sms';
import { JwtGenerateToken } from 'src/common/utills/jwt';
import { LoginDto } from './dto/login.dto';
import { UpdatePasswordDto } from './dto/update-password.dto';
import { VerifyOtpDto } from './dto/verify-otp.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';

/** User / Student / Teacher uchun bitta umumiy ko'rinish */
interface Account {
    kind: 'user' | 'student' | 'teacher';
    id: number;
    email: string;
    password: string;
    role: Role;
    branch_id: number | null;
}

@Injectable()
export class AuthService {
    constructor(
        private prisma: PrismaService,
        private redisService: RedisService,
        private eskizService: EskizService,
        private jwtGenerateToken: JwtGenerateToken,
    ) { }

    /** Login oldidan token yo'q, shuning uchun tenant filtrisiz (xom) klient */
    private get raw() {
        return this.prisma.$raw();
    }

    private otpGenerate() {
        return randomInt(1000, 10000).toString();
    }

    /** OTP kalitlari filial bo'yicha ajratiladi: bir xil telefon boshqa filialda to'qnashmasin */
    private key(branchId: number | null, phone: string) {
        return `${branchId ?? 'root'}:${phone}`;
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

    private pick(r: { id: number; email: string; password: string; branch_id: number | null }) {
        return { id: r.id, email: r.email, password: r.password, branch_id: r.branch_id };
    }

    private async setPassword(acc: Account, hash: string) {
        const data = { password: hash };
        const where = { id: acc.id };
        if (acc.kind === 'user') await this.raw.user.update({ where, data });
        else if (acc.kind === 'student') await this.raw.student.update({ where, data });
        else await this.raw.teacher.update({ where, data });
    }

    private async sendOtp(branchId: number | null, phone: string) {
        const code = this.otpGenerate();
        await this.redisService.set(this.key(branchId, phone), Number(code));
        await this.eskizService.sendSms(
            phone,
            `Fixoo platformasida parolingizni tiklash uchun tasdiqlash kodi: ${code}. Kodni hech kimga bermang!`,
        );
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

    async sendOtpPhone(payload: { phone: string; branch_slug?: string }) {
        const branchId = await this.resolveBranchId(payload.branch_slug);
        const acc = branchId === undefined ? null : await this.findAccount(payload.phone, branchId);
        if (!acc) throw new UnauthorizedException("Telefon raqam tizimda mavjud emas");

        await this.sendOtp(branchId as number | null, payload.phone);
        return {
            success: true,
            message: "Telefon raqam tizimda mavjud",
            role: acc.role,
        };
    }

    async verifyOtp(payload: VerifyOtpDto & { branch_slug?: string }) {
        const branchId = await this.resolveBranchId(payload.branch_slug);
        if (branchId === undefined) throw new UnauthorizedException("Invalid Otp");

        const k = this.key(branchId, payload.phone);
        const existOtp = await this.redisService.get(k);
        if (!existOtp) throw new UnauthorizedException("Otp expired");
        if (String(existOtp) !== String(payload.otp)) throw new UnauthorizedException("Invalid Otp");

        await this.redisService.del(k);
        await this.redisService.set(k + '_verify', 1);
        return { success: true, message: "Otp verified succesfully" };
    }

    async changePassword(payload: UpdatePasswordDto) {
        const branchId = await this.resolveBranchId(payload.branch_slug);
        if (branchId === undefined) throw new NotFoundException('Phone not found');

        const acc = await this.findAccount(payload.phone, branchId);
        if (!acc) throw new NotFoundException('Phone not found');

        const verifyKey = this.key(branchId, payload.phone) + '_verify';
        if (!(await this.redisService.get(verifyKey))) {
            throw new UnauthorizedException('Otp not verified');
        }

        await this.setPassword(acc, await bcrypt.hash(payload.password, 10));
        await this.redisService.del(verifyKey); // bir marta ishlatiladi

        return { success: true, message: 'Password changed succesfully' };
    }

    async refreshToken(payload: RefreshTokenDto) {
        const user = await this.jwtGenerateToken.verifyToken(payload.token);
        if (!user) throw new UnauthorizedException('Invalid token');
        delete user.exp;
        delete user.iat;
        const accessToken = this.jwtGenerateToken.generateAccessToken(user);
        return { success: true, message: "Token refreshed succesfully", accessToken };
    }
}
