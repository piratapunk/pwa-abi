# El Factory agéntico — arquitectura implementada

> Estado: **en producción** (2026-07-17). Este doc describe lo construido: el pipeline que
> convierte texto libre de un prospecto en un bot real con **schema propio en la base**,
> **rol propio**, y **subdominio propio** `<slug>-abi-chat.agavesysmx.com` — en segundos y de forma
> idempotente. Complementa `ARCHITECTURE.md` (visión) y `SECURITY.md` (rieles de ingesta).

## 1. El pipeline completo

```
texto libre (chat / form / dictado)
   │  POST /api/factory/intake         [rate limit · zod strict · honeypot]
   ▼
n8n `abi-factory-intake`               [firma HMAC verificada EN POSTGRES]
   │  Gemini extrae → JSON             [el texto del usuario es DATO, no instrucción;
   │  whitelist de claves + clamps      instrucciones embebidas se descartan]
   │  abi.factory_slugify() asigna slug (translitera, reserva www/api/admin/…, desambigua)
   │  draft → abi.bot_specs
   ▼
bot_spec validado (contrato zod `src/lib/factory/spec.ts`)
   │  POST /api/factory/provision      [rate limit 3/h · zod · idempotente]
   ▼
abi.provision_tenant(sesión, spec, master_key)     ← UNA transacción, SECURITY DEFINER
   ├─ abi.tenants (password del rol cifrado pgp_sym_encrypt)
   ├─ CREATE SCHEMA t_<slug>  (bot_config · kb_chunks · conversations · messages · leads)
   ├─ CREATE ROLE t_<slug>_app  → acotado SOLO a su schema (revoke public)
   ├─ bot_config: persona del spec; capabilities/limits DEL PLAN, jamás del usuario
   ├─ KB inicial sanitizada (control chars fuera, 20k cap)
   └─ job `done` con resultado → reintentos devuelven lo mismo
   ▼
https://<slug>-abi-chat.agavesysmx.com [instantáneo: wildcard DNS + Cloudflare Tunnel, sin pasos por tenant]
   │  chat del cliente final
   ▼
n8n `abi-tenant-chat`                  [HMAC verificado en Postgres]
   ├─ abi.tenant_chat_context(slug)    ← contrato: config + KB del schema DEL tenant
   ├─ prompt armado server-side (plantilla nuestra; KB como dato delimitado)
   ├─ Gemini responde SOLO con la info del negocio
   └─ abi.tenant_log_message() ×2      ← todo cae en el schema del tenant
```

## 2. Los contratos (dónde viven)

