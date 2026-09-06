# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

@AGENTS.md

## What this is

Controle de Estoque — a stock/inventory control system built around a **Kardex with moving weighted-average cost**. Tracks incoming/outgoing stock movements per product per warehouse (depósito), multi-warehouse, multi-user, with role-based permissions. Stack: Next.js 16 (App Router) + TypeScript + Prisma 7 + PostgreSQL + Auth.js (NextAuth v5 beta). All UI text, code comments, and domain terms are in Brazilian Portuguese.

## Commands

```bash
npm install                    # install deps
docker compose up -d           # start local Postgres (see docker-compose.yml for port/creds)
npx prisma migrate dev         # apply schema migrations (creates a new one if schema changed)
npx prisma generate            # regenerate Prisma Client into src/generated/prisma (needed after schema.prisma changes, or after a fresh clone/install)
npm run db:seed                # (re)seed test users + a default warehouse — see prisma/seed.ts
npm run dev                    # Next.js dev server with Turbopack, http://localhost:3000
npm run build                  # production build (next build — does NOT run prisma generate itself, run it first if schema.prisma changed)
npm run lint                   # eslint (eslint-config-next core-web-vitals + typescript)
npx tsc --noEmit                # type-check only, without eslint — fast way to verify changes compile
npx prisma studio               # visual DB browser
```

There is no test suite/framework configured in this project (no `test` script, no test files).

