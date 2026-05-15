# Cloudflare Spike

This repository contains a proof of concept for deploying to the Cloudflare deployment stack.

The goal is to make a real, evidence-based, end-to-end exploration of Cloudflare's **compute model** (Worker vs Pages Functions) and **storage model** - within free tier limits.

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

### 1. Storage on the free tier

> Which Cloudflare storage primitives are available on the free tier? How are they limited?

Primitive | Free tier? | Notable limits | Notes
--- | --- | --- | ---
Durable Objects (SQLite) | Yes | 1 GB storage, 1M requests/day | Strong candidate for authoritative state for transient aggregates
KV | Yes | 1 GB storage, 100K reads/day, 1K writes/day, eventually consistent - reads may lag writes by up to 60s | Not suitable for rapidly-changing state
D1 | Yes | 500 MB per database, 5 GB total across up to 10 databases | Generously sized relational storage
R2 | No | Has free quota, but requires an R2 billing opt-in | Not assessed
Cache API | Yes | Cache is per-datacenter (not global KV) | Not suitable for shared state, but useful for caching responses
Queues | Yes | 10,000 ops/day (one message delivery = 3 ops: write + read + delete, so ~3,300 messages/day), 24h retention | Viable for async jobs at low volume
Workflows | Yes | Counts against Workers quota, 3 days retention | Viable for durable multi-step async processing

### 2. Worker vs Pages Functions

> Which should I use, and why? Compare on: `wrangler.toml` shape, DO/KV/D1/R2 binding ergonomics, local dev story, deploy story, observability (`wrangler tail`), and custom domain routing.

Dimension | Standalone Worker | Pages Function
--- | --- | ---
`wrangler.toml` shape | `name`, `main`, `compatibility_date`, top-level `[[kv_namespaces]]` etc. | Same syntax; add `pages_build_output_dir`. Bindings declared identically.
Binding ergonomics | `env.KV`, `env.DB`, etc. typed via `Env` interface | `context.env.KV`, `context.env.DB` etc. via `PagesFunction<Env>` - one extra level of indirection through `context`
Deploy | `wrangler deploy` | `wrangler pages deploy` (project must be pre-created)
DO hosting | Workers export DO classes - the DO namespace is bound to the Worker that declares the class | Pages Functions can hold a DO binding and call into the DO, but cannot own the namespace.
D1, KV, R2, Queues, Workflows | Fully supported via bindings | Fully supported via bindings
Observability | `wrangler tail <name>` | `wrangler pages deployment tail <project>` - same data, different command

A standalone Worker is required only if DO classes are used. If the architecture does not use DOs, all storage primitives (D1, KV, R2, Queues, Workflows) bind equally well to Pages Functions, and Pages alone may be sufficient.

**Deployment operations note:** Pages has a native GitHub integration. If an application's entire backend is in Pages Functions, no GHA workflow is required.

### 3. pnpm workspaces + Wrangler bundling

> Can both the Worker and the Pages Function import from a shared library without a separate publish step?

Yes.

### 4. Local dev

> How do you run the client, Worker, Pages Function, and all storage bindings together locally in the devcontainer with hot reload? What commands, what ports, and does the client actually call the local Worker (not the deployed one)?

`just dev` runs the whole stack locally via `pnpm -r --include-workspace-root --parallel run --if-present dev`. Each Worker and Pages Function runs in its own process, with its own unique HTTP port and inspector port. It's important to note the `--parallel` flag.

On Cloudflare, the workers are accessed by path. These paths are not routable locally. This could be fixed with a conditional for local developemnt (and CORS), with a reverse proxy, or by using a service binding and calling the Workers via a Function. For simplicity, this is left non-functional locally here.

### 5. Wrangler config shape

> How are resource bindings (KV, D1, DO, Queues, Workflows) declared?

See `wrangler.toml`

### 6. Secrets

> Can secrets be used in the free tier? How does RBAC work?

Confirmed working at `/secret` on the core worker.

Set the secret interactively:

```bash
wrangler secret put TEST_SECRET
# prompts: Enter a secret value: ****
```

Or non-interactively (e.g. in GHA)

```bash
echo "$SECRET_VALUE" | wrangler secret put TEST_SECRET
```

Cloudflare's access control is entirely binding-based, so no runtime credentials are required for Cloudflare-native primitives.

### 7. Developer and CI authentication

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

`wrangler login` does not work in the devcontainer. The OAuth flow calls `xdg-open` to open a browser, which is not available. The process hangs waiting for a browser callback that never arrives. For local development, `just` sources `.local.env` - there's an example at `.local.env.example`.

### 8. Custom domains and CORS

> Do we need CORS to allow the client to call the Worker?

The spike uses a custom domain with both the Pages site and all Workers served under the same origin. The client fetches worker endpoints from the same domain, so no CORS headers are required.

### 9. Cost guardrails

> Is a Cloudflare account spend limit / billing alert configured?

The Workers free plan has quotas that limit spending to zero, so no billing alert is possible.

## Definition of done

- [x] `packages/client` [deployed to Cloudflare Pages](https://cloudflare-spike-client.pages.dev) and publicly accessible
- [x] Workers deployed and callable
- [x] Pages Function (`functions/api/index.ts`) deployed and callable, returning the same shape as the Worker's
- [x] All storage primitives deployed and proven to work (R2 skipped - see Q1)
- [x] `packages/shared` consumed by **both** the Worker and the Pages Function - confirmed by `greet()` output in both responses
- [x] `just install && just dev` starts the full local stack (client + Worker + Pages Function + all bindings) in the devcontainer
- [x] GHA workflow deploys on push to `main`
- [x] Confirmed that billing alerts are not possible on the free tier
- [x] README contains a clear written answer to all 10 questions above, including the storage matrix
