/**
 * Réinitialise installCommand sur le projet Vercel (null = suit vercel.json à la racine).
 *
 * 1) Crée un token : https://vercel.com/account/tokens
 * 2) PowerShell :
 *    $env:VERCEL_TOKEN="votre_token"
 *    $env:VERCEL_PROJECT="nom-du-projet-sur-vercel"
 *    # optionnel (équipe) :
 *    $env:VERCEL_TEAM_ID="team_xxx"
 *    node scripts/reset-vercel-install.mjs
 */

const token = process.env.VERCEL_TOKEN;
const project = process.env.VERCEL_PROJECT ?? process.argv[2];
const teamId = process.env.VERCEL_TEAM_ID;

if (!token || !project) {
  console.error(
    "Variables requises : VERCEL_TOKEN et VERCEL_PROJECT (ou passer le nom en argument).\n" +
      "Exemple : VERCEL_TOKEN=... VERCEL_PROJECT=mon-app node scripts/reset-vercel-install.mjs",
  );
  process.exit(1);
}

const url = new URL(`https://api.vercel.com/v9/projects/${encodeURIComponent(project)}`);
if (teamId) url.searchParams.set("teamId", teamId);

const res = await fetch(url, {
  method: "PATCH",
  headers: {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
  },
  body: JSON.stringify({ installCommand: null }),
});

const text = await res.text();
if (!res.ok) {
  console.error(res.status, text);
  process.exit(1);
}
console.log("OK — installCommand réinitialisé (Vercel utilisera vercel.json).");
console.log(text);
