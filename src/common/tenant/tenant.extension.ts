import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { TenantStore } from './tenant.context';

type Rule =
  | { kind: 'direct' }
  | { kind: 'via'; relation: string; groupField: string }
  | { kind: 'path'; path: string[] };

/**
 * branch_id to'g'ridan-to'g'ri bor modellar: 'direct'.
 * branch_id yo'q, lekin Group orqali bog'langanlar: 'via'.
 * Lesson, Homework, Attendance ... hali yo'q: schema ko'rilgach qo'shiladi.
 */
export const TENANT_MODELS: Record<string, Rule> = {
  User: { kind: 'direct' },
  Student: { kind: 'direct' },
  Teacher: { kind: 'direct' },
  Course: { kind: 'direct' },
  Room: { kind: 'direct' },
  Group: { kind: 'direct' },
  GroupTeacher: { kind: 'via', relation: 'group', groupField: 'group_id' },
  StudentGroup: { kind: 'via', relation: 'groups', groupField: 'group_id' },
  Lesson: { kind: 'path', path: ['groups'] },
  Homework: { kind: 'path', path: ['groups'] },
  HomeworkResult: { kind: 'path', path: ['groups'] },
  LessonVideo: { kind: 'path', path: ['lesson', 'groups'] },
  Attendance: { kind: 'path', path: ['students'] },
  HomeworkAnswerStudent: { kind: 'path', path: ['students'] },
};

const GLOBAL_MODELS = new Set(['Branch']);

const UNIQUE_OPS = new Set(['findUnique', 'findUniqueOrThrow', 'update', 'delete', 'upsert']);
const WHERE_OPS = new Set([
  'findFirst', 'findFirstOrThrow', 'findMany', 'count', 'aggregate', 'groupBy',
  'updateMany', 'updateManyAndReturn', 'deleteMany',
]);
const CREATE_OPS = new Set(['create', 'createMany', 'createManyAndReturn']);

export type GroupBelongs = (groupId: number, branchId: number) => Promise<boolean>;

const rows = (data: any): any[] => (Array.isArray(data) ? data : [data]);

const REFS: Record<string, Record<string, string>> = {
  Group: { course_id: 'Course', room_id: 'Room' },
  GroupTeacher: { teacher_id: 'Teacher', group_id: 'Group' },
  StudentGroup: { student_id: 'Student', group_id: 'Group' },
  Lesson: { group_id: 'Group', teacher_id: 'Teacher' },
  Homework: { group_id: 'Group', lesson_id: 'Lesson', teacher_id: 'Teacher' },
  HomeworkResult: { group_id: 'Group', homework_id: 'Homework', homework_answer_id: 'HomeworkAnswerStudent', teacher_id: 'Teacher' },
  LessonVideo: { lesson_id: 'Lesson', group_id: 'Group' },
  Attendance: { student_id: 'Student', lesson_id: 'Lesson', teacher_id: 'Teacher' },
  HomeworkAnswerStudent: { student_id: 'Student', homework_id: 'Homework' },
};

export type Exists = (model: string, id: number, branchId: number) => Promise<boolean>;

async function checkRefs(model: string, data: any, branchId: number, exists: Exists) {
  const refs = REFS[model];
  if (!refs || !data) return;
  for (const d of rows(data)) {
    for (const [field, target] of Object.entries(refs)) {
      const id = d?.[field];
      if (id == null) continue;
      if (typeof id !== 'number' || !(await exists(target, id, branchId))) {
        throw new ForbiddenException(`${target} topilmadi yoki boshqa filialga tegishli`);
      }
    }
  }
}

function stripBranch(data: any): any {
  if (!data || typeof data !== 'object') return data;
  const { branch_id, branch, ...rest } = data;
  return rest;
}

export function branchFilter(model: string, branchId: number): any {
  const rule = TENANT_MODELS[model];
  if (!rule) throw new Error(`Tenant qoidasi yo'q: ${model}`);
  if (rule.kind === 'direct') return { branch_id: branchId };
  if (rule.kind === 'via') return { [rule.relation]: { branch_id: branchId } };
  return rule.path.reduceRight((acc: any, key: string) => ({ [key]: acc }), { branch_id: branchId });
}

export async function applyTenant(
  p: { model: string; operation: string; args: any },
  tenant: TenantStore,
  groupBelongs: GroupBelongs,
  exists: Exists,
): Promise<any> {
  const rule = TENANT_MODELS[p.model];
  if (!rule) {
    if (GLOBAL_MODELS.has(p.model)) return p.args;
    throw new ForbiddenException(`${p.model} uchun tenant qoidasi yo'q`);
  }

  if (tenant.mode === 'none') {
    throw new ForbiddenException(`Tenant kontekst yo'q (${p.model}.${p.operation})`);
  }

  const op = p.operation;
  const args = { ...(p.args ?? {}) };

  // SUPERADMIN, filial tanlanmagan: filtr yo'q, lekin yaratishda filial aniq bo'lishi shart
  if (tenant.mode === 'all') {
    if (CREATE_OPS.has(op) && rule.kind === 'direct') {
      for (const d of rows(args.data)) {
        if (d?.branch_id == null && d?.branch == null) {
          throw new BadRequestException('Yaratish uchun x-branch-id sarlavhasi kerak');
        }
      }
    }
    return args;
  }

  const branchId = tenant.branchId;

  if (CREATE_OPS.has(op)) await checkRefs(p.model, args.data, branchId, exists);
  if (op === 'update' || op === 'updateMany' || op === 'updateManyAndReturn') {
    await checkRefs(p.model, args.data, branchId, exists);
  }
  if (op === 'upsert') {
    await checkRefs(p.model, args.create, branchId, exists);
    await checkRefs(p.model, args.update, branchId, exists);
  }
  const filter = branchFilter(p.model, branchId);

  if (UNIQUE_OPS.has(op)) {
    // findUnique/update/delete: AND bilan o'rab bo'lmaydi, yuqori darajada qo'shamiz
    args.where = { ...(args.where ?? {}), ...filter };
    if (op === 'update' && rule.kind === 'direct') args.data = stripBranch(args.data);
    if (op === 'upsert' && rule.kind === 'direct') {
      args.update = stripBranch(args.update);
      args.create = { ...stripBranch(args.create), branch_id: branchId };
    }
    return args;
  }

  if (WHERE_OPS.has(op)) {
    args.where = args.where ? { AND: [args.where, filter] } : filter;
    if ((op === 'updateMany' || op === 'updateManyAndReturn') && rule.kind === 'direct') {
      args.data = stripBranch(args.data);
    }
    return args;
  }

  if (CREATE_OPS.has(op)) {
    if (rule.kind === 'direct') {
      const stamp = (d: any) => ({ ...stripBranch(d), branch_id: branchId });
      args.data = Array.isArray(args.data) ? args.data.map(stamp) : stamp(args.data);
    } else if (rule.kind === 'via') {
      // GroupTeacher / StudentGroup: guruh shu filialniki ekanini tekshiramiz
      for (const d of rows(args.data)) {
        const gid = d?.[rule.groupField] ?? d?.[rule.relation]?.connect?.id;
        if (typeof gid !== 'number' || !(await groupBelongs(gid, branchId))) {
          throw new ForbiddenException("Guruh topilmadi yoki boshqa filialga tegishli");
        }
      }
    }
    return args;
  }

  return args;
}
