# Pendientes — seguimiento

> Backlog operativo de nectacore.com. Se actualiza al cerrar o descubrir pendientes.
> Contexto: `FACTORY-ARCHITECTURE.md`, `CAPACITY-EXPO.md`, `ROADMAP.md`.
> Última revisión: 2026-07-17 (segunda pasada — cerrados S1, S2, S4, S5, O3, O4, P6 y parte de P1).

## ✅ Pulido de UI/flujo (2026-07-17, autónomo)

- **Labor illusion en el build**: interludio narrado (~5s, panal llenándose de miel, pasos "Leyendo tu info… Afinando el tono…") entre "constrúyelo" y la tarjeta de éxito. El provisioning es instantáneo; esto sube el valor percibido (`UX-PSYCHOLOGY.md`). Respeta reduced-motion.
- **Tarjeta de éxito de cierre**: al construir, el chat se retira y entra tarjeta con liga (copiar/abrir), claim SIEMPRE visible y **mini-chat de prueba embebido**. Restaurable al recargar (localStorage + `/api/constructor/status`).
- **Preguntas sugeridas por vertical** en los bots de tenant: chips ("¿Cuál es el menú?", "¿Hacen entregas?"…) hasta el primer mensaje — invitan a interactuar (patrón de la casa).
- **Post-filtro anti-rellenos** (P6): filtro determinista en el servicio del Constructor quita "¡Excelente!/¡Claro!/¡Perfecto!" del inicio de las respuestas de Abi — garantizado, no depende del prompt.
- **Chat de tenant full-height en móvil** + **reintento automático** ante fallos transitorios (521 de deploy, WiFi de venue — expo-ready).
- **CSP: Cloudflare Insights permitido** — fin del error de consola en subdominios + analítica de tráfico gratis para la Expo.
- **404 con marca** (Abi) en vez del genérico de sistema.

## ✅ Cerrados en pasadas anteriores

| # | Qué | Cómo quedó |
|---|---|---|
| S1 | Turnstile | Widget CF `nectacore-constructor` (managed). Gate en `/api/constructor` (primer mensaje por sesión) y `/api/factory/provision`. CSP actualizada. Verificado en navegador real. |
| S2 | Rotación de `factory_hmac` | Runbook `vps-core/scripts/rotate-necta-hmac.sh` (DB → vault → Coolify → redeploys). **Ejecutado una vez con éxito** — la rotación real está probada. |
| S4 | Tope de tenants | Candado server-side `abi.factory_daily_cap_reached()` (50 bots nuevos/día) dentro de `provision_tenant` + Turnstile como gate humano. |
| S5 | Cuotas de mensajes por tenant | `tenant_chat_context` corta al llegar a `msgs_day` del plan; el bot responde el límite con gracia. Verificado en vivo (Patitas lo disparó tras las pruebas de carga). |
| O3 | Backup Supabase | **Ya existía y corre**: `/opt/backup-supabase.sh`, cron diario 10:15 UTC → R2, retención 14 días, incluye schemas de tenants (pg_dumpall). La advertencia del workspace CLAUDE.md estaba desactualizada — corregida. |
| O4 | DR workflows n8n | Export corrido (46 workflows, incluye los 3 necta). El script del repo estaba roto (heredoc frágil) — reparado con jq. |
| P6 | Tuning de voz | Regla anti-rellenos endurecida con ejemplos en: `behavior.ts` (chat central), prompt del Constructor (Strands) y prompt del tenant-chat (n8n). Verificado: respuestas entran directo. |
| P1 (parcial) | Constructor | El Constructor **conversacional ya opera en producción** con panal de progreso animado (endowed progress: arranca en 2/6, avanza por etapa real del agente: conversando → borrador → construido). |

## 🔴 Nuevo — atención

