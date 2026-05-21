/**
 * Lance les alertes planifiées CDC (cron externe).
 * Usage : CDC_CRON_SECRET=xxx APP_URL=http://localhost:3000 node scripts/run-cdc-alerts.mjs
 */
const base = (process.env.APP_URL ?? "http://localhost:3000").replace(/\/$/, "");
const secret = process.env.CDC_CRON_SECRET ?? "";

if (!secret) {
  console.error("CDC_CRON_SECRET manquant");
  process.exit(1);
}

const res = await fetch(`${base}/api/cdc/alerts/run`, {
  method: "POST",
  headers: { Authorization: `Bearer ${secret}` },
});

const text = await res.text();
console.log(res.status, text);
process.exit(res.ok ? 0 : 1);
