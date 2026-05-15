import { greet } from "@spike/shared";

interface Env {
  VERSION: string;
  KV: KVNamespace;
  CF_PAGES_COMMIT_SHA?: string;
}

export const onRequestGet: PagesFunction<Env> = async (context) => {
  const kv = await context.env.KV.get("spike-test");
  return Response.json({
    message: greet("world"),
    version: context.env.CF_PAGES_COMMIT_SHA || context.env.VERSION,
    kv
  });
};
