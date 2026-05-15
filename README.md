# cloudflare-spike

Throwaway spike repository. Proof of concept for deploying to the Cloudflare deployment stack. Archive when the questions below are answered.

## What this is

A trivially simple app, built only to exercise every integration point. The goal is to make a real, evidence-based decision on **compute model** (Worker vs Pages Functions) and **storage** (which primitives are usable on the free tier).

### Packages

Component | Purpose
--- | ---
`packages/shared` | Exports `greet(name: string): string` - returns `"Hello, {name}!"`. Consumed by both the Worker and the Pages Function to prove workspace imports through two different bundlers.
`packages/worker` | Baseline Cloudflare Worker. Hosts `GET /` returning `greet("world")` and the deployed git SHA.
`packages/worker-do` | Durable Object worker. `GET /` writes and reads back a SQLite-backed visit counter.
`packages/worker-kv` | KV worker. `GET /` writes a timestamp to KV and reads it back.
`packages/worker-d1` | D1 worker. `GET /` inserts a row and reads the latest back.
`packages/worker-r2` | R2 worker. Scaffolded but not deployed - R2 requires a subscription opt-in before any access is possible. The `deploy` script is absent from this package so it is skipped by the recursive deploy. See Q1 findings.
`packages/worker-cache` | Cache API worker. `GET /` stores a value in the edge cache and reads it back.
`packages/worker-queues` | Queues worker. `POST /` enqueues the request body. The `queue` export handler consumes each batch and acknowledges messages. Consumption is async - verified via `wrangler tail`.
`packages/worker-workflows` | Workflows worker. `POST /` creates a new Workflow instance (2 steps + 3s sleep). `GET /?id=<id>` returns instance status and output.
`packages/client` | Cloudflare Pages site. Static HTML page that calls all worker endpoints and renders results in a table. Also hosts a Pages Function at `functions/api/index.ts` that mirrors the Worker's `/` for direct comparison.

No framework on the client. One HTML file, vanilla JS.

### Compute models under test

Both deployed, both callable, compared side by side.

Model | Path |
--- | --- | ---
Standalone Worker | `packages/worker` | Full `wrangler.toml`, all storage bindings, hosts the DO
Pages Function | `packages/client/functions/api/index.ts` | Same `greet()` call, same response shape as Worker `/`

### Storage primitives under test

One endpoint per primitive on the Worker. Each does the minimum: write a value, read it back, return both. No schemas, no abstractions.

Primitive | Free tier expectation | Robot-arena candidate use
--- | --- | ---
Durable Object (SQLite-backed) | Free | Per-game-room authoritative state
KV | Free | Slow-changing global config
D1 | Free | Match history, user accounts
R2 | Requires R2 subscription opt-in (free within limits, but not a true free tier - no access without subscribing) | Replays, large blobs
Cache API | Free | Edge response caching
Queues | Free (10K ops/day; 24h message retention on free tier) | Async jobs (viable on free tier at low volume)
Workflows | Free (priced as Workers; 3-day state retention on free tier) | Durable multi-step async jobs

The client fetches all of the above on load and renders a results table.

## Stack

- **Cloudflare Pages** - client (static HTML/JS) + one Pages Function for comparison
- **Cloudflare Worker** - authoritative server with all storage bindings
- **Durable Objects, KV, D1, R2, Cache API, Queues, Workflows** - storage and compute primitives under test (R2 skipped - see Q1 findings)
- **TypeScript** - pinned version, strict mode
- **pnpm workspaces** - monorepo
- **Wrangler** - deployment and IaC
- **`just`** - task runner (`just dev`, `just deploy`, etc.)
- **GitHub Actions** - CI/CD (auto-deploy on push to `main`)

## Findings

Answers to be populated as work progresses. **Answers must be backed by a working deploy, not by reading docs.**

### 1. Storage on the free tier

> Which Cloudflare storage primitives are actually usable on the free tier today, with what limits? Confirmed by deploying each one, writing, and reading back.

