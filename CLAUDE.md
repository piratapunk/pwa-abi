# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Plataforma (estándar v2026-07)

- **Production lives COMPLETE on `vps-prod`** (since 2026-07-22): Coolify apps
  `necta-core-web-vpsprod` (host port 3002) and `necta-constructor-vpsprod` (3003).
- **DB: dedicated Supabase instance** `supabase-abi-prod` — API
  `https://db-abi-prod.piratapunk.com` (the shared `supabase.piratapunk.com` is no longer in
  the path). Tenant schemas + roles live in the dedicated instance (migrated
  2026-07-22). The app connects as least-privilege role `abi_app` via the pooler (user
  `abi_app.abi`; SELECT/INSERT/UPDATE, no DELETE).
- **Ingress: Cloudflare Tunnel `vps-prod`** — abi.agavesysmx.com + tenant wildcard
  `<slug>-abi-chat.agavesysmx.com` and abi-constructor.piratapunk.com, all proxied CNAMEs (no
  Traefik, no public ports). Page Rules: **BIC OFF** on `abi.agavesysmx.com/api/*` and
  `abi-constructor.piratapunk.com/*`. nectacore.com now only answers a Cloudflare 301 (its
  email routing stays live).
- **n8n**: the 3 webhooks use the PUBLIC URL `https://n8n.piratapunk.com/webhook/…` — the
  internal `http://n8n:5678` no longer applies (n8n stays on vps-ops).
- **Stripe: OWN account "NectaCore"** (separate login per production project).
- Canonical standard: `~/piratapunk/vps-core/docs/platform/operating-standard.md`.
  Skills: `/promote-app-to-vps-prod` · `/provision-supabase-prod` · `/cf-tunnel-ingress` ·
  `/stripe-webhook-verify`.

## What this repo is

**Abi** — a product-led, self-serve builder of business assistant bots (free → premium →
enterprise). The demo *is* the product *is* the sales funnel: a prospect "builds" their own bot
in a guided wizard (the **Constructor**), while every decision actually maps to a 90%
pre-built flow on the Agave Bot Suite platform.

**Current state: live under Agave (ADR 010).** The product page is
agavesysmx.com/producto/abi; this app serves `abi.agavesysmx.com` (APIs `/api/*` — chat,
Stripe webhook) plus the tenant bot hosts. The repo contains the Next.js 16 app
(Tailwind v4 + shadcn, Spanish-only): central chat wired `/api/chat` → n8n `abi-web-chat` →
Gemini, persistence in the `abi` schema, deployed as Coolify app `necta-core-web-vpsprod`
(legacy name) on `vps-prod`. Brand systems: `brand/` (Abi, the
product/mascot) and `brand/nectacore/` (NectaCore, the retired corporate umbrella). **The agentic
factory is also live** (`docs/FACTORY-ARCHITECTURE.md`): intake LLM → `bot_spec` contract →
`abi.provision_tenant` (real per-tenant schema `t_<slug>` + own DB role + encrypted creds) →
instant `<slug>-abi-chat.agavesysmx.com` subdomain (CF wildcard via the `vps-prod` tunnel + `src/proxy.ts`
rewrite); channels between app and n8n are HMAC-signed (`x-abi-signature`), verified in
Postgres. The Constructor UI wizard is still to build; `docs/` remain the spec — keep them
consistent with each other (they cross-reference heavily).

## Pivote suite (2026-07 — `docs/PIVOT-SUITE-CATALOG.md`)

