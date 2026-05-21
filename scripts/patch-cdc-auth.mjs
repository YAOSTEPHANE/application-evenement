import { readFileSync, writeFileSync } from "node:fs";
import { readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(fileURLToPath(new URL(".", import.meta.url)), "..", "frontend", "src", "app", "api", "cdc");

function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) walk(full, out);
    else if (name === "route.ts") out.push(full);
  }
  return out;
}

const importOld = `import { getRequestContext } from "@/lib/request-context";`;
const importNew = `import { ApiAuthError, requireAuthenticatedContext } from "@/lib/api-auth";`;
const catchOld = "  } catch {";
const catchNew = `  } catch (e) {
    if (e instanceof ApiAuthError) {
      return NextResponse.json({ message: e.message }, { status: e.status });
    }`;

let n = 0;
for (const file of walk(root)) {
  let c = readFileSync(file, "utf8");
  if (!c.includes("getRequestContext")) continue;
  c = c.replace(importOld, importNew);
  c = c.replaceAll("getRequestContext()", "requireAuthenticatedContext()");
  if (c.includes(catchOld)) {
    c = c.replace(catchOld, catchNew);
  }
  writeFileSync(file, c);
  n += 1;
}
console.log(`Patched ${n} CDC route files`);
