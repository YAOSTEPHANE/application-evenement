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

const broken = /catch \(e\) \{ if \(e instanceof ApiAuthError\) \{ return NextResponse\.json\(\{ message: e\.message \}, \{ status: e\.status \}\); \}/g;
const fixed = `catch (e) {
    if (e instanceof ApiAuthError) {
      return NextResponse.json({ message: e.message }, { status: e.status });
    }`;

let n = 0;
for (const file of walk(root)) {
  let c = readFileSync(file, "utf8");
  if (!c.includes("catch (e) { if (e instanceof ApiAuthError)")) continue;
  c = c.replace(broken, fixed);
  writeFileSync(file, c);
  n += 1;
}
console.log(`Formatted catch in ${n} files`);
