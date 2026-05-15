import { greet } from "@spike/shared";

interface Env {
  VERSION: string;
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    return Response.json({ message: greet("world"), version: env.VERSION });
  }
} satisfies ExportedHandler<Env>;