Prisma is configured via `prisma7.config.ts` (Prisma 7's `defineConfig`, not the older `schema.prisma`-only setup), reading `DATABASE_URL` from `.env`. The generated client lives at `src/generated/prisma` (custom `output` in `schema.prisma`), imported as `@/generated/prisma/client` — **not** the default `@prisma/client` path. `src/lib/db.ts` wraps it with `@prisma/adapter-pg` (driver adapter) and a `globalThis` singleton for dev hot-reload.

## Architecture

### Kardex / moving weighted-average cost engine

The core business logic lives in `src/lib/kardex.ts` and is the most important file to understand before touching stock movements. It exposes three functions — `registrarEntrada`, `registrarSaida`, `registrarTransferencia` — each wrapping a `db.$transaction`. Key invariants:

- **Row locking via `INSERT ... ON CONFLICT DO UPDATE`**: `obterOuCriarEstoqueTravado` atomically creates-or-locks the `produto_estoque` row for a given (produto, depósito) pair inside the transaction, closing the race-condition window that a plain "check then create" would leave open when two users move the same item concurrently.
- **Entradas** (incoming) recompute the moving weighted-average: `novoCustoMedio = (saldoAtual × custoMedioAtual + qtdEntrada × custoUnitarioEntrada) / novaQuantidade`.
- **Saídas** (outgoing) never change `custoMedioAtual` — they debit at whatever the current average cost is, and throw `SaldoInsuficienteError` if requested quantity exceeds available balance.
- **Transferências** between warehouses are two movements (`transferencia_saida` + `transferencia_entrada`) in one transaction, preserving the source's average cost into the destination. The two `produto_estoque` rows are locked in a deterministic order (`.sort()` on the two depósito IDs) specifically to avoid deadlocks between opposite-direction concurrent transfers.
- Every movement writes an immutable snapshot row to `movimentacoes` (`custoMedioApos`, `saldoQuantidadeApos`, `saldoValorApos`) — this is the actual Kardex ledger, queried by `src/app/(app)/kardex/[produtoId]/page.tsx`. `produto_estoque` is just the current-balance cache per (produto, depósito).
- All quantities/costs are Prisma `Decimal` (`Prisma.Decimal`), never plain JS numbers, inside this module — use `.plus/.minus/.times/.dividedBy/.isZero()` etc., not arithmetic operators.

When adding a new movement type or changing cost logic, this file's docstring comments explain the *why*; read them before modifying the math.

### Prisma `Decimal` → display formatting gotcha

Aggregate/query results for `Decimal` columns (`quantidadeSaldo`, `custoMedioAtual`, `valorTotalSaldo`, etc.) come back as `Prisma.Decimal` instances, not numbers. Calling `.toLocaleString(...)` directly on one does **not** produce a locale/currency-formatted string — it silently returns the Decimal's own plain string form (e.g. `"25882.56"` instead of `"R$ 25.882,56"`), with no error. Always convert with `Number(valorDecimal)` before calling `.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })`. See the `formatarMoeda`/`formatarNumero` helpers duplicated in a couple of pages (e.g. `src/app/(app)/estoque/page.tsx`) for the working pattern.

### Auth & authorization

- **Auth.js v5 (beta)** with a `Credentials` provider (email + bcrypt-hashed password against `usuarios.senha_hash`) and JWT sessions. `src/lib/auth.config.ts` holds the provider-agnostic config (no Prisma/bcrypt imports) so it's safe to load in the **Edge Runtime**; `src/lib/auth.ts` adds the actual `Credentials` provider on top for use in server components/actions (Node runtime). `src/proxy.ts` is the middleware — it builds its own lightweight `NextAuth(authConfig)` instance to redirect unauthenticated requests to `/login` and gate `/usuarios` to `admin` only, entirely at the edge.
- `trustHost: true` in `auth.config.ts` is required because the app sits behind Traefik in production (see `docker-stack.soundsystem.yml`) — Traefik is the only ingress, so trusting the forwarded Host header is safe there but is a deliberate, documented exception.
- Role-based checks (not middleware-level, just plain functions) live in `src/lib/permissions.ts`: `podeVerCusto` (admin/estoquista see cost & value figures — the `vendedor` profile never sees margin), `podeGerenciarUsuarios` (admin-only), `podeLancarMovimentacao`. Pages/components call these directly (e.g. to conditionally render cost columns), rather than relying solely on the middleware.

### Route structure (App Router)

- `src/app/(app)/` — the authenticated app shell. `layout.tsx` does a server-side `auth()` redirect-if-unauthenticated, then wraps children in `TopBar` + `BottomNav` (`src/components/app-shell/`) inside a fixed `max-w-[400px]` mobile-first column — this is a phone-oriented UI, not a responsive desktop dashboard.
  - `produtos/`, `fornecedores/`, `clientes/`, `depositos/`, `usuarios/` — CRUD screens for master data, each with `page.tsx` (list) + `actions.ts` (server actions, zod-validated) + a `*-form.tsx` client form shared between "novo" and "editar" (same form component, different `action` passed in and optional `defaultValues`).
  - `movimentacoes/nova/` — the stock-movement entry form; calls into `src/lib/kardex.ts` via its `actions.ts`.
  - `estoque/` — current stock position (balances per produto × depósito), filterable by depósito via a URL search param (`?depositoId=`), driven by a small client component (`src/components/deposito-filter.tsx`) that just pushes router state — no client-side data fetching.
  - `kardex/[produtoId]/` — full movement history (the ledger) for one product.
- List screens that need live text search (`produtos`, `estoque`) use a pattern of: server component fetches everything and maps Prisma rows into a small plain-data shape (formatting `Decimal`s to strings, joining fields), passed as props into a `"use client"` list component (`src/components/produtos-lista.tsx`, `src/components/estoque-lista.tsx`) that holds the search string in local state and filters client-side — no server round-trip per keystroke. Follow this pattern for new searchable lists rather than adding a new fetch-on-type mechanism.
- Server actions follow a consistent shape: a zod `schema`, a `toData(formData)` helper calling `schema.safeParse`, and exported `criarX`/`atualizarX` functions returning `{ erro?: string }` for `useActionState`, calling `revalidatePath` + `redirect` on success.

### UI components

- `src/components/ui/` is a shadcn-style wrapper layer around **`@base-ui/react`** primitives (not Radix) — e.g. `select.tsx` wraps `@base-ui/react/select`, `combobox.tsx` wraps `@base-ui/react/combobox`. When adding a new primitive-backed component, check `node_modules/@base-ui/react/<name>` for the available parts/props before assuming Radix-style APIs; base-ui's `Select` has no built-in text filtering (use `Combobox` instead when a searchable dropdown is needed — it filters by substring against `itemToStringLabel` by default).
- `components.json` configures `shadcn` CLI generation (`style: "base-nova"`, base color `neutral`, icons via `lucide-react`, path aliases matching `tsconfig.json`'s `@/*`).
- Design tokens (colors, radii) are CSS custom properties in `src/app/globals.css`, mapped into Tailwind v4 via `@theme inline`. Brand-specific tokens (`--brand-yellow`, `--brand-green`, `--shell`, `--text-faint`) sit alongside the standard shadcn palette (`--primary`, `--card`, `--muted`, etc.) — prefer the semantic tokens (`primary`, `accent`, `muted-foreground`...) over hardcoding hex values or introducing new ad-hoc colors.

## Deployment

Production runs as a **Docker Swarm** stack (`docker-stack.soundsystem.yml`) behind Traefik with Let's Encrypt, at `soundsystem.felipemendesoficial.cloud`. There is no CI/CD — deploys are manual: `git pull` on the swarm manager, `docker build -t soundsystem_app:latest .`, then `docker service update --force soundsystem_app` (required because the image tag is `:latest` and Swarm won't pick up a rebuilt image under the same tag otherwise). Local dev's `docker-compose.yml` is separate and unrelated to the production stack file.

## Test users (from `prisma/seed.ts`)

| Perfil | Email | Senha |
|---|---|---|
| admin | admin@exemplo.com | admin123 |
| estoquista | estoquista@exemplo.com | estoque123 |
| vendedor | vendedor@exemplo.com | venda123 |

Change these before any real/production use.
