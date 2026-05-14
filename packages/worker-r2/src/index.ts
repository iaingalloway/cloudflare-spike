interface Env {
  BUCKET: R2Bucket;
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname === "/") {
      const key = "spike-test";

      if (request.method === "POST") {
        const value = await request.text();
        await env.BUCKET.put(key, value);
        return Response.json({ value });
      }

      const obj = await env.BUCKET.get(key);
      const value = obj ? await obj.text() : null;
      return Response.json({ value });
    }

    return new Response("Not found", { status: 404 });
  }
} satisfies ExportedHandler<Env>;
