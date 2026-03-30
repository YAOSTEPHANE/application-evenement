/**
 * Installation Vercel : `npm ci` à la racine du monorepo (lockfile workspaces),
 * puis ensure lightningcss Linux.
 * Fonctionne que le CWD soit la racine du dépôt ou `frontend/` (Root Directory Vercel).
 */
import { execSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";

function findMonorepoRoot(start) {
  let dir = resolve(start);
  for (let i = 0; i < 20; i++) {
    const pkgPath = join(dir, "package.json");
    if (existsSync(pkgPath)) {
      try {
        const p = JSON.parse(readFileSync(pkgPath, "utf8"));
        if (
          (Array.isArray(p.workspaces) || typeof p.workspaces === "object") &&
          existsSync(join(dir, "frontend", "package.json"))
        ) {
          return dir;
        }
      } catch {
        /* ignore */
      }
    }
    const parent = dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return null;
}

const root = findMonorepoRoot(process.cwd());
if (!root) {
  console.error(
    "vercel-install: racine du monorepo introuvable (package.json avec workspaces + dossier frontend/).",
  );
  process.exit(1);
}

execSync("npm ci --include=optional && node scripts/ensure-lightningcss-linux.mjs", {
  cwd: root,
  stdio: "inherit",
  env: process.env,
});