| Contrato | Dónde | Qué garantiza |
|---|---|---|
| `bot_spec` | `src/lib/factory/spec.ts` (zod, `.strip()`) | forma única de los datos entre intake y provisioning; sin `capabilities`/`limits` (eso lo pone el plan server-side) |
| `abi.provision_tenant(uuid, jsonb, key)` | Postgres, SECURITY DEFINER | provisioning atómico e idempotente; la app solo tiene EXECUTE, cero DDL fuera de la función |
| `abi.tenant_chat_context(slug)` | Postgres | lectura de config+KB del tenant sin SQL dinámico en n8n; slug validado por regex |
| `abi.tenant_log_message(slug, uuid, rol, texto, meta?)` | Postgres | escritura al schema del tenant, misma regla; el `meta` (canal/teléfono/external_id de WhatsApp) alimenta el CRM, hace **captura determinista** (regex tel/email en mensajes del cliente) y devuelve el `mode` de la conversación — si es `human`, el brain se corta (takeover) |
| `abi.tenant_capture_contact(slug, uuid, ...)` | Postgres | upsert de contacto al CRM del tenant (dedupe por teléfono/email, nunca pisa datos existentes) + bitácora en `leads`; lo llaman `tenant_log_message`, los workflows (marcador `<<<lead>>>` del brain, validado como DATO) y la app |
| Contratos del panel CRM (`tenant_contacts_list/get/update/create`, `tenant_pipeline`, `tenant_conversation_set_mode`, `tenant_owner_reply`) | Postgres | ownership vía `user_owns_tenant` en cada llamada; límites acotados server-side (etapas whitelist, ≤20 tags); `tenant_owner_reply` registra `role='owner'`, pasa la plática a `human` y devuelve canal+external_id para el envío real por WhatsApp |
| `abi.factory_slugify(nombre)` | Postgres | slugs únicos, transliterados, lista de reservados (www, api, admin, mcp, …) |
| `abi.factory_verify_hmac(ts, body, sig)` | Postgres | verificación de firmas para n8n — el secreto no sale de la DB (revocada a `abi_app`) |
| `abi.plan_limits` (tabla) | Postgres | **fuente única** de límites por plan (msgs/día, KB chars, archivos, MB crudos, chars extraídos, rag_enabled); `provision_tenant` la lee — cambiar un límite es un UPDATE, no un deploy |
| `abi.claim_tenant(session, user_id)` | Postgres | liga los bots de una builder_session al usuario autenticado (GoTrue); idempotente; el user_id viene de la sesión verificada server-side |
| `abi.user_tenants(user_id)` | Postgres | lista de bots del usuario para `/mis-bots` y el futuro panel |
| `abi.kb_sources` (tabla) | Postgres | **cuarentena de documentos** (`SECURITY.md`): `quarantined → sanitized → approved | rejected`; extracción solo-texto en el servicio (`/extract`, HMAC), sanitización capas 1+3 en la app (`src/lib/factory/sanitize.ts`), preview editable del dueño, y `provision_tenant` materializa SOLO `approved` a `kb_chunks` dentro de los límites del plan |
| Firma de canal | `src/lib/factory/hmac.ts` | header `x-abi-signature: t=<ts>,v1=<hmac>` |

## 3. Modelo de tokens y secretos (lo consultado en tahona, aplicado)

**Principio: el secreto nunca viaja; viaja la firma.**
- App → n8n: HMAC-SHA256 de `<timestamp>.<body>` (estilo Stripe). El receptor recomputa;
  un token robado del tráfico no existe — solo hay firmas de un solo uso práctico
  (**ventana anti-replay de 300 s**) atadas al cuerpo exacto.
- Verificación con `timingSafeEqual` (app) y comparación en Postgres (n8n) — el
  secreto HMAC vive en `abi.factory_secrets`, tabla **revocada** para `abi_app`
  y sin exposición PostgREST; solo el service role de n8n la lee.
- Credencial DB de cada tenant: generada dentro de Postgres (`gen_random_bytes`),
  guardada **solo cifrada** (`pgp_sym_encrypt`) con la `ABI_FACTORY_MASTER_KEY`,
  que vive únicamente en el entorno del servidor (Coolify env / vault) y se pasa
  por parámetro en la conexión interna — jamás se persiste en claro ni se responde.
- Canales: TLS de borde (Cloudflare) + túnel cifrado `vps-prod` al origen (cero puertos
  públicos, sin Traefik en el path — ADR 009); el tramo app↔DB va por la red privada de
  docker del host (mismo perímetro que el resto de la plataforma).
- Hallazgos tahona aplicados: validar SIEMPRE `exp/iss/aud/scope` si un día emitimos
  JWTs (hoy no emitimos ninguno hacia el cliente — sesiones opacas en sessionStorage);
  jamás confiar claims del cliente; defensa anti-inyección por capas; sanitización
  antes de almacenar.

**Qué NO hay a propósito:** tokens de portador estáticos en requests, credenciales en
la URL, secretos en git, secretos en el JSON de workflows n8n.

## 4. Multi-tenancy real (no inyección temporal)

