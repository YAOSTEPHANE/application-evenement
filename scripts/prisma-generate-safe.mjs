/**
 * Windows (EPERM) : le moteur Prisma (.dll) est souvent verrouillé par un autre processus Node
 * (next dev, etc.). Fermez ces processus ; le script réessaie si la sortie contient EPERM.
 */
import { spawnSync } from "node:child_process";
import { existsSync, rmSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(scriptDir, "..");
const frontendDir = join(repoRoot, "frontend");

// Client généré dans frontend/.prisma-generated (hors node_modules) pour éviter EPERM Windows.
const prismaCacheDirs = [
  join(frontendDir, ".prisma-generated"),
  join(frontendDir, "node_modules", ".prisma"),
  join(repoRoot, "node_modules", ".prisma"),
];

function sleepSync(seconds) {
  if (process.platform === "win32") {
    spawnSync("powershell", ["-NoProfile", "-Command", `Start-Sleep -Seconds ${seconds}`], {
      stdio: "ignore",
    });
  } else {
    spawnSync("sleep", [String(seconds)], { stdio: "ignore" });
  }
}

for (const dir of prismaCacheDirs) {
  if (existsSync(dir)) {
    try {
      rmSync(dir, { recursive: true, force: true });
      console.log("[prisma-generate-safe] Supprimé:", dir);
    } catch (err) {
      console.warn("[prisma-generate-safe] Impossible de supprimer (fichier verrouillé) :", dir);
      console.warn(String(err?.message ?? err));
      console.warn(
        "→ Arrêtez tous les serveurs (npm run dev), fermez les terminaux Node, puis réessayez.",
      );
    }
  }
}

const maxAttempts = 4;

for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
  const r = spawnSync("npx", ["prisma", "generate"], {
    cwd: frontendDir,
    encoding: "utf-8",
    shell: true,
  });

  if (r.stdout) {
    process.stdout.write(r.stdout);
  }
  if (r.stderr) {
    process.stderr.write(r.stderr);
  }

  const status = r.status ?? 1;
  if (status === 0) {
    process.exit(0);
  }

  const out = `${r.stderr ?? ""}${r.stdout ?? ""}`;
  const isEperm = /EPERM|operation not permitted/i.test(out);

  if (attempt < maxAttempts && isEperm) {
    console.warn(
      `[prisma-generate-safe] Tentative ${attempt}/${maxAttempts} (EPERM). Nouvelle tentative dans 3s…`,
    );
    sleepSync(3);
  } else {
    break;
  }
}

console.error(`
[prisma-generate-safe] Échec de prisma generate.

Sous Windows : fermez tout ce qui utilise ce projet :
  • Tous les "npm run dev" (frontend / backend)
  • Gestionnaire des tâches → terminer "Node.js JavaScript Runtime"
  • Réessayez : npm run prisma:generate --workspace frontend
`);
process.exit(1);
