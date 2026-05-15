export default {
  async fetch(request: Request): Promise<Response> {
    const cache = await caches.open("default");
    const cacheKey = new Request("https://spike-cache-test/value");

    if (request.method === "POST") {
      const value = await request.text();
      await cache.put(cacheKey, new Response(value));
      return Response.json({ value });
    }

    const cached = await cache.match(cacheKey);
    const value = cached ? await cached.text() : null;
    return Response.json({ value });
  }
} satisfies ExportedHandler;
