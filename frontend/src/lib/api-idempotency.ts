import { prisma } from "@/lib/prisma";

export const IDEMPOTENCY_HEADER = "idempotency-key";
const MAX_KEY_LENGTH = 160;
const TTL_MS = 7 * 24 * 60 * 60 * 1000;

export type IdempotentResult = {
  status: number;
  body: unknown;
};

export class IdempotencyError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = "IdempotencyError";
  }
}

export function readIdempotencyKey(request: Request): string | null {
  const raw =
    request.headers.get(IDEMPOTENCY_HEADER) ??
    request.headers.get("Idempotency-Key");
  const key = raw?.trim();
  return key && key.length > 0 ? key : null;
}

function compositeKey(scope: string, clientKey: string): string {
  return `${scope}:${clientKey}`;
}

async function purgeExpiredIdempotencyRecords(): Promise<void> {
  await prisma.apiIdempotencyRecord.deleteMany({
    where: { expiresAt: { lt: new Date() } },
  });
}

async function loadCached(
  organizationId: string,
  key: string,
): Promise<IdempotentResult | null> {
  const row = await prisma.apiIdempotencyRecord.findUnique({
    where: { organizationId_key: { organizationId, key } },
  });
  if (!row || row.expiresAt <= new Date()) {
    return null;
  }
  let body: unknown;
  try {
    body = JSON.parse(row.responseBody) as unknown;
  } catch {
    return null;
  }
  return { status: row.statusCode, body };
}

async function storeCached(
  organizationId: string,
  key: string,
  scope: string,
  result: IdempotentResult,
): Promise<void> {
  const expiresAt = new Date(Date.now() + TTL_MS);
  const responseBody = JSON.stringify(result.body);
  try {
    await prisma.apiIdempotencyRecord.create({
      data: {
        organizationId,
        key,
        scope,
        statusCode: result.status,
        responseBody,
        expiresAt,
      },
    });
  } catch {
    const existing = await loadCached(organizationId, key);
    if (existing) {
      return;
    }
    await prisma.apiIdempotencyRecord.upsert({
      where: { organizationId_key: { organizationId, key } },
      create: {
        organizationId,
        key,
        scope,
        statusCode: result.status,
        responseBody,
        expiresAt,
      },
      update: {},
    });
  }
}

/**
 * Si Idempotency-Key est présent, renvoie la réponse en cache ou exécute une seule fois puis persiste.
 */
export async function replayOrRunIdempotent(
  organizationId: string,
  request: Request,
  scope: string,
  run: () => Promise<IdempotentResult>,
): Promise<IdempotentResult> {
  const clientKey = readIdempotencyKey(request);
  if (!clientKey) {
    return run();
  }
  if (clientKey.length > MAX_KEY_LENGTH) {
    throw new IdempotencyError("Clé idempotence trop longue", 400);
  }

  const key = compositeKey(scope, clientKey);
  await purgeExpiredIdempotencyRecords();

  const cached = await loadCached(organizationId, key);
  if (cached) {
    return cached;
  }

  const result = await run();
  await storeCached(organizationId, key, scope, result);
  return result;
}
