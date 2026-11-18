import { ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "src/core/database/prisma.service";
import { CreateBranchDto } from "./dto/create.dto";
import { UpdateBranchDto } from "./dto/update.dto";

@Injectable()
export class BranchesService {
  constructor(private prisma: PrismaService) {}

  /** Branch jadvali tenant jadvali emas: xom klient bilan ishlaymiz (SUPERADMIN uchun) */
  private get raw() {
    return this.prisma.$raw();
  }

  async getAllBranches() {
    const branches = await this.raw.branch.findMany({
      orderBy: { id: "asc" },
    });

    return {
      success: true,
      data: branches,
    };
  }

  async getBranchById(id: number) {
    const branch = await this.raw.branch.findUnique({ where: { id } });
    if (!branch) throw new NotFoundException("Filial topilmadi");

    return {
      success: true,
      data: branch,
    };
  }

  async createBranch(payload: CreateBranchDto) {
    const exist = await this.raw.branch.findUnique({ where: { slug: payload.slug } });
    if (exist) throw new ConflictException("Bunday markaz kodi (slug) allaqachon mavjud");

    const branch = await this.raw.branch.create({
      data: {
        name: payload.name,
        slug: payload.slug,
        address: payload.address,
        phone: payload.phone,
        logo: payload.logo,
      },
    });

    return {
      success: true,
      message: "Filial yaratildi",
      data: branch,
    };
  }

  async updateBranch(id: number, payload: UpdateBranchDto) {
    const branch = await this.raw.branch.findUnique({ where: { id } });
    if (!branch) throw new NotFoundException("Filial topilmadi");

    if (payload.slug && payload.slug !== branch.slug) {
      const duplicate = await this.raw.branch.findUnique({ where: { slug: payload.slug } });
      if (duplicate) throw new ConflictException("Bunday markaz kodi (slug) allaqachon mavjud");
    }

    const updated = await this.raw.branch.update({
      where: { id },
      data: {
        name: payload.name,
        slug: payload.slug,
        address: payload.address,
        phone: payload.phone,
        logo: payload.logo,
        status: payload.status,
      },
    });

    return {
      success: true,
      message: "Filial yangilandi",
      data: updated,
    };
  }
}
