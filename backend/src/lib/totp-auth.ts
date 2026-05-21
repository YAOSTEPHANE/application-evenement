import type { Role } from "@prisma/client";

import { roleRequires2Fa } from "@/lib/cdc-labels";

export function roleMustUse2Fa(role: Role, twoFactorEnabled: boolean): boolean {
  if (twoFactorEnabled) return true;
  return process.env.CDC_FORCE_2FA === "true" && roleRequires2Fa(role);
}
