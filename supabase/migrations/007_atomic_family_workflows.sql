begin;

create or replace function public.cc_patch_settings(p_patch jsonb) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare v_family uuid := public.cc_lock_family(); v_settings jsonb; v_key text; v_value jsonb;
begin
  if jsonb_typeof(p_patch) <> 'object' or p_patch is null then raise exception 'Invalid settings'; end if;
  select settings into v_settings from public.families where id = v_family;
  for v_key, v_value in select * from jsonb_each(p_patch) loop
    if v_key not in ('time_zone','weather_location','meal_slots','sleep_start','sleep_end','sleep_enabled','screensaver_enabled','screensaver_timeout_minutes') then
      raise exception 'Unsupported setting'; end if;
    if v_key = 'time_zone' and (jsonb_typeof(v_value) <> 'string' or not exists(select 1 from pg_catalog.pg_timezone_names where name = p_patch->>'time_zone')) then raise exception 'Invalid timezone'; end if;
    if v_key = 'weather_location' and (jsonb_typeof(v_value) <> 'string' or length(p_patch->>'weather_location') > 200) then raise exception 'Invalid weather location'; end if;
    if v_key in ('sleep_start','sleep_end') and (jsonb_typeof(v_value) <> 'string' or (p_patch->>v_key) !~ '^([01][0-9]|2[0-3]):[0-5][0-9]$') then raise exception 'Invalid sleep time'; end if;
    if v_key in ('sleep_enabled','screensaver_enabled') and jsonb_typeof(v_value) <> 'boolean' then raise exception 'Invalid toggle'; end if;
    if v_key = 'screensaver_timeout_minutes' and (jsonb_typeof(v_value) <> 'number' or (p_patch->>v_key)::numeric not between 1 and 60 or (p_patch->>v_key)::numeric <> trunc((p_patch->>v_key)::numeric)) then raise exception 'Invalid idle timeout'; end if;
    if v_key = 'meal_slots' then
      if jsonb_typeof(v_value) <> 'object' or exists(select 1 from jsonb_each(v_value) where key not in ('breakfast','lunch','dinner','snack') or jsonb_typeof(value) <> 'boolean') then raise exception 'Invalid meal slots'; end if;
      v_settings := jsonb_set(v_settings, '{meal_slots}', coalesce(v_settings->'meal_slots','{}'::jsonb) || v_value);
    else
      v_settings := jsonb_set(v_settings, array[v_key], v_value);
    end if;
  end loop;
  update public.families set settings = v_settings where id = v_family;
  return v_settings;
end $$;

