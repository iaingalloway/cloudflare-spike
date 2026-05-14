import { Counter } from "./counter";

interface Env {
  COUNTER: DurableObjectNamespace<Counter>;
}

export { Counter };

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname === "/") {
      const id = env.COUNTER.idFromName("singleton");
      const stub = env.COUNTER.get(id);
      return stub.fetch(request);
    }

    return new Response("Not found", { status: 404 });
  }
} satisfies ExportedHandler<Env>;
