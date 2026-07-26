
## APIs que también se mudan

| carpeta | era | nota |
|---|---|---|
| `api-panel/crm/` | `/api/panel/crm/*` | thread, reply, mode (takeover), contact |
| `api-panel/feature-request/` | `/api/panel/feature-request` | peticiones del dueño desde el panel |
| `api-service-request/` | `/api/service-request` | carrito del catálogo alto-contacto |

**Se QUEDA en Abi:** `/api/panel/whatsapp/*`. La conexión de WhatsApp es el extra de pago de
Abi (vía Zernio), no una función del panel — se llamaba desde ahí, pero la capacidad es de Abi.