create or replace function public.cc_save_template(p_template_id uuid, p_data jsonb, p_member_ids uuid[])
returns uuid language plpgsql security definer set search_path = '' as $$
declare v_family uuid := public.cc_lock_family(); v_id uuid := coalesce(p_template_id, gen_random_uuid()); v_category text := p_data->>'category'; v_recurrence jsonb := p_data->'recurrence';
begin
  if jsonb_typeof(p_data) is distinct from 'object'
    or length(trim(coalesce(p_data->>'name',''))) not between 1 and 200
    or length(coalesce(p_data->>'emoji','')) not between 1 and 32
    or v_category is null or v_category not in ('expectation','extra_work')
    or jsonb_typeof(p_data->'star_value') is distinct from 'number'
    or (p_data->>'star_value')::numeric <> trunc((p_data->>'star_value')::numeric)
    or jsonb_typeof(p_data->'is_special') is distinct from 'boolean'
    or jsonb_typeof(v_recurrence) is distinct from 'object'
    or coalesce(v_recurrence->>'type','') not in ('daily','weekdays','custom') then raise exception 'Invalid chore details'; end if;
  if v_recurrence->>'type' = 'custom' then
    if jsonb_typeof(v_recurrence->'days') is distinct from 'array' then raise exception 'Choose recurrence days'; end if;
    if jsonb_array_length(v_recurrence->'days') = 0 or exists(select 1 from jsonb_array_elements(v_recurrence->'days') d where jsonb_typeof(d) <> 'number' or d::text !~ '^[0-6]$') then raise exception 'Invalid recurrence days'; end if;
  end if;
  if cardinality(p_member_ids) > 100 or (v_category = 'extra_work' and cardinality(p_member_ids) > 0) then raise exception 'Invalid assignments'; end if;
  if exists(select 1 from unnest(p_member_ids) m where not exists(select 1 from public.family_members where id = m and family_id = v_family and role = 'child')) then raise exception 'Assignments must belong to children in your family'; end if;
  if p_template_id is not null then
    perform id from public.chore_templates where id = p_template_id and family_id = v_family for update;
    if not found then raise exception 'Chore unavailable in your family' using errcode = '42501'; end if;
    if exists(select 1 from public.chore_templates where id = p_template_id and category <> v_category) then raise exception 'Create a new chore to change its category'; end if;
    update public.chore_templates set name = trim(p_data->>'name'), emoji = p_data->>'emoji',
      star_value = (p_data->>'star_value')::integer, recurrence = v_recurrence, is_special = (p_data->>'is_special')::boolean where id = v_id;
  else
    insert into public.chore_templates(id,family_id,name,emoji,star_value,recurrence,category,is_special,active)
      values(v_id,v_family,trim(p_data->>'name'),p_data->>'emoji',(p_data->>'star_value')::integer,v_recurrence,v_category,(p_data->>'is_special')::boolean,true);
  end if;
  delete from public.chore_template_members where template_id = v_id;
  insert into public.chore_template_members(template_id,member_id) select v_id, m from (select distinct unnest(p_member_ids) m) ids;
  return v_id;
end $$;

