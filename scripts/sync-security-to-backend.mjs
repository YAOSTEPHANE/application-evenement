/**
 * Copie les fichiers sécurité / auth partagés frontend → backend.
 */
import { cpSync, existsSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const fe = join(root, "frontend", "src");
const be = join(root, "backend", "src");

/** proxy.ts backend = lien symbolique vers frontend — ne pas copier. */
const libFiles = [
  "lib/env-runtime.ts",
  "lib/api-auth.ts",
  "lib/api-idempotency.ts",
  "lib/api-route-helpers.ts",
  "lib/session-token.ts",
  "lib/request-context.ts",
  "lib/require-sensitive-auth.ts",
];

for (const rel of libFiles) {
  const from = join(fe, rel);
  const to = join(be, rel);
  const parent = dirname(to);
  if (!existsSync(parent)) mkdirSync(parent, { recursive: true });
  cpSync(from, to);
  console.log("→", rel);
}

console.log("Sécurité synchronisée vers backend");