| # | Pendiente | Detalle | Prioridad |
|---|---|---|---|
| N1 | **Rotar `N8N_API_KEY`** | La llave quedó expuesta en un trace de debug local (sesión Claude 2026-07-17). Rotación manual: n8n UI → Settings → API → borrar y crear; actualizar `secrets/platform/n8n.env` y `~/mcp-env/n8n.env` del VPS (mcp-n8n). | **Alta** |

## Seguridad / endurecimiento

| # | Pendiente | Detalle | Prioridad |
|---|---|---|---|
| S3 | CF Full **strict** para `*.nectacore.com` | **Obsoleto (2026-07-22)**: con la migración a Cloudflare Tunnel (`vps-prod`, ADR 009) ya no hay puerto de origen expuesto ni Traefik en el path — el tramo edge→origen va por el túnel cifrado y no se requiere origin cert. | — |

## Producto (fases mayores — decisiones evaluadas con datos en [`EVALUACION-P2-F2.md`](EVALUACION-P2-F2.md))

| # | Pendiente | Detalle | Prioridad |
|---|---|---|---|
| P1 (resto) | Constructor: ingesta de documentos + voz | **✅ Documentos (2026-07-18)**: clip 📎 en el Constructor → `/api/constructor/upload` (hv cookie + límites del plan free: 1 archivo, 2 MB, 20k chars) → extracción solo-texto en el servicio (`/extract`, pypdf/python-docx, HMAC) → sanitización capas 1+3 (`src/lib/factory/sanitize.ts`: NFKC, invisibles/bidi fuera, líneas con inyección fuera) → cuarentena `abi.kb_sources` → preview **editable** por el dueño (IKEA) → `approved` → `provision_tenant` materializa a `kb_chunks` del tenant. El agente confirma vía aviso `[ARCHIVO]`. **Falta**: dictado por voz (STT) y upload desde el panel Archivos para bots ya construidos; sandbox dedicado de extracción (hoy corre en el servicio constructor). | Media (voz) |
| P2 | Registro/claim de cuenta | **✅ Implementado y probado E2E** (2026-07-17): GoTrue + magic link brandeado (`generate_link` + callback propio, sin tocar config compartida) + `abi.tenant_users`/`claim_tenant`/`user_tenants` + página `/mis-bots` + captura de email post-provisión en el Constructor. `abi.plan_limits` creada como fuente única (incluye límites de archivos con doble candado anti-compresión; RAG jamás en free). | — |
| P2-mail | Correo saliente | **✅ Resuelto (2026-07-17)**: dominio nectacore.com agregado a la cuenta Resend del dueño (vía su sesión, Manual setup — sin darle OAuth a Resend sobre CF), registros DKIM/SPF/MX/DMARC creados por API en Cloudflare, dominio verificado, envío real probado desde `hola@nectacore.com`, y el flujo de magic links quedó vivo en producción. Pendiente solo (b) Google OAuth: `GOTRUE_URI_ALLOW_LIST` + Google Console. | (b) más adelante |
| P-mailrouting | Email Routing por dominio | **✅ nectacore.com resuelto (2026-07-17)**: catch-all → inbox personal (vault), loop probado. **Infra reutilizable creada**: proyecto `~/piratapunk/ops-mail-routing` (inventario + script + gotchas) y skill global `/cf-mail-routing`. **Pendiente**: pasada por los demás dominios (sendacards, bjj-manager, agavesysmx…) — confirmar caso por caso los MX de iCloud antes de migrar. Opcional: ampliar el token CF con permisos de Email Routing para que sea 100% API. | Cuando lo pida |
| P-WA | Onboarding WhatsApp self-serve | **✅ VALIDADO CON NÚMERO REAL (2026-07-19)**: signup completo (tras liberar el número de la WABA previa; error Meta #2388002 = número retenido), primer mensaje real cruzado y el bot del tenant contestando por WhatsApp. Fixes de la validación: payload real trae la cuenta en `account.id` raíz y el remitente en `message.sender.phoneNumber` (Extract corregido + captura CRM por WA verificada); filtro `fromMe` incluye `outgoing` (las respuestas del dueño desde su app no disparan al bot); el ingress del demo suite (`waba-agave-demo-suite`) ahora filtra por `ZERNIO_ALLOWED_ACCOUNT_IDS` (el usuario Zernio es compartido — sin filtro contestaba cuentas ajenas; al reconectar la coexistencia de Agave hay que poner su accountId nuevo ahí); el callback mueve la cuenta al perfil del tenant (PATCH /v1/accounts). **Falta**: validar la respuesta del dueño panel→WhatsApp (takeover saliente) con el número real. | Validar takeover saliente |
| P3 | Panel del dueño | **✅ v1 en producción (2026-07-17)** + **✅ CRM v2 (2026-07-18)**, homologado al dashboard del canal: Resumen (+tiles de clientes), Conversaciones (inbox con detalle de hilo, tarjeta de contacto y **takeover humano** web/WhatsApp con caja de respuesta y toggle bot↔humano), **Clientes** (CRM auto-llenado: regex tel/email en `tenant_log_message` + marcador `<<<lead>>>` del brain; tags/etapas/notas editables), **Embudo** (5 etapas, mover con select), Archivos, Conexiones, Funciones, Mi plan. CRM/takeover con candado Premium (gate server-side 402). Widget del tenant con polling (5 s, pestaña visible) para ver respuestas del equipo en vivo. Falta: edición de persona (saludo/tono), marcada "muy pronto"; el teléfono del remitente WA se extrae best-effort del webhook (validar campos reales al conectar número físico — P-WA). | — |
| P4 | pgvector / RAG para KBs grandes | Umbral determinista (~15k chars o >1 doc) → chunking + embeddings Ollama + pgvector en el schema del tenant. No es agente (ver `STRANDS-EVALUATION.md` §2C). | Media |
| P5 | Espejo `/en` | Copy nativo en inglés. | Baja |

## Operación

| # | Pendiente | Detalle | Prioridad |
|---|---|---|---|
| O1 | Monitores Uptime Kuma | **✅ (2026-07-18)**: 4 monitores HTTP dados de alta (NectaCore Web, Constructor, tenant demo taqueria-la-nona, servicio necta-constructor `/healthz`), todos Up, con la notificación Telegram "PirataPunk Infra Alerts" activa. | — |
| O2 | Tenants demo | `taqueria-la-nona`, `estetica-bella-luna`, `patitas-felices` — se conservan como demos para la Expo. Borrar después con drop schema/role + delete en `abi.tenants`. | Baja |

## Facturación

| # | Pendiente | Detalle |
|---|---|---|
| F1 | Pasarela self-serve premium | **✅ En producción (2026-07-17, LIVE)**: cuenta Stripe NectaCore MX, producto Premium $999 MXN/mes y $9,990/año (2 meses gratis — cifras definidas por el dueño), checkout desde `/panel/[slug]/plan`, webhook firmado + idempotente (`abi.stripe_webhook_events`), portal de facturación. E2E verificado con eventos sintéticos firmados **y checkout real (2026-07-19, $15 de prueba → upgrade premium en vivo)**. El precio mensual de prueba quedó **restaurado a $999** en el env (2026-07-19). **Pendiente F1-b**: prepago OXXO/SPEI de N meses (pago único) para PyMEs sin tarjeta. |
| F2 | `upgrade_tenant` | **✅ En producción**: contrato SECURITY DEFINER que reescribe capabilities/limits desde `plan_limits` en el schema del tenant; upgrade y downgrade probados (el downgrade nunca borra el bot). Disparado por el webhook. |

## Checklist Expo (de `CAPACITY-EXPO.md`)

- [ ] Congelar deploys en horario del evento
- [ ] Pausar crons pesados (content-factory)
- [ ] O1 (monitores Kuma) hecho
- [ ] Verificar tier/cuota del key Gemini
- [ ] Ensayo completo la víspera + hotspot de respaldo
