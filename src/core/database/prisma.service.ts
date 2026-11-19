import { Injectable, Logger } from "@nestjs/common";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";
import { applyTenant, branchFilter } from "src/common/tenant/tenant.extension";
import { getTenant } from "src/common/tenant/tenant.context";

/**
 * Barcha servislar shu PrismaService ni ishlatadi, lekin u endi TENANT-FILTRLI klient.
 * Filtrsiz (xom) klient kerak bo'lsa (login, seeder, branches): this.prisma.$raw()
 */
@Injectable()
export class PrismaService extends PrismaClient {
  /** Tenant filtrisiz klient. Faqat auth/seeder/branches ichida ishlating. */
  declare $raw: () => PrismaClient;

  constructor() {
    const pool = new Pool({ connectionString: process.env.DATABASE_URL });
    super({ adapter: new PrismaPg(pool), log: ["error", "warn"] });

    const base: PrismaClient = this;

    base
      .$connect()
      .then(() => Logger.log("✅ Prisma connect"))
      .catch((e) => Logger.error("❌ Prisma connect xatosi", e));
    process.on("beforeExit", async () => {
      await base.$disconnect();
      await pool.end();
    });

    const scoped = base.$extends({
      name: "tenant",
      client: { $raw: () => base },
      query: {
        $allModels: {
          async $allOperations({ model, operation, args, query }: any) {
            const next = await applyTenant(
              { model, operation, args },
              getTenant(),
              async (groupId, branchId) =>
                (await base.group.count({ where: { id: groupId, branch_id: branchId } })) > 0,
              async (model, id, branchId) =>
                (await (base as any)[model[0].toLowerCase() + model.slice(1)]
                  .count({ where: { id, ...branchFilter(model, branchId) } })) > 0,
            );
            return query(next);
          },
        },
      },
    });

    // Nest shu (kengaytirilgan) obyektni provider sifatida beradi
    return scoped as unknown as this;
  }
}
