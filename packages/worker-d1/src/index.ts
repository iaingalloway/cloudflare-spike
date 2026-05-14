const CORS = { headers: { "Access-Control-Allow-Origin": "*" } };

interface Env {
  DB: D1Database;
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname === "/") {
      await env.DB.exec(
        "CREATE TABLE IF NOT EXISTS spike_test (id INTEGER PRIMARY KEY AUTOINCREMENT, value TEXT NOT NULL, created_at TEXT NOT NULL)"
      );

      if (request.method === "POST") {
        const value = await request.text();
        await env.DB.prepare(
          "INSERT INTO spike_test (value, created_at) VALUES (?, ?)"
        )
          .bind(value, new Date().toISOString())
          .run();
        return Response.json({ value }, CORS);
      }

      const row = await env.DB.prepare(
        "SELECT value FROM spike_test ORDER BY id DESC LIMIT 1"
      ).first<{ value: string }>();
      return Response.json({ value: row?.value ?? null }, CORS);
    }

    return new Response("Not found", { status: 404 });
  }
} satisfies ExportedHandler<Env>;
