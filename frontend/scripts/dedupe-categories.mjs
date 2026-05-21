/**
 * Fusionne les catégories en double (même libellé normalisé) et réaffecte les articles.
 *
 * Usage (depuis frontend/) :
 *   npm run prisma:dedupe-categories
 */
import { readFileSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";

import { MongoClient, ObjectId } from "mongodb";

const __dirname = dirname(fileURLToPath(import.meta.url));

/** IDs seed officiels — priorité en cas de doublon. */
const PREFERRED_SLUGS = new Set([
  "mobilier",
  "chaises",
  "napoleon",
  "audiovisuel",
  "micros",
  "vaisselle",
  "decoration",
  "autre",
  "eclairage",
]);

function loadEnv() {
  const envPath = join(__dirname, "..", ".env");
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
}

function normalizeKey(name, slug) {
  const base = (slug || name || "")
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
  return base || "autre";
}

function orgKey(orgId) {
  return orgId instanceof ObjectId ? orgId.toHexString() : String(orgId);
}

function scoreKeeper(row, itemCounts) {
  const slug = (row.slug || "").toLowerCase();
  const items = itemCounts.get(row._id.toHexString()) ?? 0;
  let score = items * 100;
  if (PREFERRED_SLUGS.has(slug)) {
    score += 500;
  }
  if (/^[a-z0-9-]+$/.test(slug)) {
    score += 50;
  }
  if (row.code && !String(row.code).includes("2")) {
    score += 20;
  }
  if (row.description) {
    score += 10;
  }
  if (row.parentId) {
    score += 5;
  }
  return score;
}

async function main() {
  loadEnv();
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error("DATABASE_URL manquant dans frontend/.env");
  }

  const client = new MongoClient(url);
  await client.connect();
  const db = client.db();
  const catCol = db.collection("Category");
  const itemCol = db.collection("Item");

  const categories = await catCol.find({}).toArray();
  const itemAgg = await itemCol
    .aggregate([{ $group: { _id: "$categoryId", count: { $sum: 1 } } }])
    .toArray();
  const itemCounts = new Map(itemAgg.map((r) => [r._id?.toHexString?.() ?? String(r._id), r.count]));

  const byOrg = new Map();
  for (const row of categories) {
    const o = orgKey(row.organizationId);
    const list = byOrg.get(o) ?? [];
    list.push(row);
    byOrg.set(o, list);
  }

  let merged = 0;
  let deleted = 0;

  for (const [orgHex, rows] of byOrg) {
    const groups = new Map();
    for (const row of rows) {
      const key = normalizeKey(row.name, row.slug);
      const list = groups.get(key) ?? [];
      list.push(row);
      groups.set(key, list);
    }

    const idRemap = new Map();

    for (const [key, group] of groups) {
      if (group.length <= 1) {
        continue;
      }

      const sorted = [...group].sort(
        (a, b) => scoreKeeper(b, itemCounts) - scoreKeeper(a, itemCounts),
      );
      const keeper = sorted[0];
      const dupes = sorted.slice(1);

      console.log(
        `\n[${orgHex}] Doublon « ${key} » → garde « ${keeper.name} » (${keeper.slug}, ${keeper.code})`,
      );

      for (const dup of dupes) {
        const dupId = dup._id.toHexString();
        const keepId = keeper._id.toHexString();
        idRemap.set(dupId, keeper._id);

        const itemRes = await itemCol.updateMany(
          { categoryId: dup._id },
          { $set: { categoryId: keeper._id, updatedAt: new Date() } },
        );
        if (itemRes.modifiedCount > 0) {
          console.log(`  · ${itemRes.modifiedCount} article(s) déplacé(s) depuis « ${dup.name} »`);
          merged += itemRes.modifiedCount;
        }

        const childRes = await catCol.updateMany(
          { parentId: dup._id },
          { $set: { parentId: keeper._id, updatedAt: new Date() } },
        );
        if (childRes.modifiedCount > 0) {
          console.log(`  · ${childRes.modifiedCount} sous-catégorie(s) rattachée(s)`);
        }

        await catCol.deleteOne({ _id: dup._id });
        console.log(`  · supprimé « ${dup.name} » (${dup.slug}, ${dup.code})`);
        deleted += 1;
      }
    }

    if (idRemap.size > 0) {
      for (const row of await catCol.find({ organizationId: rows[0].organizationId }).toArray()) {
        if (row.parentId) {
          const parentHex = row.parentId.toHexString();
          if (idRemap.has(parentHex)) {
            await catCol.updateOne(
              { _id: row._id },
              { $set: { parentId: idRemap.get(parentHex), updatedAt: new Date() } },
            );
          }
        }
      }
    }
  }

  await client.close();
  console.log(`\nTerminé : ${deleted} catégorie(s) supprimée(s), ${merged} article(s) réaffecté(s).`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
