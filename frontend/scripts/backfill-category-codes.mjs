/**
 * Renseigne code / level / active sur les catégories (driver MongoDB brut).
 * Nécessaire quand la base contient encore code:null et que Prisma Client refuse de lire.
 *
 * Usage (depuis frontend/) :
 *   npm run prisma:backfill-categories
 *   npx prisma db push
 */
import { readFileSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";

import { MongoClient, ObjectId } from "mongodb";

const __dirname = dirname(fileURLToPath(import.meta.url));

function loadEnv() {
  const envPath = join(__dirname, "..", ".env");
  try {
    const raw = readFileSync(envPath, "utf8");
    for (const line of raw.split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) {
        continue;
      }
      const eq = trimmed.indexOf("=");
      if (eq <= 0) {
        continue;
      }
      const key = trimmed.slice(0, eq).trim();
      let val = trimmed.slice(eq + 1).trim();
      if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
        val = val.slice(1, -1);
      }
      process.env[key] = val;
    }
  } catch {
    // .env absent
  }
}

function codeSegmentFromSlug(slug) {
  return (
    String(slug || "cat")
      .replace(/-/g, "")
      .replace(/[^a-z0-9]/gi, "")
      .toUpperCase()
      .slice(0, 12) || "CAT"
  );
}

function proposeCode(slug, parentCode) {
  const segment = codeSegmentFromSlug(slug);
  if (!parentCode) {
    return segment;
  }
  return `${parentCode}-${segment}`;
}

function uniqueCode(base, used) {
  let candidate = base;
  let n = 2;
  while (used.has(candidate)) {
    candidate = `${base}-${n}`;
    n += 1;
  }
  used.add(candidate);
  return candidate;
}

function orgKey(orgId) {
  return orgId instanceof ObjectId ? orgId.toHexString() : String(orgId);
}

async function main() {
  loadEnv();
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error("DATABASE_URL manquant dans frontend/.env");
  }

  const client = new MongoClient(url);
  await client.connect();
  const col = client.db().collection("Category");

  const categories = await col.find({}).sort({ organizationId: 1, createdAt: 1 }).toArray();

  if (categories.length === 0) {
    console.log("Aucune catégorie à migrer.");
    await client.close();
    return;
  }

  const byOrg = new Map();
  for (const row of categories) {
    const key = orgKey(row.organizationId);
    const list = byOrg.get(key) ?? [];
    list.push(row);
    byOrg.set(key, list);
  }

  let updated = 0;

  for (const [orgHex, rows] of byOrg) {
    const usedCodes = new Set();
    const byId = new Map(rows.map((r) => [r._id.toHexString(), r]));

    for (const row of rows) {
      if (row.code && String(row.code).trim()) {
        usedCodes.add(String(row.code).toUpperCase());
      }
    }

    for (const row of rows) {
      const slug = row.slug ?? "categorie";
      const needsCode = row.code == null || !String(row.code).trim();
      const parent = row.parentId ? byId.get(row.parentId.toHexString()) : null;
      const parentCode =
        parent?.code && String(parent.code).trim() ? String(parent.code).toUpperCase() : null;

      let nextCode = row.code ? String(row.code).toUpperCase() : null;
      if (needsCode) {
        const base = proposeCode(slug, parentCode);
        nextCode = uniqueCode(base, usedCodes);
      } else {
        usedCodes.add(nextCode);
      }

      let level = typeof row.level === "number" ? row.level : row.parentId ? 1 : 0;
      if (parent && typeof parent.level === "number") {
        level = Math.min(2, parent.level + 1);
      }

      const active = row.active === undefined || row.active === null ? true : Boolean(row.active);

      const patch = {
        code: nextCode,
        level,
        active,
        updatedAt: new Date(),
      };

      const changed =
        row.code !== patch.code || row.level !== patch.level || row.active !== patch.active;

      if (changed) {
        await col.updateOne({ _id: row._id }, { $set: patch });
        updated += 1;
        console.log(`  [${slug}] code=${patch.code} level=${patch.level}`);
      }
    }

    console.log(`Organisation ${orgHex} : ${rows.length} catégorie(s).`);
  }

  await client.close();
  console.log(`\nTerminé. ${updated} enregistrement(s) mis à jour.`);
  console.log("Relancez : npx prisma db push");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
