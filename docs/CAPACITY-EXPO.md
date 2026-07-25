# Capacidad para la Expo — evaluación con datos

> Medido el 2026-07-17 sobre la infraestructura real. Pregunta: ¿escalar vertical el VPS,
> contratar uno dedicado, o quedarnos? Respuesta corta: **quedarnos — con el checklist de
> abajo**. El cuello de botella era software y ya se corrigió; el fierro va sobrado.

> **Actualización 2026-07-22:** medición de la era `contabo-core-01` (vps-ops). Hoy necta corre
> completo en `vps-prod` (Cloudflare Tunnel, instancia Supabase dedicada `supabase-necta-prod`)
> y n8n sigue en vps-ops: los 3 webhooks usan la URL pública
> `https://n8n.piratapunk.com/webhook/…` — el fix de la URL interna `http://n8n:5678` de abajo
> ya no aplica (hosts distintos). Estándar vigente:
> `~/piratapunk/vps-core/docs/platform/operating-standard.md`.

## 1. Qué se midió

**Base**: Contabo `contabo-core-01`, 6 vCPU / 12 GB RAM. En reposo: load ~2.2/6,
5.8 GB RAM disponibles, disco 43%. Ningún contenedor arriba del 8% de CPU.

**Prueba de carga**: 20 conversaciones simultáneas contra el bot de un tenant
(`patitas-felices.nectacore.com`), el flujo E2E completo (Cloudflare → Traefik → Next →
n8n → Gemini → Postgres del tenant). El pico esperado de la Expo es 10-20; probamos el techo.

| Escenario | Resultado |
|---|---|
| 20 concurrentes, primera medición | 20/20 OK pero **25.6 s promedio** 😱 |
| 20 concurrentes directo a n8n (control) | 20/20 OK, **3.5 s promedio** |
| Ejecución individual dentro de n8n | **1.0–2.5 s** cada una |
| 20 concurrentes E2E **tras el fix** | **20/20 OK, 4.0 s promedio, 4.7 s máx** |

**El diagnóstico**: el servidor nunca sudó (CPU ocioso durante toda la prueba). La
serialización venía de que el app Next llamaba a n8n por su URL pública
(`https://n8n.piratapunk.com`) — el tráfico salía del contenedor a la IP pública y
regresaba (hairpin NAT + TLS por conexión). Se cambió a la URL interna de la red docker
(`http://n8n:5678`) y la latencia bajó 6×. **Era software, no hardware.**

Hallazgos secundarios corregidos en el camino:
- Rate limits ahora leen `CF-Connecting-IP` (detrás del proxy CF el XFF engaña) y están
  calibrados para WiFi compartido de expo (límite fino por sesión, holgado por IP).
- Un deploy tira el sitio ~10 s (sin rolling deploy) — visto empíricamente (ráfaga de 521).

## 2. Los tres escenarios

### A. Quedarse con el VPS actual + checklist ✅ RECOMENDADO
Con el fix, el sistema sirve **20 conversaciones simultáneas en ~4 s** — el doble del
pico esperado — usando una fracción del CPU. La latencia restante es del LLM (Gemini,
~1-2 s) + red, que **ningún upgrade de VPS reduce**. Costo: $0.

### B. Escalar vertical (más vCPU/RAM al mismo VPS)
Los datos no lo justifican: el CPU está ocioso bajo el pico de prueba. Subir RAM
(12→16/24 GB) es un seguro barato si se quiere colchón psicológico — pero requiere
reinicio (ventana de minutos en Contabo) y **no mejora la latencia percibida ni un
milisegundo**. Solo tendría sentido si se agregan cargas nuevas pesadas al mismo host.
Veredicto: opcional, no antes de la Expo (el reinicio es más riesgo que el beneficio).

### C. VPS dedicado espejo (Supabase + n8n + MCPs duplicados)
**No ahora.** Cuatro razones:
1. **Los datos no lo piden**: 20 concurrentes a 4 s con el fierro aburrido.
2. **No sería independiente de verdad**: el motor (demo-brain, `agave_demo.*`, canal
   Zernio, credenciales) vive en el n8n/Supabase de este host. Un "dedicado" real
   implica migrar media plataforma, no clonar una config.
3. **Duplica la superficie de operación**: dos vaults, dos n8n que divergen, dos
   Supabase sin backup nocturno, dos Coolify. El costo real es operativo, no la renta.
4. **El peor timing**: una migración sin ensayar días antes de una Expo es el riesgo
   máximo con el beneficio mínimo.

**Cuándo SÍ dedicado**: clientes de pago con SLA, tráfico sostenido >50% CPU, o
aislamiento de ruido (p. ej. si content-factory + CV + bots pelean por el host). Ese es
el camino natural del workspace (L0 contempla "future VPSs") — con runbook y ensayo,
no de emergencia.

## 3. Checklist pre-Expo (lo que sí mueve la aguja)

- [ ] **Congelar deploys** durante horario de Expo (un deploy = ~10 s de caída).
- [ ] **Pausar crons pesados** (content-factory y similares) en horario del evento.
- [ ] **Monitores Uptime Kuma** (pendiente O1): nectacore.com, /constructor,
      un subdominio tenant y necta-constructor.piratapunk.com/healthz, con alerta.
- [ ] **Cuota Gemini**: la prueba de 20 pasó bien; verificar tier del key y habilitar
      billing/tier 1 como colchón (las cuotas RPM del free tier son el único límite
      duro externo).
- [ ] **Backup manual de Supabase** la víspera (⚠️ no está en el backup nocturno R2, O3).
- [ ] **Ensayo completo el día anterior**: constructor → bot nuevo → chat en subdominio,
      y dejar un tenant demo pulido para mostrar sin depender del vivo.
- [ ] **Plan B de red en el booth**: hotspot móvil; el WiFi de expos es traicionero.
- [ ] Rate limits expo-ready ✅ (hecho) · URLs internas n8n ✅ (hecho).

## 4. Números de referencia (post-fix)

- 1 usuario: respuesta del bot en **2–4 s**.
- 20 simultáneos: **p50 4.0 s, máx 4.7 s, 0 errores**.
- n8n procesa cada chat en 1.0–2.5 s; Gemini es ~70% de ese tiempo.
- El Constructor (agente Strands) tarda 4–10 s por turno (loop con tools) — normal y
  aceptable; su "Abi está trabajando…" lo cubre en UX.
