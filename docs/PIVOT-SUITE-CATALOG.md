# Pivote — NectaCore como suite de servicios (catálogo + carrito + cotización)

> Estado: **borrador de arranque** (2026-07-23). Reemplaza el modelo self-serve total por uno
> catálogo-primero, alto contacto. No borra código: **apaga por bandera** lo que dejamos de
> ofrecer para poder revertir sin fricción.

## Contexto — por qué cambiamos

El modelo anterior era SaaS self-serve completo: el prospecto se registraba, armaba su bot, lo
cargaba, lo configuraba en un panel, conectaba **su propio** WhatsApp Business y lo administraba
solo, con planes Free/Premium/Enterprise auto-servidos.

Tras revisión con el equipo, arrancamos **mucho más chico y de alto contacto**. NectaCore se
presenta como **suite completa para implementaciones de CRM**: el prospecto **arma y prueba** su
asistente en el Constructor (eso se queda), luego **explora todo lo que podemos hacer por él**,
**arma su pedido** (carrito de servicios) y nos deja sus datos. Nosotros lo **contactamos para
agendar el arranque** (kickoff). Todo es entrega a la medida — nada de auto-provisión ni
configuración por el usuario todavía.

### Qué se queda vs. qué se apaga

| Se queda (visible) | Se apaga por bandera (código intacto) |
|---|---|
| Landing en nectacore.com | Registro / login / magic link (`/entrar`, `/entrar/confirmar`) |
| El Constructor: **armar y probar** el bot (con provisión real, como hoy) | Portal del usuario (`(portal)`: `/inicio`, `/mis-bots`, `/mis-bots/cuenta`) |
| El chat central de Abi | Panel de configuración por bot (`/panel/[slug]/*`) |
| **Nuevo:** catálogo de servicios + carrito + formulario de cotización | Auto-conexión de WhatsApp (`/api/panel/whatsapp/*` + UI) |
|  | "Reclamar/ligar el bot a mi cuenta" (claim en el Constructor) |
|  | Stripe / cobros self-serve (no se cobra aquí; el precio se cotiza) |

## El flujo nuevo (una pantalla a la vez)

1. **Landing** → CTA principal a `/constructor` (sin CTA "Entrar").
2. **Constructor** → arma el bot, se **provisiona real** y lo **prueba** ahí mismo
   (`BuildSuccessCard` + `TenantChat`, como hoy). En vez del "ligarlo a mi cuenta", el cierre
   invita a: **"Arma tu suite — elige lo que quieres que haga por ti"** → `/servicios`.
3. **`/servicios`** (nuevo) → catálogo de **todos** los servicios por categoría; cada uno se
   **agrega/quita** del pedido (toggle). El carrito persiste (localStorage por sesión).
4. **Carrito → `/servicios/pedido`** (o panel lateral) → formulario de datos
   (nombre, correo, teléfono, negocio, notas). El bot armado se adjunta al pedido.
5. **Envío** → se guarda como **lead + pedido de servicios**; pantalla de cierre:
   *"Listo — te contactamos para agendar el arranque."* No hay cobro.

## Catálogo de servicios (fuente: `abi` schema, editable sin deploy)

Fuente de verdad: reference interna `docs/agave_n8n_capacidades_referencia.pages` +
`resh-zernio/capabilities/*`. **Regla de marca inviolable:** el copy público **no nombra el
motor** (nada de n8n, Zernio, Agave, OpenAI, Meta como proveedor). Se habla de resultados de
negocio, en español (MX). Precios **no fijos**: `price_note` tipo *"Incluido"*, *"Desde $2/mes"*,
*"Se cotiza contigo"*.

Categorías (taxonomía derivada de las imágenes y la referencia):

- **Asistente** — el chatbot base (chat/atención), incluido con todo bot.
- **WhatsApp** — número propio conectado, mensajería, campañas/difusiones, formularios.
- **Redes sociales** — atención y publicación en IG, Facebook, TikTok, YouTube, LinkedIn,
  Twitter/X, Threads, Pinterest, Google Business (bandeja unificada + publicación programada).
