const CORS = { headers: { "Access-Control-Allow-Origin": "*" } };

export default {
  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname === "/") {
      const cache = await caches.open("default");
      const cacheKey = new Request("https://spike-cache-test/value");

      if (request.method === "POST") {
        const value = await request.text();
        await cache.put(cacheKey, new Response(value));
        return Response.json({ value }, CORS);
      }

      const cached = await cache.match(cacheKey);
      const value = cached ? await cached.text() : null;
      return Response.json({ value }, CORS);
    }

    return new Response("Not found", { status: 404 });
  }
} satisfies ExportedHandler;
