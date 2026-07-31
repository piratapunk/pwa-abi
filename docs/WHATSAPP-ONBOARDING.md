# Onboarding de WhatsApp (Premium) — del proceso manual al self-serve

> **Estado: IMPLEMENTADO (2026-07-17)** — el flujo del portal está en producción:
> `/panel/[slug]/conexiones` → "Conectar mi WhatsApp" (gate Premium) → perfil por API
> (idempotente: adopta perfil existente si el nombre ya está) → **Embedded Signup real de
> Meta** (verificado E2E hasta la URL de OAuth con los 4 scopes) → callback firmado
> (state HMAC) → `abi.set_tenant_channel`. El loop de mensajes también está vivo:
> webhook `abi-wa-inbound` registrado en el canal (message.received, firmado) → n8n
> verifica firma en Postgres → mapea accountId→tenant → brain con la KB del tenant →
> responde vía inbox API → todo logueado en el schema del tenant (probado sintético;
> lo único pendiente de validar con un número físico real es el tramo Meta→escaneo→primer
> mensaje real). El diseño original de este doc se conserva abajo como referencia.

> 2026-07-17. El proceso actual de conectar el WhatsApp de un cliente es artesanal.
> Este doc lo mapea contra lo que la API del canal ya permite (catálogo:
> `resh-zernio/capabilities/whatsapp-conexion-numeros.md`) y define el flujo objetivo
> por el portal. Regla de marca intacta: el cliente jamás ve el nombre del proveedor —
> todo es "conectar tu WhatsApp a NectaCore".

## El proceso HOY (manual, 3 toques humanos)

```
1. Nosotros creamos la cuenta del cliente en el proveedor        (manual, dashboard)
2. Contactamos al cliente para pedirle un código de verificación  (manual, chat/llamada)
3. Le enviamos el QR de WABA Business                             (manual, captura/archivo)
4. El cliente escanea y conecta su app como coexistencia          (cliente, a ciegas)
```

Fricciones: cada alta consume ~1 sesión de ida y vuelta; el cliente maneja códigos y QRs
"sueltos" fuera de contexto; no hay visibilidad de en qué paso se atoró; no escala.

## Lo que la API ya resuelve (verificado en el catálogo)

| Paso manual de hoy | Reemplazo por API |
|---|---|
| Crear cuenta del cliente en el dashboard | `POST /v1/profiles` — un profile por cliente, programático |
| Pedir código + mandar QR por chat | **`GET /v1/connect/whatsapp?profileId=&redirect_url=`** → devuelve `authUrl` del **Embedded Signup oficial de Meta**. El QR de coexistencia y el código de verificación viven DENTRO de ese flujo oficial — Meta se los muestra al cliente directamente, en su idioma, en el momento correcto |
| "¿Ya quedó?" por chat | El redirect regresa a NUESTRO portal con `connected=whatsapp&accountId=&username=+E164`; webhooks (`whatsapp.number.activated`) confirman server-side |
| Verificar que todo jaló | `GET /v1/whatsapp/number-info` — estado vivo: conexión, `quality_rating`, tier, display name aprobado |
| Número nuevo (sin número propio) | `POST /v1/phone-numbers/purchase` (54 países; `connectWhatsapp` por default) + KYC white-label (`POST /v1/phone-numbers/kyc/share`) cuando el país lo pide |

**Conclusión: el 90% del proceso manual es eliminable.** Los 3 toques humanos se vuelven
cero para el caso estándar (coexistencia con su app o número nuevo instantáneo).

## El flujo OBJETIVO (self-serve por el portal)

```
Panel del cliente (P3) → botón "Conectar mi WhatsApp" (Premium)
   │
   ▼ server-side (automático)
1. POST /v1/profiles  → profile del cliente (idempotente; se guarda en abi.tenants)
2. GET /v1/connect/whatsapp?profileId=…&redirect_url=https://nectacore.com/panel/whatsapp/callback
   → authUrl
   │
   ▼ cliente (una sola pantalla, flujo oficial de Meta)
3. Redirect al Embedded Signup:
   - "Usar mi número de siempre" → elige coexistencia → META le muestra el QR
     y el código en SU flujo, con instrucciones oficiales → escanea desde su app
   - "Quiero número nuevo" → variante B (compra por API + KYC si aplica)
   │
   ▼ automático
4. Regresa al portal con accountId → guardamos canal en abi.tenants +
   provisioning del bot al canal real (Fase PROD del runbook de la casa)
5. Webhook de conexión → el panel muestra "✅ Tu WhatsApp está conectado"
   + primer mensaje de prueba al número del dueño
   │
   ▼ si algo se atora (estado visible en el panel)
   → CTA "Te ayudamos" → alerta interna (zernio-notify) → toque humano SOLO en excepción
```

### Variante B — cliente sin número propio
- `GET /v1/phone-numbers/countries` → precio/kyc del país → compra desde el portal.
- País instantáneo (~30 s): número listo y conectado en la misma sesión.
- País regulado: `202 kyc_required` → formulario KYC white-label (con marca NectaCore)
  → webhook `whatsapp.number.activated` (1–3 días) → email automático "tu número quedó".

### Qué se queda manual a propósito
- **Enterprise**: migraciones desde otro proveedor (Meta retiene la asociación del número —
  error conocido `#2655093`; "número limpio > pelear la liberación"), integraciones a sus
  sistemas, port-ins. Ahí el toque humano ES el producto.
- **Escalamiento por excepción**: cualquier estado atorado >24 h dispara alerta interna.

## Detalles de implementación (cuando toque — depende de F1)

- **Dónde vive**: paso post-upgrade en el panel (P3). Gate: `plan='premium'` (F2 lo activa).
- **Datos**: `abi.tenants` gana `channel_profile_id`, `channel_account_id`,
  `channel_status` (`none → connecting → connected → error`), `channel_number`.
  Contrato `abi.set_tenant_channel(...)` (SECURITY DEFINER, mismo patrón del factory).
- **Callback**: `/panel/whatsapp/callback` valida `state` firmado (HMAC, anti-CSRF del
  redirect) antes de aceptar el `accountId`.
- **Webhook firmado propio** por tenant (patrón `<CLIENTE>_ZERNIO_WEBHOOK_SECRET` del
  runbook scaffold-zernio-bot Fase PROD, rollout off→observe→enforce).
- **Coexistencia — límites que el portal debe avisar ANTES de conectar** (para no
  sorprender): 20 msg/s, sin grupos por API, sin llamadas API, los mensajes se espejean
  con su app (eso es bueno: el dueño sigue contestando desde su teléfono cuando quiera).
- **UX copy** (voz Abi): "Vas a conectar tu número de siempre. Tu app sigue funcionando
  igual — tu asistente contesta y tú entras cuando quieras."

## Impacto esperado

| Métrica | Hoy | Objetivo |
|---|---|---|
| Toques humanos por alta estándar | 3 | 0 (excepciones: 1) |
| Tiempo del alta | horas–días (idas y vueltas) | ~5 min en una sola sesión |
| Visibilidad del avance | ninguna (chat) | estado en el panel + webhooks |
| Escalabilidad | 1 alta = 1 sesión nuestra | N altas en paralelo, sin nosotros |
