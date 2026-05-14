import { greet } from "@spike/shared";

interface Env {
  VERSION: string;
  KV: KVNamespace;
}

export const onRequestGet: PagesFunction<Env> = async (context) => {
  const kv = await context.env.KV.get("spike-test");
  return Response.json({
    message: greet("world"),
    version: context.env.VERSION,
    kv
  });
};
