/**
 * Build Vercel : depuis l’emplacement du fichier (pas `process.cwd()`),
 * trouve la racine du monorepo et exécute `npm run build --workspace frontend`.
 */
import { execSync } from "node:child_process";
import { existsSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(scriptDir, "..");
const rootPkg = join(repoRoot, "package.json");
const frontendPkg = join(repoRoot, "frontend", "package.json");

if (!existsSync(rootPkg) || !existsSync(frontendPkg)) {
  console.error(
    "vercel-build: monorepo ou frontend/package.json introuvable.",
    "repoRoot:",
    repoRoot,
  );
  process.exit(1);
}

try {
  execSync("npm run build --workspace frontend", {
    cwd: repoRoot,
    stdio: "inherit",
    env: process.env,
  });
} catch (err) {
  const code = err?.status ?? err?.code;
  console.error(
    "\n[vercel-build] La commande « npm run build --workspace frontend » a échoué",
    code != null ? `(code ${code}).` : ".",
    "Remontez dans les logs Vercel : l’erreur réelle (Prisma, Next, TypeScript) est au-dessus de cette trace Node.\n",
  );
  process.exit(typeof code === "number" ? code : 1);
}
