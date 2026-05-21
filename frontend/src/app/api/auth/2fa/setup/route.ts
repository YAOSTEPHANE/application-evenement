
import { ApiAuthError, requireAuthenticatedContext } from "@/lib/api-auth";
import { NextResponse } from "next/server";
import { z } from "zod";


import { prisma } from "@/lib/prisma";
import { buildOtpAuthUri, generateTotpSecret, verifyTotpCode } from "@/lib/totp-auth";

export async function GET() {
  const { actorId, organizationId } = await requireAuthenticatedContext();
  if (!actorId) {
    return NextResponse.json({ message: "Non authentifié" }, { status: 401 });
  }
  const user = await prisma.user.findFirst({
    where: { id: actorId, organizationId },
    select: { email: true, twoFactorEnabled: true },
  });
  if (!user) {
    return NextResponse.json({ message: "Utilisateur introuvable" }, { status: 404 });
  }
  return NextResponse.json({ enabled: user.twoFactorEnabled });
}

export async function POST(request: Request) {
  try {
    const { actorId, organizationId } = await requireAuthenticatedContext();
    if (!actorId) {
      return NextResponse.json({ message: "Non authentifié" }, { status: 401 });
    }
    const body = z
      .object({
        action: z.enum(["begin", "confirm"]),
        code: z.string().optional(),
      })
      .parse(await request.json());

    const user = await prisma.user.findFirst({
      where: { id: actorId, organizationId },
    });
    if (!user) {
      return NextResponse.json({ message: "Utilisateur introuvable" }, { status: 404 });
    }

    if (body.action === "begin") {
      const secret = generateTotpSecret();
      await prisma.user.update({
        where: { id: user.id },
        data: { totpSecret: secret, twoFactorEnabled: false },
      });
      return NextResponse.json({
        secret,
        otpauthUrl: buildOtpAuthUri(user.email, secret),
        message: "Scannez l'URI dans Google Authenticator ou Microsoft Authenticator.",
      });
    }

    if (!body.code || !user.totpSecret) {
      return NextResponse.json({ message: "Code TOTP requis" }, { status: 400 });
    }
    const valid = await verifyTotpCode(user.totpSecret, body.code);
    if (!valid) {
      return NextResponse.json({ message: "Code invalide" }, { status: 400 });
    }
    await prisma.user.update({
      where: { id: user.id },
      data: { twoFactorEnabled: true },
    });
    return NextResponse.json({ enabled: true });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ message: "Requête invalide" }, { status: 400 });
    }
    return NextResponse.json({ message: "Configuration 2FA impossible" }, { status: 500 });
  }
}