Primitive | Works on free tier? | Notable limits | Verdict for robot-arena
--- | --- | --- | ---
Durable Objects (SQLite) | Yes | 1 GB storage, 1M requests/day. Each DO instance is single-threaded and processes one request at a time - appropriate for per-room game state. | Strong candidate for per-game-room authoritative state
KV | Yes | 1 GB storage, 100K reads/day, 1K writes/day. Eventually consistent - reads may lag writes by up to 60s. Not suitable for rapidly-changing state. | Suitable for slow-changing global config only
D1 | Yes | 500 MB per database, 5 GB total across up to 10 databases (free tier). Row inserts and reads confirmed working. | Suitable for match history and user accounts at small scale; viable until a single database approaches 500 MB
R2 | Skipped | Requires an R2 subscription opt-in before any access is possible. The dashboard shows "You will only be charged if you exceed the monthly limits" but the subscription step itself is a barrier. Will verify free-tier behaviour if robot-arena needs blob storage. | Not assessed
Cache API | Yes | Cache is per-datacenter (not global KV). A value written in one edge location is not visible at another. Suitable only for caching responses at the edge, not for sharing state between requests from different locations. | Not suitable for shared game state; useful only for caching static or semi-static responses
Queues | Yes | Free tier: 10,000 ops/day (one message delivery = 3 ops: write + read + delete, so ~3,300 messages/day). Message retention is 24 hours on free tier (non-configurable; 4 days on paid). Confirmed working: POST enqueues, consumer acks. | Viable for async jobs at low volume. 24h retention is a constraint if messages must survive a day of backpressure.
Workflows | Yes | Free tier: included in Workers free allowances (100K requests/day, 10ms CPU/invocation, 1GB storage). State retention is 3 days on free (30 days on paid). Idle time (sleeping, waiting for events) does not count as CPU. Confirmed working: 2-step workflow with sleep completes and returns output. | Viable for durable multi-step async processing. Robot-arena candidate for turn resolution pipelines or background jobs that must not be lost on Worker restart.

### 2. Worker vs Pages Functions

> Both are deployed in this spike. Which should robot-arena use, and why? Compare on: `wrangler.toml` shape, DO/KV/D1/R2 binding ergonomics, local dev story, deploy story, observability (`wrangler tail`), and custom domain routing.

Both are deployed. The Pages Function at `/api/` in `packages/client` returns the same shape as the standalone Worker's `/`, with a KV binding proving storage bindings work in Pages.

Dimension | Standalone Worker | Pages Function
--- | --- | ---
`wrangler.toml` shape | `name`, `main`, `compatibility_date`, top-level `[[kv_namespaces]]` etc. | Same syntax; add `pages_build_output_dir`. Bindings declared identically.
Binding ergonomics | `env.KV`, `env.DB`, etc. typed via `Env` interface | `context.env.KV`, `context.env.DB` etc. via `PagesFunction<Env>` - one extra level of indirection through `context`
Deploy | `wrangler deploy` | `wrangler pages deploy` (project must be pre-created)
DO hosting | Workers export DO classes - the DO namespace is bound to the Worker that declares the class | Pages Functions cannot export DO classes. A Worker is required wherever a DO class is defined. Pages Functions can hold a DO binding and call into the DO, but cannot own the namespace.
D1, KV, R2, Queues, Workflows | Fully supported via bindings | Fully supported via bindings - no restriction
Observability | `wrangler tail <name>` | `wrangler pages deployment tail <project>` - same data, different command

**Verdict for robot-arena:** a standalone Worker is required only if DO classes are used. If the architecture does not use DOs, all storage primitives (D1, KV, R2, Queues, Workflows) bind equally well to Pages Functions, and Pages alone may be sufficient. The choice between Worker and Pages Functions for server-side logic is an architectural decision separate from this spike.

**Deployment operations note:** Pages has a native GitHub integration that deploys on every push with no GHA workflow required. Cloudflare builds and deploys static assets and Functions directly, and injects `CF_PAGES_COMMIT_SHA` automatically for version tracking. Standalone Workers have no equivalent - they require explicit `wrangler deploy` calls, which means GHA or other CI regardless. If an application's entire backend is in Pages Functions, no GHA workflow is required.

### 3. pnpm workspaces + Wrangler bundling

> Can both the Worker and the Pages Function import from `packages/shared` (workspace-local TypeScript) without a separate publish step? What config makes this work in each bundler?

Confirmed working for the Worker. Not yet tested for the Pages Function bundler (pending Pages work).

`packages/shared/package.json` sets `"main": "./src/index.ts"`, pointing directly at the TypeScript source with no build step. Wrangler uses esbuild internally and resolves the TypeScript source through the pnpm workspace link. The Worker declares `"@spike/shared": "workspace:*"` in its dependencies. No separate compile or publish step is needed.

Confirmed working for the Pages Function (`packages/client/functions/api/index.ts`). The same `"@spike/shared": "workspace:*"` dependency in `packages/client/package.json` is sufficient. The Pages Function bundler (also esbuild via wrangler) resolves and bundles the TypeScript source identically. `greet("world")` appears in both the Worker's `GET /` response and the Pages Function's `GET /api/` response.

### 4. Local dev

> How do you run the client, Worker, Pages Function, and all storage bindings together locally in the devcontainer with hot reload? What commands, what ports, and does the client actually call the local Worker (not the deployed one)?

`just dev` runs `pnpm -r --include-workspace-root run --if-present dev` recursively. Each package's `dev` script is `wrangler dev` (Workers) or `wrangler pages dev public` (client). Running them all simultaneously causes a port conflict on 8976 (wrangler's internal RPC port). Two `wrangler dev` processes cannot share the same port.

The local dev story for this spike is: run one package at a time (`pnpm --filter @spike/worker run dev`). Full-stack local dev with all bindings would require either:

