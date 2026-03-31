import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

/**
 * Sans délais explicites, un cluster injoignable (IP non autorisée sur Atlas, mauvaise URI, etc.)
 * peut faire attendre Prisma très longtemps — le front semble « vide » ou affiche une erreur obscure.
 */
function withMongoDriverTimeouts(url: string | undefined): string | undefined {
  if (!url?.trim()) {
    return url;
  }
  try {
    const u = new URL(url);
    if (!u.searchParams.has("serverSelectionTimeoutMS")) {
      u.searchParams.set("serverSelectionTimeoutMS", "10000");
    }
    if (!u.searchParams.has("connectTimeoutMS")) {
      u.searchParams.set("connectTimeoutMS", "10000");
    }
    return u.toString();
  } catch {
    return url;
  }
}

const databaseUrl = withMongoDriverTimeouts(process.env.DATABASE_URL);
export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: ["error", "warn"],
    ...(databaseUrl
      ? {
          datasources: {
            db: { url: databaseUrl },
          },
        }
      : {}),
  });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
