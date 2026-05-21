import { createHmac, randomBytes } from "crypto";

import { generateSecret, generateURI, verify } from "otplib";

import { roleRequires2Fa } from "@/lib/cdc-labels";
import type { Role } from "@prisma/client";

const ISSUER = process.env.CDC_TOTP_ISSUER?.trim() || "EVENT-RFID";

export function generateTotpSecret(): string {
  return generateSecret();
}

export function buildOtpAuthUri(email: string, secret: string): string {
  return generateURI({ issuer: ISSUER, label: email, secret });
}

export async function verifyTotpCode(secret: string, token: string): Promise<boolean> {
  const result = await verify({ secret, token: token.replace(/\s/g, "") });
  return result.valid;
}

export function roleMustUse2Fa(role: Role, twoFactorEnabled: boolean): boolean {
  if (twoFactorEnabled) return true;
  return process.env.CDC_FORCE_2FA === "true" && roleRequires2Fa(role);
}

/** Empreinte document (intégrité archive) */
export function hashDocumentContent(html: string): string {
  return createHmac("sha256", process.env.AUTH_JWT_SECRET ?? "archive-key")
    .update(html)
    .digest("hex");
}

export function archiveRetentionUntil(from: Date = new Date()): Date {
  const d = new Date(from);
  d.setFullYear(d.getFullYear() + 10);
  return d;
}

export function randomPendingId(): string {
  return randomBytes(16).toString("hex");
}
