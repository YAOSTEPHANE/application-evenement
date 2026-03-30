/**
 * Après `npm ci`, npm peut omettre les optionnels Linux si le lockfile vient d’un autre OS.
 * Sur Vercel (linux x64 glibc), force l’installation du binding natif utilisé par Tailwind 4 / lightningcss.
 *
 * - CWD = racine du monorepo : `npm install … -w frontend`
 * - CWD = dossier `frontend` seul : `npm install …` (sans `-w`)
 */
import { execSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

if (process.platform !== "linux" || process.arch !== "x64") {
  process.exit(0);
}

const cwd = process.cwd();
let pkg = {};
try {
  pkg = JSON.parse(readFileSync(join(cwd, "package.json"), "utf8"));
} catch {
  process.exit(0);
}

const hasChildFrontend = existsSync(join(cwd, "frontend", "package.json"));
const isMonorepoRoot =
  hasChildFrontend &&
  (Array.isArray(pkg.workspaces) || typeof pkg.workspaces === "object");

if (isMonorepoRoot) {
  execSync("npm install lightningcss-linux-x64-gnu@1.32.0 -w frontend --no-save", {
    stdio: "inherit",
    env: process.env,
    cwd,
  });
} else {
  execSync("npm install lightningcss-linux-x64-gnu@1.32.0 --no-save", {
    stdio: "inherit",
    env: process.env,
    cwd,
  });
}
