/**
 * Installation Vercel : `npm ci` à la racine du monorepo (lockfile workspaces),
 * puis ensure lightningcss Linux.
 * La racine du dépôt est dérivée de l’emplacement du script (pas `process.cwd()`).
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
    "vercel-install: monorepo ou frontend/package.json introuvable.",
    "repoRoot:",
    repoRoot,
  );
  process.exit(1);
}

execSync("npm ci --include=optional && node scripts/ensure-lightningcss-linux.mjs", {
  cwd: repoRoot,
  stdio: "inherit",
  env: process.env,
});
