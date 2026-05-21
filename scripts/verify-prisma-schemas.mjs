/**
 * Vérifie la présence du schéma Prisma source (monolithe : backend partage frontend via workspaces).
 */
import { existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const schema = join(root, "frontend", "prisma", "schema.prisma");

if (!existsSync(schema)) {
  console.error("ERREUR: frontend/prisma/schema.prisma introuvable.");
  process.exit(1);
}

console.log("OK: schéma Prisma présent (frontend/prisma/schema.prisma).");
