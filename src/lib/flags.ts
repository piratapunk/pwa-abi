/*
 * Banderas de producto. Un solo punto de verdad, revertible desde env.
 *
 * 2026-07-25: el portal y el panel del dueño DEJARON de ser parte de Abi — pasan
 * al CRM Coa (código preservado en `src/_coa-material/`). Estas banderas ya no
 * revivirían nada: las rutas salieron del app router.
 *
 * `selfServe` se conserva porque `entrar/`, `Navbar` y `BuildSuccessCard` aún la
 * leen para decidir si ofrecen crear cuenta. Mientras Abi no tenga cuentas
 * propias, va apagada.
 *
 * Se usan NEXT_PUBLIC_* a propósito: no son secretos y así el mismo valor sirve en
 * servidor y cliente. Deben referenciarse como literal para que Next las inyecte.
 */
const truthy = (v?: string) =>
  v != null && ['1', 'true', 'on', 'yes'].includes(v.toLowerCase())

export const FEATURES = {
  /** Cuentas, portal (/inicio, /mis-bots), panel por bot y "ligar bot a mi cuenta". */
  selfServe: truthy(process.env.NEXT_PUBLIC_ABI_SELF_SERVE),
  /** Auto-conexión del WhatsApp del cliente desde el panel. */
  whatsappSelfConnect: truthy(process.env.NEXT_PUBLIC_ABI_WHATSAPP_SELF_CONNECT),
} as const