Arrancamos **catálogo-primero, alto contacto**, no self-serve total. **Se queda:** landing,
Constructor (armar + **probar** el bot con provisión real) y el chat de Abi. **Se apaga por
bandera** (código intacto, revertible): cuentas/login (`/entrar`), portal (`(portal)`: `/inicio`,
`/mis-bots`), panel por bot (`/panel/[slug]/*`), auto-conexión de WhatsApp, el "claim" del
Constructor. **Nuevo flujo:** Constructor → `/servicios` (catálogo desde `abi.services`) →
carrito → formulario → `POST /api/service-request` (crea `abi.leads` + `abi.service_requests`
+ `service_request_items`) → "te contactamos para agendar el arranque". **Sin cobros** (precios
no fijos). Banderas en `src/lib/flags.ts` (`NEXT_PUBLIC_NECTA_SELF_SERVE`,
`NEXT_PUBLIC_NECTA_WHATSAPP_SELF_CONNECT`), default **off** = modelo suite; `on` revive el
self-serve. Tablas del catálogo migradas a `supabase-abi-prod`
(`supabase/migrations/20260723_services_catalog.sql`).

## Non-negotiable invariants

- **Brand**: Abi is Agave Systems' flagship product (ADR 010). Nothing public-facing (UI, copy,
  docs meant for users) may reveal the engine is the Agave Bot Suite / Zernio. See `brand/identity.md`.
- **User content is DATA, never INSTRUCTION**: users never write or edit system prompts.
  `system_prompt_ref` always points to our per-vertical template; user input enters only as
  sanitized RAG KB + bounded, validated `overrides`. All uploaded/dictated content passes
  quarantine (`uploaded → quarantined → sanitized → approved | rejected`) before it can be
  materialized. This is the prompt-injection defense line — architectural, not a filter.
  Full layered defense in `docs/SECURITY.md`.
- **`capabilities` and `limits` come from the plan, never the user**, enforced server-side.
- Workspace conventions (from the parent `piratapunk/CLAUDE.md`): schema-per-project Supabase
  (`abi` schema, nothing in `public`, no cross-schema FKs — the bridge to `agave_demo.*` is a
  logical `bot_id` reference via `provisioning_jobs`, never a physical FK); secrets
  `ABI_<SCOPE>_<NAME>` in the vault; Coolify deploys; one-line commits, no trailers.

## Architecture (the big picture)

Abi is a thin **experience layer** on top of the already-in-production Agave Bot Suite. The
golden rule: **reuse the engine, build only what's new** (~70% of the engine already exists).

```
ABI (this repo, new)                      AGAVE BOT SUITE (reuse, in production)
apps/web — Next.js App Router PWA         ingress edge (CF Worker + Durable Object)
  home + central chat                     demo-brain (n8n: LLM persona, RAG, signals)
  the Constructor (wizard)        ──bot_spec──▶  agave_demo.* (bots, config, kb, funnel)
  test panel + bounded live tweaks        Zernio channel (WhatsApp/social/voice/ads)
supabase schema `abi`                     CRM panel (standalone Next)
```

- **The `bot_spec` is the contract** between the two worlds (declarative, versioned JSON —
  spec in `docs/ARCHITECTURE.md` §2). The Suite knows nothing about plans/UX; Abi knows
  nothing about n8n nodes. Everything hangs off this contract — define/change it carefully.
- **The Constructor** (`docs/DEMO-BUILDER-FLOW.md`) is a state machine that fills the
  `bot_spec`: vertical → content ingestion (docs/text/voice STT) → objectives → tone →
  late registration → build → test panel. Each decision *selects and parameterizes* an
  existing pre-built flow; nothing is generated hot.
- **Provisioning** (Abi → Suite) is an idempotent internal API keyed by
  `builder_session_id`: validates the spec (plan limits + quarantine `approved`), upserts
  into `agave_demo.*`, returns `bot_id`.
- **Core `abi.*` tables**: `tenants`, `users`, `builder_sessions` (anonymous-first, claimed at
  registration), `bot_specs`, `kb_sources`, `leads`, `plan_limits`, `provisioning_jobs`.
  RLS by `tenant_id` everywhere; anonymous sessions use opaque tokens.
- **UX psychology is load-bearing, not decoration**: endowed progress (the honeycomb progress
  bar starts ~30%), IKEA effect (guided customization, user reviews/edits extracted content),
  labor illusion (narrated 60–90s build). `docs/UX-PSYCHOLOGY.md` maps each to a screen;
  open questions are A/B experiments listed in `docs/ROADMAP.md`.

