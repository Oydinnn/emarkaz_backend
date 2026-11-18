import { Injectable, Logger, OnModuleInit } from "@nestjs/common";
import { PrismaService } from "src/core/database/prisma.service";
import * as bcrypt from "bcrypt";
import { Role } from "@prisma/client";

@Injectable()
export default class UserSeeder implements OnModuleInit {
  constructor(private prisma: PrismaService) {}

  async onModuleInit() {
    await this.seedSuperAdmin();
  }

  async seedSuperAdmin() {
    // SUPERADMIN hech qaysi filialga tegishli emas (branch_id = null), shuning uchun xom klient
    const raw = this.prisma.$raw();
    const phone = "+998901234567";

    const exist = await raw.user.findFirst({ where: { phone, branch_id: null } });
    if (exist) {
      Logger.log("✅ SUPERADMIN already exists");
      return;
    }

    const password = process.env.SEED_ADMIN_PASSWORD;
    if (!password) {
      Logger.warn("SEED_ADMIN_PASSWORD yo'q: SUPERADMIN yaratilmadi");
      return;
    }

    await raw.user.create({
      data: {
        first_name: "Super",
        last_name: "Admin",
        phone,
        password: await bcrypt.hash(password, 10),
        email: process.env.SEED_ADMIN_EMAIL || "admin@example.com",
        address: "Toshkent",
        role: Role.SUPERADMIN,
        status: "active",
      },
    });
    Logger.log("✅ SUPERADMIN created successfully");
  }
}
