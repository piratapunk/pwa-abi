-- Resumen de varias conversaciones de un tenant, para la vista "conversaciones
-- anteriores" del chat.
--
-- Modelo de confianza: el mismo que ya usa abi.tenant_session_messages — el uuid
-- de sesión lo genera el navegador y ES el portador. Quien lo tiene, ve esa
-- conversación. Por eso esta función no amplía nada: solo evita 20 llamadas de
-- historial completo para pintar una lista de 20 renglones.
--
-- No enumera: sin la lista de uuids no devuelve nada. Un tenant no puede pedir
-- "todas sus conversaciones" por aquí; eso es del panel del dueño (owner_*).

create or replace function abi.tenant_conversations_summary(
  p_slug text,
  p_sessions uuid[]
)
returns jsonb
language plpgsql
stable
security definer
set search_path to 'abi', 'pg_temp'
as $function$
declare
  v_schema text;
  v_out jsonb;
begin
  if p_slug !~ '^[a-z][a-z0-9-]{2,29}$' then
    return jsonb_build_object('ok', false);
  end if;
  if p_sessions is null or cardinality(p_sessions) = 0 then
    return jsonb_build_object('ok', true, 'conversations', '[]'::jsonb);
  end if;

  select schema_name into v_schema from abi.tenants where slug = p_slug and status = 'active';
  if not found then
    return jsonb_build_object('ok', false);
  end if;

  -- 40 es el tope de la lista del cliente con holgura; recortar aquí evita que
  -- un arreglo largo convierta una vista en un escaneo.
  execute format($q$
    select coalesce(jsonb_agg(t order by t.last_message_at desc), '[]'::jsonb)
    from (
      select c.session_id,
             c.created_at,
             c.last_message_at,
             count(m.id)::int as messages,
             -- El título es el primer mensaje del cliente: es lo que la persona
             -- reconoce de un vistazo. Si la conversación abrió con el bot, no
             -- hay título y el cliente pinta la fecha.
             (select left(m2.content, 90) from %I.messages m2
               where m2.conversation_id = c.id and m2.role = 'user'
               order by m2.id limit 1) as title
        from %I.conversations c
        left join %I.messages m on m.conversation_id = c.id
       where c.session_id = any($1[1:40])
       group by c.id, c.session_id, c.created_at, c.last_message_at
      having count(m.id) > 0
    ) t
  $q$, v_schema, v_schema, v_schema)
    using p_sessions into v_out;

  return jsonb_build_object('ok', true, 'conversations', coalesce(v_out, '[]'::jsonb));
end;
$function$;

revoke all on function abi.tenant_conversations_summary(text, uuid[]) from public;
grant execute on function abi.tenant_conversations_summary(text, uuid[]) to abi_app;
