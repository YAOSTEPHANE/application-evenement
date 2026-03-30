import path from "path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Racine du monorepo (parent de `frontend/`) — évite l’ambiguïté avec plusieurs package-lock.json
  // et aligne le file tracing avec `npm run build --workspace frontend` (Vercel, CI).
  outputFileTracingRoot: path.join(__dirname, ".."),
};

export default nextConfig;
