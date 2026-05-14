import {
  WorkflowEntrypoint,
  WorkflowStep,
  WorkflowEvent
} from "cloudflare:workers";

const CORS = { headers: { "Access-Control-Allow-Origin": "*" } };

export interface Env {
  WORKFLOW: Workflow;
  VERSION: string;
}

interface WorkflowParams {
  body: string;
}

export class SpikeWorkflow extends WorkflowEntrypoint<Env, WorkflowParams> {
  async run(
    event: WorkflowEvent<WorkflowParams>,
    step: WorkflowStep
  ): Promise<string> {
    const echoed = await step.do("echo input", async () => {
      return `received: ${event.payload.body}`;
    });

    await step.sleep("brief pause", "3 seconds");

    const result = await step.do("finalise", async () => {
      return `done: ${echoed}`;
    });

    return result;
  }
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    if (request.method === "POST") {
      const body = await request.text();
      const instance = await env.WORKFLOW.create({ params: { body } });
      return Response.json(
        {
          id: instance.id,
          status: "created",
          version: env.VERSION
        },
        CORS
      );
    }

    const id = url.searchParams.get("id");
    if (id) {
      const instance = await env.WORKFLOW.get(id);
      const status = await instance.status();
      return Response.json({ id, ...status }, CORS);
    }

    return Response.json(
      {
        note: "POST a body to start a workflow instance. GET /?id=<id> to check instance status.",
        version: env.VERSION
      },
      CORS
    );
  }
};
