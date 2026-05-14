import { greet } from "@spike/shared";

const CORS = { headers: { "Access-Control-Allow-Origin": "*" } };

interface Env {
  VERSION: string;
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname === "/") {
      return Response.json(
        { message: greet("world"), version: env.VERSION },
        CORS
      );
    }

    return new Response("Not found", { status: 404 });
  }
} satisfies ExportedHandler<Env>;
