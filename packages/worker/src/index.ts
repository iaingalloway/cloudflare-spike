import { greet } from "@spike/shared";

interface Env {
  VERSION: string;
  TEST_SECRET: string;
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    if (url.pathname === "/secret") {
      return Response.json({ secret: env.TEST_SECRET });
    }
    return Response.json({ message: greet("world"), version: env.VERSION });
  }
} satisfies ExportedHandler<Env>;
