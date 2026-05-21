import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const assetsDir = path.join(__dirname, "..", "assets");
const png = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
  "base64",
);

fs.mkdirSync(assetsDir, { recursive: true });
for (const name of ["icon.png", "splash-icon.png", "adaptive-icon.png"]) {
  fs.writeFileSync(path.join(assetsDir, name), png);
}
console.log("Assets créés dans mobile/assets/");
