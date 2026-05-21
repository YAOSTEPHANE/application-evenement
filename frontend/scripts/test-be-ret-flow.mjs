/**
 * Test flux BE-RET → clôture Soldée
 * Prérequis : serveur sur :3000, seed CDC (npx tsx scripts/seed-cdc-demo.mjs)
 * Usage : npx tsx scripts/test-be-ret-flow.mjs
 */
const base = process.env.API_BASE ?? "http://localhost:3000";
const org = "000000000000000000000001";
const eventId = "000000000000000000000030";
const stock = "000000000000000000000004";
const tech = "000000000000000000000003";
const admin = "000000000000000000000002";

function headers(actor) {
  return {
    "x-organization-id": org,
    "x-actor-id": actor,
    "Content-Type": "application/json",
  };
}

async function json(res) {
  const text = await res.text();
  try {
    return JSON.parse(text);
  } catch {
    return { raw: text };
  }
}

async function main() {
  console.log("1. Vérifier commande IN_PROGRESS");
  let ev = await fetch(`${base}/api/events/${eventId}`, { headers: headers(admin) });
  let event = await json(ev);
  if (event.orderStatus !== "IN_PROGRESS") {
    await fetch(`${base}/api/events/${eventId}`, {
      method: "PATCH",
      headers: headers(admin),
      body: JSON.stringify({ orderStatus: "IN_PROGRESS" }),
    });
    console.log("   → forcé IN_PROGRESS");
  }

  console.log("2. Créer BE-RET");
  const createRes = await fetch(`${base}/api/events/${eventId}/be-ret`, {
    method: "POST",
    headers: headers(stock),
  });
  const created = await json(createRes);
  if (!createRes.ok) {
    console.error("BE-RET échec:", created);
    process.exit(1);
  }
  console.log(`   ${created.documentNumber} (${created.id})`);

  console.log("3. Scan TAG-MOB-0001");
  const scanRes = await fetch(`${base}/api/stock-documents/${created.id}/scan`, {
    method: "POST",
    headers: headers(stock),
    body: JSON.stringify({ tagCodes: ["TAG-MOB-0001"], source: "HANDHELD" }),
  });
  const scanned = await json(scanRes);
  console.log(`   status=${scanned.status} received=${scanned.lines?.[0]?.receivedQty}`);

  console.log("4. Signatures (stock + technicien)");
  for (const actor of [stock, tech]) {
    const signRes = await fetch(`${base}/api/stock-documents/${created.id}/sign`, {
      method: "POST",
      headers: headers(actor),
    });
    const signed = await json(signRes);
    console.log(`   ${actor} → ${signed.status}`);
  }

  console.log("5. Commande après BE-RET");
  ev = await fetch(`${base}/api/events/${eventId}`, { headers: headers(admin) });
  event = await json(ev);
  console.log(`   orderStatus=${event.orderStatus} lifecycle=${event.lifecycle}`);

  if (event.orderStatus === "SETTLED") {
    console.log("\n✓ Flux BE-RET OK — commande soldée");
  } else {
    console.error("\n✗ Commande non soldée — vérifier scan/signatures");
    process.exit(1);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
