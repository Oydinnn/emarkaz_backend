import { ForbiddenException } from '@nestjs/common';
import { BadRequestException, ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "src/core/database/prisma.service";
import { CreateTeacherDto } from "./dto/create.dto";
import * as bcrypt from "bcrypt";
import * as fs from "fs";
import { EmailService } from "src/common/email/email.service";
import { Status, TeacherGroupStatus } from "@prisma/client";
import { UpdateTeacherDto } from "./dto/update.dto";
import { currentBranchId } from "src/common/tenant/tenant.context";

@Injectable()
export class TeachersService {
  constructor(
    private prisma: PrismaService,
    private emailService: EmailService,
  ) {}

  async getAllTeachers() {
    const teachers = await this.prisma.teacher.findMany({
      where: {
        status: Status.active,
      },
      select: {
        id: true,
        full_name: true,
        phone: true,
        photo: true,
        birth_date: true,
        address: true,
        created_at: true,
        groupTeachers: {
          select: {
            group: { select: { id: true, name: true } },
          },
        },
      },
      orderBy: {
        created_at: "desc",
      },
    });


    const formatedTeachers = teachers.map((el) => {
    let photoUrl = '';
    
    if (el.photo) {
      // ✅ To'g'ri URL: /files/rasm.jsg
      photoUrl = `/files/${el.photo}`;
      
      // Yoki to'liq URL:
      // photoUrl = `${process.env.API_URL || 'http://localhost:3000'}/files/${el.photo}`;
    }

    return {
      id: el.id,
      full_name: el.full_name,
      phone: el.phone,
      photo: photoUrl,  // "/files/rasm.jsg"
      birth_date: el.birth_date,
      address: el.address,
      created_at: el.created_at,
      groups: el.groupTeachers.map((gt) => gt.group)
    };
  });

    return {
      success: true,
      data: formatedTeachers,
    };
  }

  async getMyGroups(teacherId: number) {
    // 1. O'qituvchining guruhlarini olish
    const groups = await this.prisma.group.findMany({
      where: {
        groupTeachers: {
          some: {
            teacher_id: teacherId,
            status: TeacherGroupStatus.active, // Faqat active statusdagi guruhlar  
          },
        },
      },
      select: {
        id: true,
        name: true,
        max_student: true,
        start_date: true,
        start_time: true,
        week_day: true,
        status: true,
        description: true,
        courses: {
          select: {
            id: true,
            name: true,
            duration_month: true, // Kurs necha oy davom etishi
            duration_hours: true, // Jami dars soatlari
          },
        },
        rooms: {
          select: {
            id: true,
            name: true,
          },
        },
        studentGroups: {
          select: {
            students: {
              select: {
                _count: true,
                id: true,
                full_name: true,
              },
            },
          },
        },
      },
    });

    const dataFormatter = groups.map((el) => ({
      id: el.id,
      name: el.name,
      max_student: el.max_student,
      start_date: el.start_date,
      start_time: el.start_time,
      weekDay: el.week_day,
      status: el.status,
      description: el.description,
      course: el.courses?.name || "Noma'lum",
      course_duration_month: el.courses?.duration_month || 0,
      course_duration_hours: el.courses?.duration_hours || 0,
      room: el.rooms?.name || "Noma'lum",
      students: el.studentGroups?.map((sg) => sg.students) || [],
      student_count: el.studentGroups?.length || 0,
    }));

    return {
      success: true,
      data: dataFormatter,
    };
  }

  async createTeacher(payload: CreateTeacherDto, filename?: string) {
    // Filial id'sini eng boshida olamiz: tanlanmagan bo'lsa 400 qaytadi
    const branchId = currentBranchId();

    // Telefon mavjudligini tekshirish (telefon filial ichida unikal)
    const existTeacher = await this.prisma.teacher.findFirst({
      where: { phone: payload.phone },
    });

    if (existTeacher) {
      if (filename) {
        fs.unlinkSync(`src/uploads/${filename}`);
      }
      throw new ConflictException("Teacher with this phone already exists");
    }

    // Guruhlarni tekshirish
    let existingGroups : any = [];
    if (payload.groups?.length) {
      existingGroups = await this.prisma.group.findMany({
        where: { id: { in: payload.groups } },
        select: { id: true },
      });

      if (existingGroups.length !== payload.groups.length) {
        const foundIds = existingGroups.map((g) => g.id);
        const missingIds = payload.groups.filter((id) => !foundIds.includes(id));
        throw new NotFoundException(`Guruhlar topilmadi: ${missingIds.join(", ")}`);
      }
    }

    // ✅ Parolni admin o'zi belgilaydi
    const hashPass = await bcrypt.hash(payload.password, 10);


    // Guruhlar shu filialniki ekanini tekshirish (nested connect hookdan o'tmaydi)
    if (payload.groups?.length) {
      const ids = [...new Set(payload.groups)];
      const found = await this.prisma.group.count({ where: { id: { in: ids } } });
      if (found !== ids.length) {
        throw new ForbiddenException("Guruh topilmadi yoki boshqa filialga tegishli");
      }
    }

    // Teacher yaratish
    const newTeacher = await this.prisma.teacher.create({
        data: {
            full_name: payload.full_name,
            photo: filename ?? null,
            phone: payload.phone,
            birth_date: payload.birth_date ? new Date(payload.birth_date) : null,
            password: hashPass,
            address: payload.address,
            branch_id: branchId,
            groupTeachers: payload.groups?.length
                ? {
                    create: payload.groups.map((groupId) => ({
                        group: { connect: { id: groupId } },
                    })),
                }
                : undefined,
        },
    });

    return {
        success: true,
        message: "Teacher created successfully",
        data: {
            id: newTeacher.id,
            full_name: newTeacher.full_name,
            phone: newTeacher.phone,
        }
    };


  }



// 📝 UPDATE TEACHER
  
  async updateTeacher(id: number, payload: UpdateTeacherDto, photoFilename?: string) {
    const teacher = await this.prisma.teacher.findUnique({ 
      where: { id },
      include: { groupTeachers: true }
    });
    
    if (!teacher) throw new NotFoundException("O'qituvchi topilmadi");

    // ✅ Guruhlarni parse qilish (agar JSON string bo'lsa)
    let groupsArray = payload.groups;
    if (typeof payload.groups === 'string') {
      try {
        groupsArray = JSON.parse(payload.groups);
      } catch (e) {
        groupsArray = [];
      }
    }

    // Faqat kelgan fieldlarni yangilash
    const updateData: any = {};

    if (payload.full_name !== undefined) updateData.full_name = payload.full_name;
    if (payload.birth_date !== undefined) updateData.birth_date = new Date(payload.birth_date);
    if (payload.phone !== undefined) updateData.phone = payload.phone;
    if (payload.address !== undefined) updateData.address = payload.address;
    
    if (payload.password) {
      updateData.password = await bcrypt.hash(payload.password, 10);
    }

    // Surat yangilash
    if (photoFilename) {
      if (teacher.photo) {
        const oldPath = `./src/uploads/${teacher.photo}`; // ✅ Faqat filename
        if (fs.existsSync(oldPath)) fs.unlinkSync(oldPath);
      }
      updateData.photo = photoFilename; // ✅ Faqat filename saqlang
    }

    // Guruhlarni yangilash (agar groups berilgan bo'lsa)
    if (groupsArray !== undefined && Array.isArray(groupsArray)) {
      // Avval eski bog'lanishlarni o'chirish
      await this.prisma.groupTeacher.deleteMany({
        where: { teacher_id: id }
      });
      
      // Yangi guruhlarni bog'lash
      if (groupsArray.length > 0) {
        const existingGroups = await this.prisma.group.findMany({
          where: { id: { in: groupsArray } }
        });
        
        if (existingGroups.length !== groupsArray.length) {
          throw new NotFoundException('Ba\'zi guruhlar topilmadi');
        }
        
        await this.prisma.groupTeacher.createMany({
          data: groupsArray.map(groupId => ({
            group_id: groupId,
            teacher_id: id
          }))
        });
      }
    }

    const updatedTeacher = await this.prisma.teacher.update({
      where: { id },
      data: updateData,
      include: {
        groupTeachers: {
          include: {
            group: true
          }
        }
      }
    });

    return {
      success: true,
      message: "Teacher updated successfully",
      data: updatedTeacher
    };
  }

  // 🗑️ DELETE TEACHER
  async deleteTeacher(id: number) {
    const teacher = await this.prisma.teacher.findUnique({ 
      where: { id },
      include: {
        groupTeachers: true // Bog'langan guruhlarni ham olish
      }
    });
    
    if (!teacher) throw new NotFoundException("O'qituvchi topilmadi");

    // Avval bog'langan groupTeachers larni o'chirish
    if (teacher.groupTeachers.length > 0) {
      await this.prisma.groupTeacher.deleteMany({
        where: { teacher_id: id }
      });
    }

    // Suratni o'chirish
    if (teacher.photo) {
      const fs = require('fs');
      const path = `./src/uploads/${teacher.photo.split('/').pop()}`;
      if (fs.existsSync(path)) fs.unlinkSync(path);
    }

    return this.prisma.teacher.delete({ where: { id } });
  }
}
