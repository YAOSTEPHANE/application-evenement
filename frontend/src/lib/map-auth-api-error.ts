import { Prisma } from "@prisma/client";
import { z } from "zod";

import { hasAuthJwtSecretConfigured } from "@/lib/auth-env";

export type AuthApiErrorBody = {
  message: string;
  code?: string;
};

export function mapAuthApiError(error: unknown): { status: number; body: AuthApiErrorBody } {
  if (error instanceof z.ZodError) {
    return {
      status: 400,
      body: { message: "Requête invalide", code: "validation_error" },
    };
  }

  if (!process.env.DATABASE_URL?.trim()) {
    return {
      status: 503,
      body: {
        message: "DATABASE_URL non configuré sur le serveur.",
        code: "missing_database_url",
      },
    };
  }

  if (
    error instanceof Prisma.PrismaClientInitializationError ||
    error instanceof Prisma.PrismaClientRustPanicError
  ) {
    return {
      status: 503,
      body: {
        message:
          "Base de données inaccessible. Vérifiez DATABASE_URL et l’accès réseau MongoDB Atlas (IP autorisées).",
        code: "db_unavailable",
      },
    };
  }

  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    return {
      status: 503,
      body: { message: "Erreur base de données.", code: error.code },
    };
  }

  if (error instanceof Error) {
    if (
      error.message.includes("AUTH_JWT_SECRET") ||
      error.message.includes("NEXTAUTH_SECRET")
    ) {
      return {
        status: 503,
        body: {
          message: hasAuthJwtSecretConfigured()
            ? "Erreur de configuration JWT."
            : "Secret JWT manquant : définissez AUTH_JWT_SECRET (ou NEXTAUTH_SECRET) sur Vercel.",
          code: "missing_jwt_secret",
        },
      };
    }
  }

  return {
    status: 500,
    body: { message: "Échec de la connexion.", code: "internal_error" },
  };
}
