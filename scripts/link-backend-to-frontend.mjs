/**
 * Supprime les doublons backend/src/lib et backend/src/app/api,
 * puis lie backend/src/app/api → frontend/src/app/api (source unique).
 */
import { existsSync, lstatSync, mkdirSync, rmSync, symlinkSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const frontendApi = join(root, "frontend", "src", "app", "api");
const backendApi = join(root, "backend", "src", "app", "api");
const backendLib = join(root, "backend", "src", "lib");
const backendProxy = join(root, "backend", "src", "proxy.ts");
const frontendProxy = join(root, "frontend", "src", "proxy.ts");

function removePath(path) {
  if (!existsSync(path)) return;
  rmSync(path, { recursive: true, force: true });
}

if (!existsSync(frontendApi)) {
  console.error("link-backend: frontend/src/app/api introuvable");
  process.exit(1);
}

removePath(backendLib);

const apiParent = dirname(backendApi);
if (!existsSync(apiParent)) {
  mkdirSync(apiParent, { recursive: true });
}
removePath(backendApi);

const linkTarget = relative(apiParent, frontendApi);
const linkType = process.platform === "win32" ? "junction" : "dir";
symlinkSync(linkTarget, backendApi, linkType);

removePath(backendProxy);
const proxyTarget = relative(dirname(backendProxy), frontendProxy);
symlinkSync(proxyTarget, backendProxy, "file");

console.log(`backend/src/app/api → ${linkTarget} (${linkType})`);
console.log(`backend/src/proxy.ts → ${proxyTarget} (file)`);
console.log("backend/src/lib supprimé — imports @/lib/* résolus via frontend (tsconfig).");