Cada cliente obtiene **de verdad**:
- Un **schema Postgres propio** `t_<slug>` con sus 6 tablas (`bot_config`, `kb_chunks`,
  `conversations`, `messages`, `leads`, `contacts`) — sus conversaciones, KB, leads y su
  CRM no comparten tablas con nadie.
- Un **rol de login propio** `t_<slug>_app` con `usage` solo sobre su schema
  (verificado: `has_schema_privilege` cruzado = `false`). Ese rol es entregable al
  cliente enterprise el día que pida acceso directo a SUS datos.
- Un **subdominio propio** `<slug>-abi-chat.agavesysmx.com` operativo al instante.
- Su bot está **cerrado**: el prompt se arma server-side desde SU `bot_config`, la KB
  entra delimitada como dato, y el brain tiene prohibido salirse del negocio.

El mapeo slug→schema pasa siempre por `abi.tenants` con regex estricta
(`^[a-z][a-z0-9-]{2,29}$`) — no hay interpolación de nombres de schema derivada de
entrada libre en ningún punto.

## 5. Subdominios estilo Netlify

- **DNS**: un solo registro wildcard `*.agavesysmx.com` como **CNAME proxied** al Cloudflare
  Tunnel `vps-prod` (Universal SSL cubre el wildcard en el edge). Desde 2026-07-22 ya no hay
  A-record al VPS ni Traefik en el path.
- **Tunnel**: el hostname wildcard del tunnel `vps-prod` enruta al app
  (`necta-core-web-vpsprod`, puerto local 3002). Cero acciones de infra por tenant.
- **Next**: `src/proxy.ts` reescribe `Host: <slug>-abi-chat.agavesysmx.com` → `/t/<slug>`
  (layout aislado, sin navbar de NectaCore — el protagonista es el negocio del cliente,
  con solo el sello "creado con Abi · NectaCore").

## 6. Idempotencia y fallos

- `provision_tenant` serializa por `builder_session_id` (advisory lock) y por slug;
  la misma sesión siempre devuelve el mismo resultado (`factory_jobs.result`).
- Un fallo hace **rollback atómico completo** (no quedan schemas/roles a medias);
  la app registra el error con `abi.factory_log_failure` en transacción aparte.
- Reintentar tras fallo es seguro: el job en `failed` se retoma limpio.

## 7. Env y secretos (nombres)

Runtime (Coolify) — nombres `ABI_*`:
`ABI_DATABASE_URL` · `ABI_CHAT_N8N_WEBHOOK_URL` · `ABI_FACTORY_INTAKE_N8N_WEBHOOK_URL` ·
`ABI_TENANT_CHAT_N8N_WEBHOOK_URL` · `ABI_FACTORY_HMAC_SECRET` · `ABI_FACTORY_MASTER_KEY` ·
`ABI_DB_PASSWORD` · `NEXT_PUBLIC_SITE_URL` · `SITE_URL`.

Vault `secrets/projects/abi.env` — llaves `ABI_*` (el vaivén `ABI_*`→`NECTA_*`→`ABI_*` de
2026-07-23/26 quedó atrás); Coolify siempre mantuvo los nombres de arriba. Son tiers separados a propósito
(`vps-core/docs/reference/secrets.md`) — no asumas que un rename en uno propaga al otro.

## 8. Pendientes conocidos

- Turnstile/captcha en `/api/factory/provision` (hoy: rate limit 3/h por IP).
- Rotación programada de `factory_hmac` (la tabla ya registra `rotated_at`).
- Embeddings/pgvector para KBs grandes (hoy: KB completa en contexto, cap 20k).
- Panel del dueño (tweaks en vivo del bot) y el Constructor UI completo (`ROADMAP.md`).
- ~~Certificado de origen dedicado para subdominios~~ — resuelto por la migración a
  Cloudflare Tunnel (2026-07-22): el tramo edge→origen va por el túnel cifrado, sin puerto
  de origen expuesto ni cert de Traefik en el path.
