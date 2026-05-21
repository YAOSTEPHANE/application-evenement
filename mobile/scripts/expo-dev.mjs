/**
 * Lance Expo en contournant la validation réseau api.expo.dev (bug Node 22+ :
 * « Body has already been read » dans getNativeModuleVersionsAsync / cache undici).
 */
import { spawn } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const mobileRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function clearExpoNativeModulesCache() {
  const cacheDir = path.join(os.homedir(), ".expo", "native-modules-cache");
  try {
    if (fs.existsSync(cacheDir)) {
      fs.rmSync(cacheDir, { recursive: true, force: true });
    }
  } catch {
    /* cache verrouillé ou absent */
  }
}

clearExpoNativeModulesCache();

const env = {
  ...process.env,
  EXPO_NO_DEPENDENCY_VALIDATION: "1",
  /** Évite l'appel getNativeModuleVersionsAsync (source du double-read body). */
  EXPO_OFFLINE: process.env.EXPO_OFFLINE ?? "1",
};

const userArgs = process.argv.slice(2);
const hasPortFlag = userArgs.some((a) => a === "--port" || a.startsWith("--port="));
const defaultPort = process.env.EXPO_DEV_SERVER_PORT ?? "8083";
const startArgs = ["start", "--lan", ...(hasPortFlag ? [] : ["--port", defaultPort]), ...userArgs];

const expoCliJs = path.join(
  mobileRoot,
  "node_modules",
  "expo",
  "node_modules",
  "@expo",
  "cli",
  "build",
  "bin",
  "cli",
);
const useLocalCli = fs.existsSync(expoCliJs);

const childArgs = useLocalCli ? [expoCliJs, ...startArgs] : ["expo", ...startArgs];

const child = spawn(useLocalCli ? process.execPath : "npx", childArgs, {
  cwd: mobileRoot,
  stdio: "inherit",
  env,
  shell: !useLocalCli,
});

child.on("exit", (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }
  process.exit(code ?? 0);
});

child.on("error", (err) => {
  console.error("[expo-dev] Impossible de lancer Expo:", err.message);
  process.exit(1);
});