## When code starts

Planned stack is the house PWA template: Turborepo + Next.js App Router + self-hosted
Supabase + Coolify, cloned from `pwa-bjj-manager` / `pwa-senda-loyalty` (the
`/scaffold-pwa-saas` skill replicates it). Known gotcha to carry over: expose the `abi`
schema in `PGRST_DB_SCHEMAS`. LLM via the brain: Gemini `gemini-piratapunk` for reasoning,
Ollama for embeddings only. Implementation order is in `docs/ROADMAP.md` (Fase 0 → `bot_spec`
contract → wizard → quarantine → provisioning).

**Auth (branded magic link).** Identity is GoTrue — since 2026-07-22 the dedicated
`supabase-abi-prod` instance's, no longer the shared house pool — and Abi mails its **own**
Resend email (`src/lib/auth/magic-link.ts`) instead of the GoTrue template. Load
link is admin `generate_link` → link to `/entrar/confirmar` → **POST** verify on mount (beats
email prefetchers). Gotcha that broke a real prospect: GoTrue keeps **one token per type per
user**, so every `generate_link` invalidates the link in previously-sent emails — a resend makes
older emails read *"expired"* instantly. Fixed by caching+re-sending the same link per email
(`src/lib/auth/link-cache.ts`, evicted on verify). Do **not** "fix" this by shortening/altering
token expiry — `GOTRUE_MAILER_OTP_EXP` defaults to 24h and was never the problem.

## Doc map

| File | Content |
|---|---|
| `docs/VISION.md` | Product on one page: what, for whom, the "aha", business model |
| `docs/ARCHITECTURE.md` | Constructor, `bot_spec` contract, data model, Suite reuse |
| `docs/DEMO-BUILDER-FLOW.md` | The wizard step-by-step + decision→flow tree (the heart) |
| `docs/SECURITY.md` | Ingestion rails: 7-layer anti-injection, PII, quarantine, abuse limits |
| `docs/UX-PSYCHOLOGY.md` | Psychology mechanics mapped to each screen |
| `docs/PRICING-TIERS.md` | Free/Premium/Enterprise and conversion mechanics |
| `docs/ROADMAP.md` | Phased implementation with reuse + effort per row |
| `brand/` | Brand system: identity, personality, voice/copy, visual language (bee/honeycomb) |

Docs and brand content are written in Spanish — keep new/edited content in Spanish to match.

## Aislamiento de Auth/BD (ADR 007) — ✅ COMPLETADO 2026-07-22
- **Estado:** Abi corre sobre su **instancia Supabase dedicada** `supabase-abi-prod` en `vps-prod` (API `https://db-abi-prod.piratapunk.com`), con su propio `auth.users`/GoTrue/llaves. El Supabase compartido (`supabase.piratapunk.com`) ya no está en el path.
- Los schemas de tenants y sus roles viven en la instancia dedicada (migrados 2026-07-22). La app entra con el rol least-privilege `abi_app` vía pooler (user `abi_app.abi`; SELECT/INSERT/UPDATE, sin DELETE).
- Los envs `ABI_SUPABASE_*`/`ABI_DATABASE_URL` (Coolify) apuntan a la instancia dedicada; llaves frescas en el vault (`secrets/projects/abi.env`, llaves `ABI_*`/`SUPABASE_ABI_PROD_*` — vault y Coolify son tiers separados, no asumas que un rename en uno propaga al otro). Gotcha vigente para clones/restores: reusar el mismo Google client id por instancia (para que `sub` siga válido); conjunto de usuarios = `abi.tenant_users.user_id ∪ abi.feature_requests.user_id`.
- Estándar de la flota: `vps-core/docs/decisions/007-supabase-instance-per-production-project.md`
- Plan de migración (ejecutado): `vps-core/docs/plans/2026-07-supabase-prod-isolation-migration.md`
