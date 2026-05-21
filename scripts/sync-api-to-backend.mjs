#!/usr/bin/env node
/**
 * Copie les routes API frontend vers backend (parité dev:backend séparé).
 * Usage: node scripts/sync-api-to-backend.mjs
 */
import { cpSync, existsSync, mkdirSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";

const root = new URL("..", import.meta.url).pathname.replace(/^\/([A-Z]:)/, "$1");
const srcRoot = join(root, "frontend", "src", "app", "api");
const dstRoot = join(root, "backend", "src", "app", "api");

function walk(dir, files = []) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, files);
    else if (name === "route.ts") files.push(p);
  }
  return files;
}

let n = 0;
for (const file of walk(srcRoot)) {
  const rel = relative(srcRoot, file);
  const dst = join(dstRoot, rel);
  mkdirSync(join(dst, ".."), { recursive: true });
  cpSync(file, dst, { force: true });
  n += 1;
}
console.log(`Synchronisé ${n} fichiers route.ts → backend/src/app/api`);
