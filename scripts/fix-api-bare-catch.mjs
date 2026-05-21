import { readFileSync, writeFileSync } from "node:fs";
import { readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const apiRoot = join(fileURLToPath(new URL(".", import.meta.url)), "..", "frontend", "src", "app", "api");

function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) walk(full, out);
    else if (name === "route.ts") out.push(full);
  }
  return out;
}

const authBlock = `    if (error instanceof ApiAuthError) {
      return NextResponse.json({ message: error.message }, { status: error.status });
    }
`;

let n = 0;
for (const file of walk(apiRoot)) {
  let c = readFileSync(file, "utf8");
  if (!c.includes("} catch {")) continue;
  if (!c.includes("ApiAuthError")) {
    c = `import { ApiAuthError, requireAuthenticatedContext } from "@/lib/api-auth";\n${c}`;
  }
  c = c.replaceAll("} catch {", `} catch (error) {\n${authBlock}`);
  writeFileSync(file, c);
  n += 1;
}
console.log(`Fixed bare catch in ${n} files`);
