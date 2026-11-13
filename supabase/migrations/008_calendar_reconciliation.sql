begin;
alter table public.calendar_connections
  add column last_sync_attempt_at timestamptz,
  add column last_sync_error text,
  add column sync_version bigint not null default 0,
  add column sync_lock_until timestamptz,
  add column sync_lock_token uuid;

-- Only the server worker may lease, apply snapshots, or write worker status.
create function public.cc_claim_calendar_sync(p_id uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare c public.calendar_connections;
begin
  select * into c from public.calendar_connections where id = p_id for update;
  if not found or c.sync_lock_until > now() or c.last_sync_attempt_at > now() - interval '30 seconds' then return null; end if;
  update public.calendar_connections set sync_lock_token = gen_random_uuid(), sync_lock_until = now() + interval '90 seconds',
    last_sync_attempt_at = now() where id = p_id returning * into c;
  return to_jsonb(c);
end $$;

create function public.cc_apply_calendar_snapshot(p_id uuid, p_token uuid, p_version bigint,
  p_start timestamptz, p_end timestamptz, p_events jsonb, p_credentials jsonb default null) returns integer
language plpgsql security definer set search_path = '' as $$
declare c public.calendar_connections; v_count integer;
begin
  select * into c from public.calendar_connections where id = p_id for update;
  if not found or c.sync_lock_token is distinct from p_token or c.sync_version <> p_version or c.sync_lock_until < now() then
    raise exception 'Calendar changed during sync; retry required'; end if;
  if p_token is null or p_start is null or p_end is null or p_end <= p_start or p_end - p_start > interval '100 days'
    or jsonb_typeof(p_events) is distinct from 'array' then raise exception 'Invalid calendar snapshot'; end if;
  if jsonb_array_length(p_events) > 100000 then raise exception 'Calendar snapshot too large'; end if;
  if exists(select 1 from jsonb_to_recordset(p_events) e(external_id text,title text,start_time timestamptz,end_time timestamptz,all_day boolean)
    where coalesce(external_id,'') = '' or title is null or start_time is null or end_time is null or end_time < start_time or all_day is null) then raise exception 'Invalid calendar event'; end if;
  insert into public.calendar_events(family_id,connection_id,member_id,external_id,title,start_time,end_time,location,all_day,synced_at)
    select c.family_id,c.id,c.member_id,external_id,title,start_time,end_time,location,all_day,now()
    from jsonb_to_recordset(p_events) e(external_id text,title text,start_time timestamptz,end_time timestamptz,location text,all_day boolean)
    on conflict(connection_id,external_id) do update set member_id=excluded.member_id,title=excluded.title,start_time=excluded.start_time,
      end_time=excluded.end_time,location=excluded.location,all_day=excluded.all_day,synced_at=excluded.synced_at;
  get diagnostics v_count = row_count;
  -- A complete window is authoritative even when recurring instances disappeared or moved away.
  -- Google evaluates all-day bounds in the calendar's zone. Keep a one-day margin at each
  -- edge for those civil values so a UTC/calendar-zone mismatch cannot remove valid events.
  delete from public.calendar_events e where e.connection_id = c.id
    and ((not e.all_day and e.start_time < p_end and e.end_time > p_start)
      or (e.all_day and e.start_time < p_end - interval '1 day' and e.end_time > p_start + interval '1 day'))
    and not exists(select 1 from jsonb_array_elements(p_events) j where j->>'external_id' = e.external_id);
  update public.calendar_connections set credentials=coalesce(p_credentials,credentials),last_synced_at=now(),last_sync_error=null,
    sync_lock_until=null,sync_lock_token=null where id = c.id;
  return v_count;
end $$;

create function public.cc_calendar_sync_error(p_id uuid,p_token uuid,p_error text) returns void
language sql security definer set search_path = '' as $$
  update public.calendar_connections set last_sync_error=left(p_error,300),sync_lock_until=null,sync_lock_token=null
    where id=p_id and sync_lock_token=p_token;
$$;

create function public.cc_update_calendar(p_id uuid,p_member_id uuid,p_calendar_id text,p_calendar_name text) returns void
language plpgsql security definer set search_path = '' as $$
declare v_family uuid := public.cc_lock_family(); c public.calendar_connections;
begin
  select * into c from public.calendar_connections where id=p_id and family_id=v_family for update;
  if not found then raise exception 'Calendar unavailable in your family'; end if;
  if not exists(select 1 from public.family_members where id=p_member_id and family_id=v_family) then raise exception 'Member unavailable in your family'; end if;
  if length(coalesce(p_calendar_id,'')) not between 1 and 1024 or length(coalesce(p_calendar_name,'')) not between 1 and 1024 then raise exception 'Invalid calendar details'; end if;
  if c.calendar_external_id is distinct from p_calendar_id then
    delete from public.calendar_events where connection_id=c.id;
  else
    update public.calendar_events set member_id=p_member_id where connection_id=c.id;
  end if;
  update public.calendar_connections set member_id=p_member_id,calendar_external_id=p_calendar_id,calendar_name=p_calendar_name,
    last_synced_at=case when calendar_external_id is distinct from p_calendar_id then null else last_synced_at end,
    last_sync_attempt_at=null,last_sync_error=null,sync_version=sync_version+1,sync_lock_until=null,sync_lock_token=null where id=c.id;
end $$;

create function public.cc_reconnect_google(p_id uuid,p_family_id uuid,p_credentials jsonb) returns void
language plpgsql security definer set search_path = '' as $$
begin
  update public.calendar_connections set credentials=p_credentials,last_sync_error=null,last_sync_attempt_at=null,
    sync_version=sync_version+1,sync_lock_until=null,sync_lock_token=null where id=p_id and family_id=p_family_id and provider='google';
  if not found then raise exception 'Calendar unavailable'; end if;
end $$;

revoke all on function public.cc_claim_calendar_sync(uuid),public.cc_apply_calendar_snapshot(uuid,uuid,bigint,timestamptz,timestamptz,jsonb,jsonb),
  public.cc_calendar_sync_error(uuid,uuid,text),public.cc_reconnect_google(uuid,uuid,jsonb),public.cc_update_calendar(uuid,uuid,text,text) from public,anon,authenticated;
grant execute on function public.cc_claim_calendar_sync(uuid),public.cc_apply_calendar_snapshot(uuid,uuid,bigint,timestamptz,timestamptz,jsonb,jsonb),
  public.cc_calendar_sync_error(uuid,uuid,text),public.cc_reconnect_google(uuid,uuid,jsonb) to service_role;
grant execute on function public.cc_update_calendar(uuid,uuid,text,text) to authenticated;
commit;
