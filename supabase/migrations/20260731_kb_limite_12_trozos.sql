-- Sube el corte de la KB de 6 a 12 trozos en abi.tenant_chat_context.
--
-- Por qué: el primer tenant con catálogo de verdad (autos-romar, 51 unidades)
-- llegó a 6/6 trozos y ya no cabía ni una foto por auto. El corte era silencioso
-- en los dos sentidos — el trozo 7 no existía para el bot y nadie se enteraba.
--
-- Seguro para el resto: al día de hoy ningún otro tenant pasa de 1 trozo, así
-- que subir el tope no cambia lo que ven. `left(content, 12000)` se queda: es el
-- que protege contra un trozo gigante.

create or replace function abi.tenant_chat_context(p_slug text)
returns jsonb
language plpgsql
security definer
set search_path to 'abi', 'extensions', 'pg_temp'
as $function$
declare
  v_tenant abi.tenants%rowtype;
  v_config jsonb;
  v_kb text;
  v_limit int;
  v_used int;
begin
  if p_slug !~ '^[a-z][a-z0-9-]{2,29}$' then
    return jsonb_build_object('ok', false, 'error', 'slug inválido');
  end if;
  select * into v_tenant from abi.tenants where slug = p_slug and status = 'active';
  if not found then
    return jsonb_build_object('ok', false, 'error', 'tenant no encontrado');
  end if;

  execute format('select to_jsonb(c) - ''updated_at'' from %I.bot_config c where id = 1', v_tenant.schema_name)
    into v_config;

  v_limit := coalesce((v_config->'limits'->>'msgs_day')::int, 50);
  execute format(
    'select count(*)::int from %I.messages where role = ''user'' and created_at >= date_trunc(''day'', now())',
    v_tenant.schema_name) into v_used;
  if v_used > v_limit then
    return jsonb_build_object('ok', true, 'limited', true, 'slug', v_tenant.slug, 'name', v_tenant.name);
  end if;

  execute format(
    'select string_agg(left(content, 12000), E''\n---\n'' order by id) from (select id, content from %I.kb_chunks order by id limit 12) k',
    v_tenant.schema_name) into v_kb;

  return jsonb_build_object(
    'ok', true, 'limited', false, 'slug', v_tenant.slug, 'name', v_tenant.name,
    'plan', v_tenant.plan, 'config', v_config,
    'kb', coalesce(v_kb, ''));
end;
$function$;
