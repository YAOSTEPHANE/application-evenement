import type { UserRole } from "@/lib/api";

function isSupervisor(role: UserRole): boolean {
  return role === "ADMIN" || role === "MANAGER";
}

export function canUseFieldApp(role: UserRole): boolean {
  return (
    isSupervisor(role) ||
    role === "STOREKEEPER" ||
    role === "TECHNICAL_MANAGER" ||
    role === "FLEET_MANAGER" ||
    role === "TECHNICIAN"
  );
}
