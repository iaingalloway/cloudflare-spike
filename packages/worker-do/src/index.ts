import { Counter } from "./counter";

interface Env {
  COUNTER: DurableObjectNamespace<Counter>;
}

export { Counter };

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const id = env.COUNTER.idFromName("singleton");
    const stub = env.COUNTER.get(id);
    return stub.fetch(request);
  }
} satisfies ExportedHandler<Env>;
