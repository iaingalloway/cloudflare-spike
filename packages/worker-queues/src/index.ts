export interface Env {
  QUEUE: Queue<string>;
  VERSION: string;
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    if (request.method === "POST") {
      const body = await request.text();
      await env.QUEUE.send(body);
      return Response.json({ enqueued: true, body, version: env.VERSION });
    }
    return Response.json({
      note: "POST a body to enqueue a message. Consumer logs each received message.",
      version: env.VERSION
    });
  },

  async queue(batch: MessageBatch<string>, _env: Env): Promise<void> {
    for (const message of batch.messages) {
      console.log("queue consumer received:", message.body);
      message.ack();
    }
  }
};
