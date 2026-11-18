import { AsyncLocalStorage } from 'async_hooks';
import { BadRequestException } from '@nestjs/common';

/**
 * none   - tenant aniqlanmagan (login, public route): tenant jadvallariga so'rov XATO beradi
 * all    - SUPERADMIN x-branch-id sarlavhasisiz: hamma filialni ko'radi
 * branch - bitta filial bilan cheklangan
 */
export type TenantStore =
  | { mode: 'none' }
  | { mode: 'all' }
  | { mode: 'branch'; branchId: number };

export interface TenantHolder {
  tenant: TenantStore;
}

export const tenantStorage = new AsyncLocalStorage<TenantHolder>();

export function setTenant(tenant: TenantStore): void {
  const holder = tenantStorage.getStore();
  if (!holder) {
    throw new Error("Tenant konteksti yo'q: main.ts ga tenantStorage.run middleware qo'shing");
  }
  holder.tenant = tenant;
}

export function getTenant(): TenantStore {
  return tenantStorage.getStore()?.tenant ?? { mode: 'none' };
}

/** create() uchun: joriy filial id. SUPERADMIN x-branch-id bermagan bo'lsa 400. */
export function currentBranchId(): number {
  const t = getTenant();
  if (t.mode !== 'branch') {
    throw new BadRequestException("Filial tanlanmagan: x-branch-id sarlavhasi kerak");
  }
  return t.branchId;
}
