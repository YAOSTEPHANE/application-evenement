import { SignJWT, jwtVerify } from "jose";

import { getJwtSecretKey } from "@/lib/session-token";

export const PENDING_2FA_COOKIE = "stockevent_2fa_pending";

export async function createPending2FaToken(userId: string): Promise<string> {
  return new SignJWT({ purpose: "2fa" })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(userId)
    .setIssuedAt()
    .setExpirationTime("5m")
    .sign(getJwtSecretKey());
}

export async function verifyPending2FaToken(token: string): Promise<string | null> {
  try {
    const { payload } = await jwtVerify(token, getJwtSecretKey(), { algorithms: ["HS256"] });
    if (payload.purpose !== "2fa" || !payload.sub) {
      return null;
    }
    return payload.sub;
  } catch {
    return null;
  }
}
