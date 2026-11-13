-- Requires 005. Keeps all existing earned/spent stars and deletion semantics.
-- New writes go through authenticated, family-scoped transactions. PIN/roles remain unchanged.
begin;

alter table public.chore_templates alter column star_value set default 0;
alter table public.chore_completions alter column stars_earned set default 0;

create unique index if not exists cc_members_id_family on public.family_members(id, family_id);
create unique index if not exists cc_templates_id_family on public.chore_templates(id, family_id);
create unique index if not exists cc_rewards_id_family on public.star_rewards(id, family_id);
create unique index if not exists cc_lists_id_family on public.lists(id, family_id);

-- Fail safely on existing cross-family inconsistencies; never silently rewrite history.
alter table public.chore_completions add constraint cc_completion_member_family
  foreign key (member_id, family_id) references public.family_members(id, family_id) on delete cascade;
alter table public.chore_completions add constraint cc_completion_template_family
  foreign key (template_id, family_id) references public.chore_templates(id, family_id) on delete cascade;
alter table public.star_redemptions add constraint cc_redemption_member_family
  foreign key (member_id, family_id) references public.family_members(id, family_id) on delete cascade;
alter table public.star_redemptions add constraint cc_redemption_reward_family
  foreign key (reward_id, family_id) references public.star_rewards(id, family_id) on delete cascade;
alter table public.list_items add constraint cc_item_list_family
  foreign key (list_id, family_id) references public.lists(id, family_id) on delete cascade;

create or replace function public.cc_family_id() returns uuid
language plpgsql stable security definer set search_path = '' as $$
declare v_family uuid; v_count integer;
begin
  if auth.uid() is null then raise exception 'Please sign in again' using errcode = '42501'; end if;
  select count(*), (array_agg(distinct family_id))[1] into v_count, v_family
    from public.family_members where user_id = auth.uid();
  if v_count <> 1 then raise exception 'Family membership could not be verified' using errcode = '42501'; end if;
  return v_family;
end $$;

create or replace function public.cc_lock_family() returns uuid
language plpgsql security definer set search_path = '' as $$
declare v_family uuid := public.cc_family_id();
begin
  perform id from public.families where id = v_family for update;
  return v_family;
end $$;

create or replace function public.cc_family_today(p_family uuid) returns date
language sql stable security definer set search_path = '' as $$
  select (now() at time zone coalesce(nullif(settings->>'time_zone', ''), 'America/Chicago'))::date
  from public.families where id = p_family;
$$;

create or replace function public.cc_star_balance(p_member uuid, p_family uuid) returns bigint
language sql stable security definer set search_path = '' as $$
  select coalesce((select sum(stars_earned) from public.chore_completions where member_id = p_member and family_id = p_family), 0)
       - coalesce((select sum(stars_spent) from public.star_redemptions where member_id = p_member and family_id = p_family), 0);
$$;

create or replace function public.cc_is_scheduled(p_recurrence jsonb, p_date date) returns boolean
language sql immutable set search_path = '' as $$
  select case p_recurrence->>'type'
    when 'daily' then true
    when 'weekdays' then extract(isodow from p_date) between 1 and 5
    when 'custom' then coalesce(p_recurrence->'days', '[]'::jsonb) @> to_jsonb(extract(dow from p_date)::integer)
    else false end;
$$;

create or replace function public.cc_complete_chore(p_template_id uuid, p_member_id uuid, p_date date)
returns public.chore_completions language plpgsql security definer set search_path = '' as $$
declare v_family uuid := public.cc_lock_family(); v_template public.chore_templates; v_row public.chore_completions;
begin
  if p_date is distinct from public.cc_family_today(v_family) then raise exception 'Refresh the page to use the current family day'; end if;
  perform id from public.family_members where id = p_member_id and family_id = v_family and role = 'child' and chores_enabled for share;
  if not found then raise exception 'This child is unavailable in your family' using errcode = '42501'; end if;
  select * into v_template from public.chore_templates where id = p_template_id and family_id = v_family for share;
  if not found or not v_template.active or v_template.category <> 'expectation'
    or not public.cc_is_scheduled(v_template.recurrence, p_date) then raise exception 'This expectation is not scheduled today'; end if;
  perform 1 from public.chore_template_members where template_id = p_template_id and member_id = p_member_id;
  if not found then raise exception 'This expectation is not assigned to that child'; end if;
  insert into public.chore_completions(template_id, member_id, family_id, date, stars_earned, category)
    values(p_template_id, p_member_id, v_family, p_date, 0, 'expectation')
    on conflict (template_id, member_id, date) do nothing returning * into v_row;
  if v_row.id is null then select * into v_row from public.chore_completions where template_id = p_template_id and member_id = p_member_id and date = p_date; end if;
  return v_row;
end $$;

create or replace function public.cc_uncomplete_chore(p_template_id uuid, p_member_id uuid, p_date date)
returns void language plpgsql security definer set search_path = '' as $$
declare v_family uuid := public.cc_lock_family();
begin
  if p_date is distinct from public.cc_family_today(v_family) then raise exception 'Only today’s expectations can be undone'; end if;
  delete from public.chore_completions where family_id = v_family and template_id = p_template_id
    and member_id = p_member_id and date = p_date and category = 'expectation' and stars_earned = 0;
