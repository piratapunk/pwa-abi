-- Pivote suite (docs/PIVOT-SUITE-CATALOG.md): catálogo de servicios + pedidos/cotización.
-- Aplicar a la instancia dedicada supabase-necta-prod vía /supabase-migration.
-- Todo dentro del esquema `necta` (convención del proyecto: sin FKs cruzadas).

-- 1) Catálogo de servicios (editable sin deploy).
create table if not exists abi.services (
  id          uuid primary key default gen_random_uuid(),
  slug        text not null unique,
  category    text not null,
  name        text not null,
  tagline     text,
  description text,
  icon        text,                         -- nombre de icono lucide (mapeado en UI)
  image_url   text,
  price_note  text,                          -- "Incluido" | "Desde $2/mes" | "Se cotiza contigo"
  is_featured boolean not null default false,
  sort        integer not null default 100,
  active      boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index if not exists services_category_idx on abi.services (category, sort);

-- 2) Pedido / cotización — anónimo primero, ligado al bot armado y (si aplica) al tenant.
create table if not exists abi.service_requests (
  id                 uuid primary key default gen_random_uuid(),
  builder_session_id uuid,
  tenant_id          uuid,
  lead_id            uuid,
  contact_name       text not null,
  contact_email      text,
  contact_phone      text,
  business           text,
  vertical           text,
  notes              text,
  status             text not null default 'nuevo',   -- nuevo|contactado|agendado|ganado|perdido
  source             text not null default 'nectacore.com',
  created_at         timestamptz not null default now()
);
create index if not exists service_requests_status_idx on abi.service_requests (status, created_at desc);
create index if not exists service_requests_session_idx on abi.service_requests (builder_session_id);

-- 3) Renglones del pedido. Snapshot de slug/name para sobrevivir cambios del catálogo.
create table if not exists abi.service_request_items (
  id           uuid primary key default gen_random_uuid(),
  request_id   uuid not null references abi.service_requests (id) on delete cascade,
  service_id   uuid references abi.services (id),
  service_slug text not null,
  service_name text not null,
  note         text,
  created_at   timestamptz not null default now()
);
create index if not exists service_request_items_request_idx on abi.service_request_items (request_id);

-- Grants para el rol least-privilege de la app (SELECT/INSERT/UPDATE, sin DELETE).
grant select on abi.services to abi_app;
grant select, insert on abi.service_requests to abi_app;
grant select, insert on abi.service_request_items to abi_app;

-- Seed del catálogo (copy de marca: sin nombrar el motor; precios no fijos).
insert into abi.services (slug, category, name, tagline, description, icon, price_note, is_featured, sort) values
  ('asistente-chat',    'Asistente',      'Asistente que contesta 24/7',        'El corazón de todo',                'Atiende a tus clientes al instante, todo el día, con la información de tu negocio.', 'MessageCircle', 'Incluido',          true,  10),
  ('crm',               'Asistente',      'CRM que se llena solo',              'Cada conversación, un contacto',    'Contactos, conversaciones, embudo y citas — se llenan solos mientras tu asistente atiende.', 'Users', 'Incluido',          true,  20),
  ('whatsapp-numero',   'WhatsApp',       'Tu WhatsApp conectado',             'Tu número, tu marca',               'Tu asistente contesta en tu propio número de WhatsApp, con tu nombre.', 'Phone', 'Desde $2/mes',      true,  30),
  ('whatsapp-campanas', 'WhatsApp',       'Campañas y difusiones',             'Reengancha a tus clientes',         'Envíos masivos y seguimientos automáticos por WhatsApp, con seguimiento de entrega.', 'Send', 'Se cotiza contigo', false, 40),
  ('redes-atencion',    'Redes sociales', 'Atención en redes',                 'Una sola bandeja',                  'Instagram, Facebook, TikTok y más — mensajes y comentarios en un solo lugar.', 'Inbox', 'Se cotiza contigo', true,  50),
  ('redes-publicacion', 'Redes sociales', 'Publicación programada',            'Presencia sin esfuerzo',            'Programa y publica contenido en todas tus redes desde un solo lugar.', 'CalendarClock', 'Se cotiza contigo', false, 60),
  ('reputacion',        'Reputación',     'Reseñas bajo control',              'Cuida tu reputación',               'Responde reseñas de Google y Facebook con ayuda, y entérate al instante de las malas.', 'Star', 'Se cotiza contigo', false, 70),
  ('voz',               'Voz y teléfono', 'Recepcionista con IA',              'Contesta el teléfono por ti',       'Un número que atiende llamadas, toma recados y agenda — con voz natural.', 'PhoneCall', 'Se cotiza contigo', false, 80),
  ('publicidad',        'Publicidad',     'Campañas con seguimiento',          'Sabe qué anuncio vendió',           'Campañas en Meta, Google y más, con atribución de cada venta a su anuncio.', 'Megaphone', 'Se cotiza contigo', false, 90),
  ('analitica',         'Analítica',      'Reporte de desempeño',              'Tus números, claros',               'Un reporte periódico de conversaciones, ventas y redes — en tu idioma, no en jerga.', 'BarChart3', 'Se cotiza contigo', false, 100),
  ('integraciones',     'Integraciones',  'Funciones a la medida',             'Conecta lo que ya usas',            'Cobros, inventario, agenda, tu ERP — conectamos tu asistente con tus sistemas.', 'Puzzle', 'Se cotiza contigo', true,  110)
on conflict (slug) do nothing;