- **Comunicación** — Telegram, Discord, WhatsApp (canales directos).
- **Publicidad** — campañas y atribución (Meta, Google, TikTok, LinkedIn, Pinterest, X).
- **Voz y teléfono** — número, IVR, recepcionista con IA, llamadas.
- **Reputación** — reseñas de Google/Facebook, respuestas asistidas, alertas de baja calificación.
- **Analítica** — reportes de desempeño (mensajes, conversaciones, redes) periódicos.
- **CRM** — contactos, conversaciones, embudo, citas (incluido con el asistente).
- **Integraciones a la medida** — cobros, inventario, agenda, ERP; "funciones a la medida".

## Modelo de datos (`abi`) — migración nueva

Sin FKs cruzadas a otros esquemas; todo dentro de `abi` (convención del proyecto).

- **`abi.services`** — catálogo. `id, slug (unique), category, name, tagline, description,
  icon, image_url, price_note, is_featured, sort, active, created_at, updated_at`.
- **`abi.service_requests`** — el "pedido"/cotización, anónimo primero, ligado a
  `builder_session_id` y (si aplica) `tenant_id`. `id, builder_session_id, tenant_id, lead_id,
  contact_name, contact_email, contact_phone, business, vertical, notes,
  status ('nuevo'|'contactado'|'agendado'|'ganado'|'perdido'), created_at`.
- **`abi.service_request_items`** — renglones. `id, request_id, service_id, service_slug
  (snapshot), service_name (snapshot), note, created_at`. El snapshot protege pedidos históricos
  ante cambios del catálogo.
- **Seed** del catálogo con las categorías/servicios de arriba (copy de marca, precios no fijos).

## Banderas (apagado reversible)

`src/lib/flags.ts` — único punto de verdad, leído de env, con espejo público
(`NEXT_PUBLIC_*`) para componentes cliente.

- `NECTA_SELF_SERVE` (default **`off`**) — apaga cuentas, portal, panel por bot, claim.
- `NECTA_WHATSAPP_SELF_CONNECT` (default **`off`**) — apaga auto-conexión de WhatsApp.

Puntos de aplicación:
- Layouts `(portal)` y `panel/[slug]` → `redirect('/')` si `!selfServe`.
- Páginas `/entrar`, `/entrar/confirmar` → `redirect('/')` si `!selfServe`.
- Rutas API de auth, whatsapp, stripe, feature-request → `404/410` si apagado.
- `Navbar` → oculta "Entrar"; CTA queda "Arma tu asistente gratis".
- `BuildSuccessCard` → reemplaza claim por CTA a `/servicios`.

## Archivos clave a tocar

- **Nuevo** `src/lib/flags.ts`, `src/lib/catalog.ts` (loader del catálogo desde DB),
  `src/app/(site)/servicios/page.tsx` (+ `pedido`), `src/components/catalog/*` (grid, card,
  carrito, form), `src/app/api/service-request/route.ts`.
- **Migración** `supabase/migrations/*_services_catalog.sql` (aplicar a la instancia dedicada
  `supabase-abi-prod` vía `/supabase-migration`; **no** auto-aplicar a prod sin revisar).
- **Editar** `Navbar.tsx`, `BuildSuccessCard.tsx`, `(portal)/layout.tsx`,
  `panel/[slug]/layout.tsx`, `(site)/entrar/*`, rutas API a apagar, `PricingSection` (reencuadre
  a "se arma a la medida"), `.env.example`, `CLAUDE.md` (documentar el pivote).

## Verificación (end-to-end)

1. `npm run build` / typecheck limpio.
2. Con `NECTA_SELF_SERVE=off`: `/entrar`, `/mis-bots`, `/panel/x` redirigen a `/`; el nav no
   muestra "Entrar"; el Constructor arma+prueba y cierra con CTA a `/servicios`.
3. `/servicios` lista el catálogo desde `abi.services`; agregar/quitar arma el carrito;
   `/servicios/pedido` envía y crea `service_requests` + `items` + `lead` (verificar con
   `mcp__piratapunk-supabase`).
4. Con `NECTA_SELF_SERVE=on`: todo lo anterior vuelve a estar disponible (revertible).