- Port assignment per Worker via `wrangler dev --port <n>`, and a local Pages dev server pointing at local Worker URLs, or
- Wrangler's `--remote` flag to use real Cloudflare resources for bindings while running the Worker logic locally

Neither is configured in this spike. `just dev` is broken for multi-package use as-is. This is a known limitation for robot-arena to resolve before starting local development.

### 5. Wrangler config shape

> What does the actual `wrangler.toml` shape look like? How are resource bindings (KV, D1, DO, Queues, Workflows) declared? Same question for the Pages project.

Worker: single top-level `wrangler.toml` with no env blocks. Bindings declared at top level with real resource IDs. `VERSION` var injected at deploy time via `--var VERSION:$(git describe ...)`. `[vars]` block provides a `dev` fallback for `wrangler dev`.

Pages: same `wrangler.toml` syntax. Add `pages_build_output_dir = "public"` to point at the static assets directory. Bindings (KV, etc.) use the same `[[kv_namespaces]]` block syntax and the same resource IDs as the Worker. No difference in how bindings are declared.

### 6. Secrets

> Confirm `wrangler secret put` works and that GHA can set secrets non-interactively. Even though the spike has no secrets, robot-arena will.

Confirmed working in at path `/secret` on the core worker.

Set it interactively:

```bash
wrangler secret put TEST_SECRET
# prompts: Enter a secret value: ****
```

Or non-interactively (e.g. in GHA)

```bash
echo "$SECRET_VALUE" | wrangler secret put TEST_SECRET
```

Cloudflare's access control is entirely binding-based, so no runtime credentials are required for Cloudflare-native primitives (D1, KV, DO, Queues, Workflows).

### 7. GHA → Cloudflare auth

> What API token scopes are required (covering Workers, Pages, DO, KV, D1, R2)? Where does the token live in GHA?

Token created: **`gentle-bread-36ff`** (Account token, expires **2026-06-14**).

Permission | Value
D1 | Edit
Pages | Edit
Workers CI | Edit
Workers KV Storage | Edit
Workers Observability | Edit
Workers R2 Storage | Edit
Workers Scripts | Edit
Workers Tail | Read
Account Settings | Read
Workers Routes | Edit

Scope is per-org, so one token managed all resource on the account. For a real project, Cloudflare Enterprise is required to create multiple accounts.

For GHA, the token is stored as a repository secret named `CLOUDFLARE_API_TOKEN`. The account ID is stored as `CLOUDFLARE_ACCOUNT_ID`. Both are passed to the deploy job via the workflow `env` block. The deploy step runs `just deploy`, which calls `wrangler deploy`; Wrangler picks up the token automatically from the environment.

### 8. Devcontainer + Wrangler login

> Does Wrangler's OAuth login flow work inside the devcontainer, or is `CLOUDFLARE_API_TOKEN` the only viable path? What's the exact setup?

`wrangler login` does not work in the devcontainer. The OAuth flow calls `xdg-open` to open a browser, which is not available. The process hangs waiting for a browser callback that never arrives.

`CLOUDFLARE_API_TOKEN` is the only viable path. Wrangler reads it directly from the environment and skips the OAuth flow. For local development, export it in `.local.env` (gitignored); `just` picks it up via `set dotenv-load`.

### 9. Custom domains and CORS

> Does the spike use `*.pages.dev` + `*.workers.dev` (requiring CORS on the Worker), or both behind a custom domain via routes? Which approach does robot-arena inherit?

The spike uses a custom domain with both the Pages site and all Workers served under the same origin. The client fetches worker endpoints from the same domain, so no CORS headers are required. No `Access-Control-Allow-Origin` headers are set on any worker.

For robot-arena, the same pattern applies: route both the Pages site and Workers under a single custom domain. CORS is not needed when all client API calls originate from the same origin.

### 10. Cost guardrails

> Is a Cloudflare account spend limit / billing alert configured?

Cloudflare does not offer a billing alert or spend cap on the Workers Free plan. The free plan has no charges, so there is nothing to alert on. Protection comes from hard daily limits: Workers stop serving once the daily request quota is hit.

## Definition of done

- [x] `packages/client` [deployed to Cloudflare Pages](https://cloudflare-spike-client.pages.dev) and publicly accessible
- [x] Workers deployed and callable
- [x] Pages Function (`functions/api/index.ts`) deployed and callable, returning the same shape as the Worker's
- [x] All storage primitives deployed and proven to work (R2 skipped - see Q1)
- [x] `packages/shared` consumed by **both** the Worker and the Pages Function - confirmed by `greet()` output in both responses
- [ ] `just install && just dev` starts the full local stack (client + Worker + Pages Function + all bindings) in the devcontainer
- [x] GHA workflow deploys on push to `main`
- [x] Confirmed that billing alerts are not possible on the free tier
- [x] README contains a clear written answer to all 10 questions above, including the storage matrix
- [ ] Repo archived on completion
