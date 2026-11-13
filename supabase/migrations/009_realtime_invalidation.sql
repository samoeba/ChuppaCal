begin;
-- Broadcast only an invalidation signal, never a row (which may contain PINs/tokens).
create function public.cc_broadcast_family_change() returns trigger
language plpgsql security definer set search_path = '' as $$
declare v_row jsonb := case when tg_op='DELETE' then to_jsonb(old) else to_jsonb(new) end; v_family uuid;
begin
  if tg_table_name='families' then v_family := (v_row->>'id')::uuid;
  elsif tg_table_name='chore_template_members' then
    select family_id into v_family from public.chore_templates where id=(v_row->>'template_id')::uuid;
  else v_family := (v_row->>'family_id')::uuid; end if;
  if v_family is not null then
    perform realtime.send(jsonb_build_object('table',tg_table_name),'changed','family:'||v_family::text,true);
  end if;
  return null;
exception when others then
  -- Realtime is a best-effort accelerator; polling remains available during service failure.
  return null;
end $$;
revoke all on function public.cc_broadcast_family_change() from public,anon,authenticated;
do $$ declare t text; begin
  foreach t in array array['families','family_members','calendar_events','calendar_connections','chore_templates','chore_template_members','chore_completions','star_rewards','star_redemptions','meal_plans','lists','list_items'] loop
    execute format('create trigger cc_family_changed after insert or update or delete on public.%I for each row execute function public.cc_broadcast_family_change()',t);
  end loop;
end $$;
create policy cc_family_broadcast_read on realtime.messages for select to authenticated
  using (extension='broadcast' and (select realtime.topic()) = 'family:' || (select public.get_family_id())::text);
commit;