end $$;

create or replace function public.cc_claim_job(p_template_id uuid, p_member_id uuid, p_date date)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_family uuid := public.cc_lock_family(); v_job public.chore_templates;
begin
  if p_date is distinct from public.cc_family_today(v_family) then raise exception 'Refresh the page to use the current family day'; end if;
  perform id from public.family_members where id = p_member_id and family_id = v_family and role = 'child' and chores_enabled for share;
  if not found then raise exception 'This child is unavailable in your family' using errcode = '42501'; end if;
  select * into v_job from public.chore_templates where id = p_template_id and family_id = v_family for share;
  if not found or not v_job.active or v_job.category <> 'extra_work' then return jsonb_build_object('ok', false, 'reason', 'unavailable'); end if;
  if exists(select 1 from public.chore_completions where template_id = p_template_id and date = p_date and category = 'extra_work') then
    return jsonb_build_object('ok', false, 'reason', 'already_claimed'); end if;
  if exists(select 1 from public.chore_templates t join public.chore_template_members tm on tm.template_id = t.id
    where tm.member_id = p_member_id and t.family_id = v_family and t.active and t.category = 'expectation'
      and public.cc_is_scheduled(t.recurrence, p_date)
      and not exists(select 1 from public.chore_completions c where c.template_id = t.id and c.member_id = p_member_id and c.date = p_date and c.category = 'expectation')) then
    return jsonb_build_object('ok', false, 'reason', 'locked'); end if;
  insert into public.chore_completions(template_id, member_id, family_id, date, stars_earned, category)
    values(p_template_id, p_member_id, v_family, p_date, v_job.star_value, 'extra_work');
  return jsonb_build_object('ok', true);
end $$;

create or replace function public.cc_revoke_job(p_template_id uuid, p_date date)
returns void language plpgsql security definer set search_path = '' as $$
declare v_family uuid := public.cc_lock_family(); v_claim public.chore_completions;
begin
  if p_date is distinct from public.cc_family_today(v_family) then raise exception 'Only today’s claims can be undone'; end if;
  select * into v_claim from public.chore_completions where family_id = v_family and template_id = p_template_id and date = p_date and category = 'extra_work' for update;
  if not found then return; end if;
  if public.cc_star_balance(v_claim.member_id, v_family) < v_claim.stars_earned then
    raise exception 'These stars have already been spent. This claim cannot be undone.'; end if;
  delete from public.chore_completions where id = v_claim.id;
end $$;

alter table public.star_redemptions add column request_id uuid;
create unique index cc_redemption_request on public.star_redemptions(family_id, request_id) where request_id is not null;

create or replace function public.cc_redeem_reward(p_reward_id uuid, p_member_id uuid, p_request_id uuid)
returns public.star_redemptions language plpgsql security definer set search_path = '' as $$
declare v_family uuid := public.cc_lock_family(); v_cost integer; v_row public.star_redemptions;
begin
  if p_request_id is null then raise exception 'A request ID is required'; end if;
  select * into v_row from public.star_redemptions where family_id = v_family and request_id = p_request_id;
  if found then
    if v_row.reward_id <> p_reward_id or v_row.member_id <> p_member_id then raise exception 'Request ID already used'; end if;
    return v_row;
  end if;
  perform id from public.family_members where id = p_member_id and family_id = v_family and role = 'child' for share;
  if not found then raise exception 'This child is unavailable in your family' using errcode = '42501'; end if;
  select star_cost into v_cost from public.star_rewards where id = p_reward_id and family_id = v_family for share;
  if not found or v_cost < 1 then raise exception 'This reward is unavailable'; end if;
  if public.cc_star_balance(p_member_id, v_family) < v_cost then raise exception 'Not enough stars for this reward'; end if;
  insert into public.star_redemptions(reward_id, member_id, family_id, stars_spent, request_id)
    values(p_reward_id, p_member_id, v_family, v_cost, p_request_id) returning * into v_row;
  return v_row;
end $$;

-- No browser may bypass the accounting transactions. Reads still use existing family RLS.
revoke insert, update, delete on public.chore_completions, public.star_redemptions from anon, authenticated;
revoke all on function public.cc_family_id(), public.cc_lock_family(), public.cc_family_today(uuid),
  public.cc_star_balance(uuid,uuid), public.cc_is_scheduled(jsonb,date),
  public.cc_complete_chore(uuid,uuid,date), public.cc_uncomplete_chore(uuid,uuid,date),
  public.cc_claim_job(uuid,uuid,date), public.cc_revoke_job(uuid,date), public.cc_redeem_reward(uuid,uuid,uuid)
  from public, anon, authenticated;
grant execute on function public.cc_complete_chore(uuid,uuid,date), public.cc_uncomplete_chore(uuid,uuid,date),
  public.cc_claim_job(uuid,uuid,date), public.cc_revoke_job(uuid,date), public.cc_redeem_reward(uuid,uuid,uuid) to authenticated;
commit;
