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
    // Ne pas réécrire vers la même origine que ce déploiement (404 sur /api/*).
    // VERCEL_URL = URL du déploiement courant (preview ou prod).
    if (apiBase) {
      try {
        const apiUrl = new URL(apiBase);
        const apiOrigin = apiUrl.origin;
        const deployOrigin = process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : null;
        const prodOrigin = process.env.VERCEL_PROJECT_PRODUCTION_URL
          ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
          : null;
        const sameAsDeploy =
          (deployOrigin && apiOrigin === new URL(deployOrigin).origin) ||
          (prodOrigin && apiOrigin === new URL(prodOrigin).origin);
        if (!sameAsDeploy) {
          rewrites.push({
            source: "/api/:path*",
            destination: `${apiOrigin}/api/:path*`,
          });
        }
      } catch {
        // URL invalide : on garde uniquement la rewrite favicon.
      }
    }

    return rewrites;
  },
  // Binaires natifs Tailwind 4 / lightningcss : ne pas les bundler via le hook require de Next.
  serverExternalPackages: [
    "@prisma/client",
    "prisma",
    "@tailwindcss/postcss",
    "@tailwindcss/node",
    "@tailwindcss/oxide",
    "lightningcss",
  ],
};

export default nextConfig;
