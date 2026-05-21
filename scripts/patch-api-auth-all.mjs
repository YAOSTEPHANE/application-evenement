/**
 * Remplace getRequestContext par requireAuthenticatedContext sur les routes API protégées.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const apiRoot = join(fileURLToPath(new URL(".", import.meta.url)), "..", "frontend", "src", "app", "api");

const SKIP = new Set([
  "auth/login/route.ts",
  "auth/logout/route.ts",
  "auth/2fa/verify/route.ts",
  "setup/seed/route.ts",
  "cdc/alerts/run/route.ts",
  "health/route.ts",
]);

function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) walk(full, out);
    else if (name === "route.ts") out.push(full);
  }
  return out;
}

function patchImports(content) {
  const ctxImport =
    /import\s*\{([^}]+)\}\s*from\s*"@\/lib\/request-context";/;
  const m = content.match(ctxImport);
  if (!m) return content;

  const names = m[1].split(",").map((s) => s.trim());
  const withoutGet = names.filter((n) => n !== "getRequestContext" && n !== "type RequestContext");
  const hasType = names.some((n) => n.includes("RequestContext"));

  let next = content.replace(ctxImport, "");
  const authParts = ["ApiAuthError", "requireAuthenticatedContext"];
  if (!next.includes('from "@/lib/api-auth"')) {
    next = `import { ${authParts.join(", ")} } from "@/lib/api-auth";\n${next}`;
  } else if (!next.includes("requireAuthenticatedContext")) {
    next = next.replace(
      /import\s*\{([^}]+)\}\s*from\s*"@\/lib\/api-auth";/,
      (_, inner) => {
        const parts = inner.split(",").map((s) => s.trim());
        for (const a of authParts) {
          if (!parts.includes(a)) parts.push(a);
        }
        return `import { ${parts.join(", ")} } from "@/lib/api-auth";`;
      },
    );
  }

  if (hasType || withoutGet.length > 0) {
    const typeOnly = withoutGet.filter((n) => n.startsWith("type "));
    const values = withoutGet.filter((n) => !n.startsWith("type "));
    const chunks = [];
    if (values.length) chunks.push(`import { ${values.join(", ")} } from "@/lib/request-context";`);
    if (typeOnly.length || names.includes("RequestContext")) {
      const types = typeOnly.length ? typeOnly : ["type RequestContext"];
      chunks.push(`import { ${types.join(", ")} } from "@/lib/request-context";`);
    }
    next = `${chunks.join("\n")}\n${next}`;
  }

  return next.replace(/\n{3,}/g, "\n\n");
}

function injectApiAuthCatch(content) {
  if (content.includes("instanceof ApiAuthError")) return content;

  const authBlock = `    if (error instanceof ApiAuthError) {
      return NextResponse.json({ message: error.message }, { status: error.status });
    }
`;

  return content.replace(
    /} catch \((error)\) \{\n/g,
    (match) => `${match}${authBlock}`,
  ).replace(
    /} catch \{\n/g,
    `} catch (error) {\n${authBlock}`,
  );
}

let patched = 0;
for (const file of walk(apiRoot)) {
  const rel = relative(apiRoot, file).replace(/\\/g, "/");
  if (SKIP.has(rel)) continue;

  let c = readFileSync(file, "utf8");
  if (!c.includes("getRequestContext")) continue;

  c = patchImports(c);
  c = c.replaceAll("getRequestContext()", "requireAuthenticatedContext()");
  c = injectApiAuthCatch(c);
  writeFileSync(file, c);
  patched += 1;
  console.log("→", rel);
}
console.log(`\nPatched ${patched} route files.`);
