import { DurableObject } from "cloudflare:workers";

export class Counter extends DurableObject {
  async fetch(request: Request): Promise<Response> {
    this.ctx.storage.sql.exec(
      "CREATE TABLE IF NOT EXISTS counter (id INTEGER PRIMARY KEY, count INTEGER NOT NULL)"
    );
    const rows = [
      ...this.ctx.storage.sql.exec<{ count: number }>(
        "SELECT count FROM counter WHERE id = 1"
      )
    ];
    const current = rows[0]?.count ?? 0;

    if (request.method === "POST") {
      const next = current + 1;
      this.ctx.storage.sql.exec(
        "INSERT OR REPLACE INTO counter (id, count) VALUES (1, ?)",
        next
      );
      return Response.json({ count: next });
    }

    return Response.json({ count: current });
  }
}
