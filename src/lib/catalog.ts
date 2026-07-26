import { getSql } from '@/lib/db'

/*
 * Catálogo de servicios. Fuente de verdad: abi.services (editable sin deploy).
 * Si la BD no está disponible o la tabla aún no existe (pre-migración), cae al
 * catálogo estático de abajo — espejo del seed de la migración — para que
 * /servicios funcione siempre. Copy de marca: nunca nombra el motor.
 */

export type Service = {
  slug: string
  category: string
  name: string
  tagline: string | null
  description: string | null
  icon: string | null
  priceNote: string | null
  isFeatured: boolean
}

export type CatalogGroup = { category: string; services: Service[] }

/** Orden de categorías en la página. */
const CATEGORY_ORDER = [
  'Asistente',
  'WhatsApp',
  'Redes sociales',
  'Reputación',
  'Voz y teléfono',
  'Publicidad',
  'Analítica',
  'Integraciones',
]

const STATIC_CATALOG: Service[] = [
  { slug: 'asistente-chat', category: 'Asistente', name: 'Asistente que contesta 24/7', tagline: 'El corazón de todo', description: 'Atiende a tus clientes al instante, todo el día, con la información de tu negocio.', icon: 'MessageCircle', priceNote: 'Incluido', isFeatured: true },
  { slug: 'crm', category: 'Asistente', name: 'CRM que se llena solo', tagline: 'Cada conversación, un contacto', description: 'Contactos, conversaciones, embudo y citas — se llenan solos mientras tu asistente atiende.', icon: 'Users', priceNote: 'Incluido', isFeatured: true },
  { slug: 'whatsapp-numero', category: 'WhatsApp', name: 'Tu WhatsApp conectado', tagline: 'Tu número, tu marca', description: 'Tu asistente contesta en tu propio número de WhatsApp, con tu nombre.', icon: 'Phone', priceNote: 'Desde $2/mes', isFeatured: true },
  { slug: 'whatsapp-campanas', category: 'WhatsApp', name: 'Campañas y difusiones', tagline: 'Reengancha a tus clientes', description: 'Envíos masivos y seguimientos automáticos por WhatsApp, con seguimiento de entrega.', icon: 'Send', priceNote: 'Se cotiza contigo', isFeatured: false },
  { slug: 'redes-atencion', category: 'Redes sociales', name: 'Atención en redes', tagline: 'Una sola bandeja', description: 'Instagram, Facebook, TikTok y más — mensajes y comentarios en un solo lugar.', icon: 'Inbox', priceNote: 'Se cotiza contigo', isFeatured: true },
  { slug: 'redes-publicacion', category: 'Redes sociales', name: 'Publicación programada', tagline: 'Presencia sin esfuerzo', description: 'Programa y publica contenido en todas tus redes desde un solo lugar.', icon: 'CalendarClock', priceNote: 'Se cotiza contigo', isFeatured: false },
  { slug: 'reputacion', category: 'Reputación', name: 'Reseñas bajo control', tagline: 'Cuida tu reputación', description: 'Responde reseñas de Google y Facebook con ayuda, y entérate al instante de las malas.', icon: 'Star', priceNote: 'Se cotiza contigo', isFeatured: false },
  { slug: 'voz', category: 'Voz y teléfono', name: 'Recepcionista con IA', tagline: 'Contesta el teléfono por ti', description: 'Un número que atiende llamadas, toma recados y agenda — con voz natural.', icon: 'PhoneCall', priceNote: 'Se cotiza contigo', isFeatured: false },
  { slug: 'publicidad', category: 'Publicidad', name: 'Campañas con seguimiento', tagline: 'Sabe qué anuncio vendió', description: 'Campañas en Meta, Google y más, con atribución de cada venta a su anuncio.', icon: 'Megaphone', priceNote: 'Se cotiza contigo', isFeatured: false },
  { slug: 'analitica', category: 'Analítica', name: 'Reporte de desempeño', tagline: 'Tus números, claros', description: 'Un reporte periódico de conversaciones, ventas y redes — en tu idioma, no en jerga.', icon: 'BarChart3', priceNote: 'Se cotiza contigo', isFeatured: false },
  { slug: 'integraciones', category: 'Integraciones', name: 'Funciones a la medida', tagline: 'Conecta lo que ya usas', description: 'Cobros, inventario, agenda, tu ERP — conectamos tu asistente con tus sistemas.', icon: 'Puzzle', priceNote: 'Se cotiza contigo', isFeatured: true },
]

function group(services: Service[]): CatalogGroup[] {
  const byCat = new Map<string, Service[]>()
  for (const s of services) {
    const arr = byCat.get(s.category) ?? []
    arr.push(s)
    byCat.set(s.category, arr)
  }
  const ordered = [...byCat.keys()].sort((a, b) => {
    const ia = CATEGORY_ORDER.indexOf(a)
    const ib = CATEGORY_ORDER.indexOf(b)
    return (ia === -1 ? 999 : ia) - (ib === -1 ? 999 : ib)
  })
  return ordered.map((category) => ({ category, services: byCat.get(category)! }))
}

export async function getCatalog(): Promise<CatalogGroup[]> {
  const sql = getSql()
  if (sql) {
    try {
      const rows = await sql<
        {
          slug: string
          category: string
          name: string
          tagline: string | null
          description: string | null
          icon: string | null
          price_note: string | null
          is_featured: boolean
        }[]
      >`
        select slug, category, name, tagline, description, icon, price_note, is_featured
        from abi.services
        where active = true
        order by sort asc
      `
      if (rows.length > 0) {
        return group(
          rows.map((r) => ({
            slug: r.slug,
            category: r.category,
            name: r.name,
            tagline: r.tagline,
            description: r.description,
            icon: r.icon,
            priceNote: r.price_note,
            isFeatured: r.is_featured,
          }))
        )
      }
    } catch {
      /* tabla aún no migrada — cae al estático */
    }
  }
  return group(STATIC_CATALOG)
}

export const CATALOG_FALLBACK = STATIC_CATALOG
