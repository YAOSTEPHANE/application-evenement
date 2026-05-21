/**
 * Réparation ponctuelle : remplace un </ModalRoot> intempestif (milieu de modale)
 * par </div>, en ne gardant qu’une fermeture </ModalRoot> finale.
 * Ne pas exécuter sur des fichiers déjà corrects.
 */
import fs from "node:fs";
import path from "node:path";

const componentsDir = path.join(process.cwd(), "src", "components");

function walk(dir) {
  const out = [];
  for (const name of fs.readdirSync(dir)) {
    const p = path.join(dir, name);
    const st = fs.statSync(p);
    if (st.isDirectory()) out.push(...walk(p));
    else if (name.endsWith(".tsx")) out.push(p);
  }
  return out;
}

for (const file of walk(componentsDir)) {
  let src = fs.readFileSync(file, "utf8");
  if (!src.includes("<ModalRoot")) continue;

  const closes = [...src.matchAll(/<\/ModalRoot>/g)];
  if (closes.length <= 1) continue;

  const last = closes[closes.length - 1];
  let idx = 0;
  src = src.replace(/<\/ModalRoot>/g, () => {
    const isLast = idx === closes.length - 1;
    idx += 1;
    return isLast ? "</ModalRoot>" : "</div>";
  });

  fs.writeFileSync(file, src);
  console.log("fixed", path.relative(componentsDir, file), `(${closes.length} -> 1 close)`);
}
