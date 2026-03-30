export default function Home() {
  return (
    <main className="mx-auto max-w-4xl px-6 py-16">
      <h1 className="text-3xl font-bold">StockEvent API</h1>
      <p className="mt-3 text-sm text-neutral-600">
        Backend Next.js + Prisma + MongoDB pour la gestion de stock événementiel.
      </p>

      <section className="mt-8 rounded-lg border border-neutral-200 p-4">
        <h2 className="font-semibold">Endpoints disponibles</h2>
        <ul className="mt-3 space-y-2 text-sm">
          <li>
            <code>GET /api/health</code>
          </li>
          <li>
            <code>GET|POST /api/categories</code>
          </li>
          <li>
            <code>GET|POST /api/items</code>
          </li>
          <li>
            <code>GET|POST /api/events</code>
          </li>
          <li>
            <code>PATCH|DELETE /api/events/:id</code>
          </li>
          <li>
            <code>GET|POST /api/movements</code>
          </li>
          <li>
            <code>GET /api/dashboard</code>
          </li>
          <li>
            <code>GET|POST /api/users</code>
          </li>
          <li>
            <code>PATCH|DELETE /api/users/:id</code>
          </li>
          <li>
            <code>PATCH|DELETE /api/items/:id</code>
          </li>
          <li>
            <code>PATCH|DELETE /api/categories/:id</code>
          </li>
          <li>
            <code>POST /api/setup/seed</code>
          </li>
        </ul>
      </section>
    </main>
  );
}
