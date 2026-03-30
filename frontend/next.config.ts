import path from "path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Les navigateurs demandent /favicon.ico par défaut. Une redirection 302 peut encore apparaître en « 404 »
  // selon l’outil réseau ; une réécriture interne renvoie le SVG avec un 200 sur /favicon.ico.
  async rewrites() {
    const apiBase = process.env.NEXT_PUBLIC_API_BASE_URL?.trim().replace(/\/+$/, "");
    const rewrites: Array<{ source: string; destination: string }> = [
      { source: "/favicon.ico", destination: "/favicon.svg" },
    ];

    // Proxification des appels front->backend pour éviter le Mixed Content en prod.
    // Le navigateur appelle Next en HTTPS, Next relaye vers le backend (même si le backend est en HTTP).
    if (apiBase) {
      try {
        const apiUrl = new URL(apiBase);
        rewrites.push({
          source: "/api/:path*",
          destination: `${apiUrl.origin}/api/:path*`,
        });
      } catch {
        // URL invalide : on garde uniquement la rewrite favicon.
      }
    }

    return rewrites;
  },
  // Racine du monorepo (parent de `frontend/`) — évite l’ambiguïté avec plusieurs package-lock.json
  // et aligne le file tracing avec `npm run build --workspace frontend` (Vercel, CI).
  outputFileTracingRoot: path.join(__dirname, ".."),
  // Binaires natifs Tailwind 4 / lightningcss : ne pas les bundler via le hook require de Next.
  serverExternalPackages: [
    "@tailwindcss/postcss",
    "@tailwindcss/node",
    "@tailwindcss/oxide",
    "lightningcss",
  ],
};

export default nextConfig;