create or replace function public.cc_archive_template(p_template_id uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare v_family uuid := public.cc_lock_family();
begin
  update public.chore_templates set active = false where id = p_template_id and family_id = v_family;
  if not found then raise exception 'Chore unavailable in your family'; end if;
end $$;

create or replace function public.cc_seed_lists() returns void
language plpgsql security definer set search_path = '' as $$
declare v_family uuid := public.cc_lock_family();
begin
  if not exists(select 1 from public.lists where family_id = v_family) then
    insert into public.lists(family_id,name,emoji,color,sort_order) values
      (v_family,'Grocery','🛒','#22c55e',0),(v_family,'To-Do','✏️','#6366f1',1),(v_family,'Shopping','🛍️','#f59e0b',2);
  end if;
end $$;

-- Atomic onboarding; preserves the existing invite/PIN scheme because items 1 and 4 are on hold.
-- The user advisory lock prevents duplicate retries without modifying existing memberships.
create or replace function public.cc_onboard(p_name text, p_color text, p_avatar text, p_family_name text, p_pin text, p_invite uuid default null)
returns uuid language plpgsql security definer set search_path = '' as $$
declare v_user uuid := auth.uid(); v_family uuid; v_count integer;
begin
  if v_user is null then raise exception 'Please sign in again' using errcode = '42501'; end if;
  perform pg_advisory_xact_lock(hashtextextended(v_user::text, 3721));
  select count(*), (array_agg(family_id))[1] into v_count, v_family from public.family_members where user_id = v_user;
  if v_count = 1 then return v_family; end if;
  if v_count > 1 then raise exception 'Family membership needs review'; end if;
  if length(trim(coalesce(p_name,''))) not between 1 and 100 or coalesce(p_color,'') !~ '^#[0-9a-fA-F]{6}$' or length(coalesce(p_avatar,'')) not between 1 and 32 then raise exception 'Invalid profile'; end if;
  if p_invite is not null then
    select id into v_family from public.families where id = p_invite for update;
    if not found then raise exception 'Invalid invite link'; end if;
  else
    if length(trim(coalesce(p_family_name,''))) not between 1 and 100 or coalesce(p_pin,'') !~ '^[0-9]{4}$' then raise exception 'Invalid family details'; end if;
    insert into public.families(name,settings) values(trim(p_family_name),jsonb_build_object(
      'time_zone','America/Chicago','sleep_start','22:00','sleep_end','06:00','sleep_enabled',false,
      'screensaver_enabled',false,'screensaver_timeout_minutes',5,'weather_location','','pin_hash',p_pin,
      'meal_slots',jsonb_build_object('breakfast',true,'lunch',true,'dinner',true,'snack',false))) returning id into v_family;
  end if;
  insert into public.family_members(family_id,user_id,name,color,avatar_emoji,role) values(v_family,v_user,trim(p_name),p_color,p_avatar,'parent');
  if p_invite is null then perform public.cc_seed_lists(); end if;
  return v_family;
end $$;

alter table public.meal_plans add column recipe_url text;
alter table public.meal_plans add column ingredients text[] not null default '{}';
alter table public.meal_plans add constraint cc_recipe_url check (recipe_url is null or (length(recipe_url) <= 2048 and recipe_url ~ '^https?://[^[:space:]]+$'));
alter table public.meal_plans add constraint cc_ingredients_count check (cardinality(ingredients) <= 100);

create table public.meal_grocery_transfers (
  family_id uuid not null references public.families(id) on delete cascade,
  request_id uuid not null,
  input_hash text not null,
  added_count integer not null,
  created_at timestamptz not null default now(),
  primary key(family_id, request_id)
);
alter table public.meal_grocery_transfers enable row level security;
revoke all on public.meal_grocery_transfers from anon, authenticated;

create or replace function public.cc_meal_to_list(p_meal_id uuid, p_list_id uuid, p_items text[], p_request_id uuid)
returns integer language plpgsql security definer set search_path = '' as $$
declare v_family uuid := public.cc_lock_family(); v_hash text := md5(p_meal_id::text || p_list_id::text || array_to_json(p_items)::text);
  v_prior public.meal_grocery_transfers; v_item text; v_added integer := 0; v_order integer;
begin
  if p_request_id is null or coalesce(cardinality(p_items),0) not between 1 and 100 then raise exception 'Choose 1–100 ingredients'; end if;
  select * into v_prior from public.meal_grocery_transfers where family_id = v_family and request_id = p_request_id;
  if found then
    if v_prior.input_hash is distinct from v_hash then raise exception 'Request ID already used'; end if;
    return v_prior.added_count;
  end if;
  perform id from public.meal_plans where id = p_meal_id and family_id = v_family;
  if not found then raise exception 'Meal unavailable in your family'; end if;
  perform id from public.lists where id = p_list_id and family_id = v_family for update;
  if not found then raise exception 'List unavailable in your family'; end if;
  select coalesce(max(sort_order),-1) into v_order from public.list_items where list_id = p_list_id;
  foreach v_item in array p_items loop
    v_item := trim(v_item);
    if v_item is null or length(v_item) not between 1 and 500 then raise exception 'Invalid ingredient'; end if;
    if not exists(select 1 from public.list_items where list_id = p_list_id and not checked and lower(trim(text)) = lower(v_item)) then
      v_order := v_order + 1;
      insert into public.list_items(list_id,family_id,text,sort_order) values(p_list_id,v_family,v_item,v_order);
      v_added := v_added + 1;
    end if;
  end loop;
  insert into public.meal_grocery_transfers values(v_family,p_request_id,v_hash,v_added,now());
  return v_added;
end $$;

revoke insert, update, delete on public.chore_templates, public.chore_template_members from anon, authenticated;
revoke all on function public.cc_patch_settings(jsonb), public.cc_save_template(uuid,jsonb,uuid[]),
  public.cc_archive_template(uuid), public.cc_seed_lists(), public.cc_onboard(text,text,text,text,text,uuid),
  public.cc_meal_to_list(uuid,uuid,text[],uuid) from public, anon, authenticated;
grant execute on function public.cc_patch_settings(jsonb), public.cc_save_template(uuid,jsonb,uuid[]),
  public.cc_archive_template(uuid), public.cc_seed_lists(), public.cc_onboard(text,text,text,text,text,uuid),
  public.cc_meal_to_list(uuid,uuid,text[],uuid) to authenticated;
commit;
