/**
 * Build Vercel : depuis la racine du dépôt → `npm run build --workspace frontend` ;
 * depuis `frontend/` (Root Directory = frontend) → `npm run build` dans ce dossier.
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

const cwd = process.cwd();
const pkg = JSON.parse(readFileSync(join(cwd, "package.json"), "utf8"));

if (pkg.name === "frontend") {
  execSync("npm run build", { cwd, stdio: "inherit", env: process.env });
} else {
  const root = findMonorepoRoot(cwd);
  if (!root) {
    console.error("vercel-build: racine du monorepo introuvable.");
    process.exit(1);
  }
  execSync("npm run build --workspace frontend", {
    cwd: root,
    stdio: "inherit",
    env: process.env,
  });
}
