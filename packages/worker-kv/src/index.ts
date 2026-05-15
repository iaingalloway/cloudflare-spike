interface Env {
  KV: KVNamespace;
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const key = "spike-test";

    if (request.method === "POST") {
      const value = await request.text();
      await env.KV.put(key, value);
      return Response.json({ value });
    }

    const value = await env.KV.get(key);
    return Response.json({ value });
  }
} satisfies ExportedHandler<Env>;
