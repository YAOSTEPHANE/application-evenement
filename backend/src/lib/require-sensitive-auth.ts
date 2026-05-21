import { prisma } from "@/lib/prisma";
import type { RequestContext } from "@/lib/request-context";
import { roleMustUse2Fa } from "@/lib/totp-auth";

export class SensitiveAuthError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = "SensitiveAuthError";
  }
}

export async function assertSensitiveActionAllowed(ctx: RequestContext): Promise<void> {
  if (!ctx.actorId || !ctx.role) {
    throw new SensitiveAuthError("Session requise", 401);
  }
  if (ctx.authMethod === "legacy") {
    return;
  }
  const user = await prisma.user.findFirst({
    where: { id: ctx.actorId, organizationId: ctx.organizationId },
    select: { twoFactorEnabled: true, role: true },
  });
  if (!user) {
    throw new SensitiveAuthError("Utilisateur introuvable", 401);
  }
  if (roleMustUse2Fa(user.role, user.twoFactorEnabled) && !ctx.twoFactorVerified) {
    throw new SensitiveAuthError(
      "Authentification à deux facteurs requise. Reconnectez-vous avec votre code TOTP.",
      403,
    );
  }
}
