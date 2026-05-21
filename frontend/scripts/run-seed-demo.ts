import { readFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { PrismaClient } from "@prisma/client";

import { seedDemoData } from "../src/lib/seed-test-data";

const __dirname = dirname(fileURLToPath(import.meta.url));
const frontendRoot = join(__dirname, "..");

function loadEnvFile(filename: string) {
  const path = join(frontendRoot, filename);
  if (!existsSync(path)) {
    return;
  }
  const raw = readFileSync(path, "utf8");
  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) {
      continue;
    }
    const eq = trimmed.indexOf("=");
    if (eq <= 0) {
      continue;
    }
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (process.env[key] === undefined) {
      process.env[key] = value;
    }
  }
}

loadEnvFile(".env");
loadEnvFile(".env.local");

async function main() {
  if (!process.env.DATABASE_URL?.trim()) {
    console.error(
      "DATABASE_URL manquant. Copiez .env.example vers .env.local dans frontend/ et renseignez MongoDB.",
    );
    process.exit(1);
  }

  const prisma = new PrismaClient();
  try {
    const result = await seedDemoData(prisma);
    console.log("\n✓ Données de démo injectées (idempotent — relançable)\n");
    console.log(JSON.stringify(result, null, 2));
    console.log(
      "\nConnexion back-office : admin /",
      result.demoPassword,
      "\nApp mobile terrain : moussa /",
      result.demoPassword,
    );
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
