create function public.cc_test_assert(p_ok boolean,p_name text) returns void language plpgsql as $$ begin if p_ok is not true then raise exception 'Assertion failed: %',p_name; end if; end $$;
create function public.cc_test_reject(p_sql text,p_message text) returns void language plpgsql as $$
begin
  begin execute p_sql;
  exception when others then
    if position(p_message in sqlerrm)=0 then raise exception 'Wrong failure: %',sqlerrm; end if;
    return;
  end;
  raise exception 'Expected rejection: %',p_message;
end $$;

select public.cc_test_assert((select sum(stars_earned)=10 from public.chore_completions),'legacy earnings preserved');
select public.cc_test_assert((select star_value=0 and category='expectation' from public.chore_templates limit 1),'005 expectations migrated');
select public.cc_test_assert(not has_table_privilege('authenticated','public.star_redemptions','insert'),'direct redemption denied');
select public.cc_test_assert(not has_table_privilege('authenticated','public.chore_completions','insert'),'direct earnings denied');
select public.cc_test_assert(not has_function_privilege('anon','public.cc_redeem_reward(uuid,uuid,uuid)','execute'),'anonymous RPC denied');
select public.cc_test_assert(not has_function_privilege('authenticated','public.cc_star_balance(uuid,uuid)','execute'),'private helpers denied');

set role authenticated;
set request.jwt.claim.sub = '10000000-0000-0000-0000-000000000001';
select public.cc_test_assert((select count(*)=2 from public.family_members),'family read isolation');
select public.cc_test_reject($q$select public.cc_complete_chore('40000000-0000-0000-0000-000000000001','30000000-0000-0000-0000-000000000004',(now() at time zone 'America/Chicago')::date)$q$,'unavailable in your family');
select public.cc_test_reject($q$select public.cc_complete_chore('40000000-0000-0000-0000-000000000001','30000000-0000-0000-0000-000000000002','2024-01-01')$q$,'current family day');
select public.cc_complete_chore('40000000-0000-0000-0000-000000000001','30000000-0000-0000-0000-000000000002',(now() at time zone 'America/Chicago')::date);
select public.cc_complete_chore('40000000-0000-0000-0000-000000000001','30000000-0000-0000-0000-000000000002',(now() at time zone 'America/Chicago')::date);
select public.cc_test_assert((select count(*)=1 from public.chore_completions where date=(now() at time zone 'America/Chicago')::date),'completion retry is idempotent');
select public.cc_test_assert((select sum(stars_earned)=10 from public.chore_completions),'expectations award no new stars');
select public.cc_patch_settings('{"weather_location":"Chicago"}');
select public.cc_patch_settings('{"meal_slots":{"snack":true},"time_zone":"America/Chicago"}');
select public.cc_test_assert((select settings->>'weather_location'='Chicago' and (settings->'meal_slots'->>'snack')::boolean and (settings->'meal_slots'->>'dinner')::boolean from public.families),'settings merge preserves other keys');
select public.cc_test_reject($q$select public.cc_patch_settings('{"pin_hash":"1234"}')$q$,'Unsupported setting');
select public.cc_test_reject($q$select public.cc_patch_settings('{"time_zone":"Not/AZone"}')$q$,'Invalid timezone');
select public.cc_test_reject($q$select public.cc_save_template('40000000-0000-0000-0000-000000000001','{"name":"Changed","emoji":"x","star_value":0,"category":"expectation","recurrence":{"type":"daily"},"is_special":false}',array['30000000-0000-0000-0000-000000000004']::uuid[])$q$,'your family');
select public.cc_test_assert((select name='Legacy chore' from public.chore_templates limit 1),'failed template transaction preserves name');
select public.cc_test_assert((select count(*)=1 from public.chore_template_members),'failed template transaction preserves assignments');
select public.cc_seed_lists();
select public.cc_seed_lists();
select public.cc_test_assert((select count(*)=3 from public.lists),'default seeding is idempotent');

-- Exercise the gate, same-day claim uniqueness, retry semantics and spent-star reversal.
begin;
insert into public.family_members(id,family_id,name,role) values('30000000-0000-0000-0000-000000000005','20000000-0000-0000-0000-000000000001','New child','child');
select public.cc_save_template('40000000-0000-0000-0000-000000000001',
  '{"name":"Legacy chore","emoji":"✅","star_value":0,"category":"expectation","recurrence":{"type":"daily"},"is_special":false}',
  array['30000000-0000-0000-0000-000000000002','30000000-0000-0000-0000-000000000005']::uuid[]);
select public.cc_save_template(null,
  '{"name":"Bonus","emoji":"⭐","star_value":4,"category":"extra_work","recurrence":{"type":"daily"},"is_special":false}',
  array[]::uuid[]) as job \gset
select public.cc_test_assert((public.cc_claim_job(:'job','30000000-0000-0000-0000-000000000005',(now() at time zone 'America/Chicago')::date)->>'reason')='locked','expectation gate enforced in database');
select public.cc_test_assert((public.cc_claim_job(:'job','30000000-0000-0000-0000-000000000002',(now() at time zone 'America/Chicago')::date)->>'ok')='true','claim pays template value');
select public.cc_test_assert((public.cc_claim_job(:'job','30000000-0000-0000-0000-000000000002',(now() at time zone 'America/Chicago')::date)->>'reason')='already_claimed','job may only be claimed once');
select public.cc_test_assert((select sum(stars_earned)=14 from public.chore_completions),'job award canonical');
insert into public.star_rewards(id,family_id,name,star_cost) values('60000000-0000-0000-0000-000000000002','20000000-0000-0000-0000-000000000001','Large reward',12);
select public.cc_redeem_reward('60000000-0000-0000-0000-000000000002','30000000-0000-0000-0000-000000000002','70000000-0000-0000-0000-000000000003');
select public.cc_redeem_reward('60000000-0000-0000-0000-000000000002','30000000-0000-0000-0000-000000000002','70000000-0000-0000-0000-000000000003');
select public.cc_test_assert((select count(*)=1 from public.star_redemptions),'redemption retry spends once');
select public.cc_test_reject(format('select public.cc_revoke_job(%L,%L)',:'job',(now() at time zone 'America/Chicago')::date),'already been spent');
rollback;

select public.cc_test_assert((select count(*)=0 from public.star_redemptions),'temporary accounting test rolled back');

set request.jwt.claim.sub = '10000000-0000-0000-0000-000000000003';
select public.cc_onboard('New parent','#123456','x','New family','1234');
select public.cc_onboard('New parent','#123456','x','New family','1234');
select public.cc_test_assert((select count(*)=1 from public.family_members where user_id=auth.uid()),'onboarding retry has one membership');
select public.cc_test_assert((select count(*)=3 from public.lists),'onboarding creates all starter lists');
reset role;
