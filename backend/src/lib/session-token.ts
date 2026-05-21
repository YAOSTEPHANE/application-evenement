import { SignJWT, jwtVerify } from "jose";
import type { Role } from "@prisma/client";

export const SESSION_COOKIE_NAME = "stockevent_session";

const DEFAULT_DEV_SECRET = "dev-only-stockevent-secret-min-32-chars!!";

export function getJwtSecretKey(): Uint8Array {
  const secret = process.env.AUTH_JWT_SECRET?.trim() || DEFAULT_DEV_SECRET;
  return new TextEncoder().encode(secret);
}

export type VerifiedSession = {
  userId: string;
  organizationId: string;
  role: Role;
  twoFactorVerified: boolean;
};

export async function createSessionToken(
  userId: string,
  organizationId: string,
  role: Role,
  twoFactorVerified = false,
): Promise<string> {
  return new SignJWT({ org: organizationId, role, tfa: twoFactorVerified })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(userId)
    .setIssuedAt()
    .setExpirationTime(process.env.SESSION_MAX_AGE?.trim() || "30m")
    .sign(getJwtSecretKey());
}

export function sessionMaxAgeSeconds(): number {
  const raw = process.env.SESSION_MAX_AGE?.trim() || "30m";
  if (raw.endsWith("m")) return Number.parseInt(raw, 10) * 60;
  if (raw.endsWith("h")) return Number.parseInt(raw, 10) * 3600;
  if (raw.endsWith("d")) return Number.parseInt(raw, 10) * 86400;
  return 1800;
}

export async function verifySessionToken(token: string): Promise<VerifiedSession | null> {
  try {
    const { payload } = await jwtVerify(token, getJwtSecretKey(), {
      algorithms: ["HS256"],
    });
    const sub = payload.sub;
    const org = payload.org as string | undefined;
    const role = payload.role as Role | undefined;
    if (!sub || !org || role === undefined) {
      return null;
    }
    return {
      userId: sub,
      organizationId: org,
      role,
      twoFactorVerified: payload.tfa === true,
    };
  } catch {
    return null;
  }
}
