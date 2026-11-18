import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { TenantStore } from './tenant.context';

type Rule = { kind: 'direct' } | { kind: 'via'; relation: string; groupField: string };

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
};

const UNIQUE_OPS = new Set(['findUnique', 'findUniqueOrThrow', 'update', 'delete', 'upsert']);
const WHERE_OPS = new Set([
  'findFirst', 'findFirstOrThrow', 'findMany', 'count', 'aggregate', 'groupBy',
  'updateMany', 'updateManyAndReturn', 'deleteMany',
]);
const CREATE_OPS = new Set(['create', 'createMany', 'createManyAndReturn']);

export type GroupBelongs = (groupId: number, branchId: number) => Promise<boolean>;

const rows = (data: any): any[] => (Array.isArray(data) ? data : [data]);

function stripBranch(data: any): any {
  if (!data || typeof data !== 'object') return data;
  const { branch_id, branch, ...rest } = data;
  return rest;
}

export async function applyTenant(
  p: { model: string; operation: string; args: any },
  tenant: TenantStore,
  groupBelongs: GroupBelongs,
): Promise<any> {
  const rule = TENANT_MODELS[p.model];
  if (!rule) return p.args;

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
  const filter = rule.kind === 'direct'
    ? { branch_id: branchId }
    : { [rule.relation]: { branch_id: branchId } };

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
    } else {
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
