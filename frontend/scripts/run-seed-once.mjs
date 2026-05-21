/**
 * Injecte les données de démo (catalogue, événements, RFID, bons, RH, terrain).
 * Usage (depuis frontend/) : npm run seed
 */
import { spawnSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const frontendRoot = join(__dirname, "..");

const r = spawnSync("npx", ["tsx", "scripts/run-seed-demo.ts"], {
  cwd: frontendRoot,
  stdio: "inherit",
  shell: true,
});

process.exit(r.status ?? 1);
