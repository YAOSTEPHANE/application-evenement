/**
 * Après `npm ci`, npm peut omettre les optionnels Linux si le lockfile vient d’un autre OS.
 * Sur Vercel (linux x64 glibc), force l’installation du binding natif utilisé par Tailwind 4 / lightningcss.
 */
import { execSync } from "node:child_process";

if (process.platform !== "linux" || process.arch !== "x64") {
  process.exit(0);
}

execSync("npm install lightningcss-linux-x64-gnu@1.32.0 -w frontend --no-save", {
  stdio: "inherit",
  env: process.env,
});
