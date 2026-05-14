const CORS = { headers: { "Access-Control-Allow-Origin": "*" } };

interface Env {
  KV: KVNamespace;
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname === "/") {
      const key = "spike-test";

      if (request.method === "POST") {
        const value = await request.text();
        await env.KV.put(key, value);
        return Response.json({ value }, CORS);
      }

      const value = await env.KV.get(key);
      return Response.json({ value }, CORS);
    }

    return new Response("Not found", { status: 404 });
  }
} satisfies ExportedHandler<Env>;
