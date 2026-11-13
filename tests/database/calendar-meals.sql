-- Private sync endpoints must never be callable using the browser's authenticated role.
select public.cc_test_assert(not has_function_privilege('authenticated','public.cc_claim_calendar_sync(uuid)','execute'),'sync lease is server-only');
insert into public.calendar_connections(id,family_id,member_id,provider,credentials,calendar_external_id,calendar_name)
values('80000000-0000-0000-0000-000000000001','20000000-0000-0000-0000-000000000001','30000000-0000-0000-0000-000000000001','google','{}','primary','Fixture');
insert into public.calendar_events(family_id,connection_id,external_id,title,start_time,end_time) values
('20000000-0000-0000-0000-000000000001','80000000-0000-0000-0000-000000000001','stale-instance','Cancelled instance','2026-09-20T12:00:00Z','2026-09-20T13:00:00Z'),
('20000000-0000-0000-0000-000000000001','80000000-0000-0000-0000-000000000001','outside-window','Old history','2025-09-20T12:00:00Z','2025-09-20T13:00:00Z');
select (public.cc_claim_calendar_sync('80000000-0000-0000-0000-000000000001')->>'sync_lock_token') as token \gset
select public.cc_test_assert(public.cc_claim_calendar_sync('80000000-0000-0000-0000-000000000001') is null,'duplicate worker cannot lease same connection');
select public.cc_apply_calendar_snapshot('80000000-0000-0000-0000-000000000001',:'token',0,'2026-09-01','2026-10-01','[]');
select public.cc_test_assert((select count(*)=1 and min(external_id)='outside-window' from public.calendar_events),'snapshot removes disappeared instance and retains history outside window');

update public.calendar_connections set last_sync_attempt_at=null;
select (public.cc_claim_calendar_sync('80000000-0000-0000-0000-000000000001')->>'sync_lock_token') as old_token \gset
set role authenticated;
set request.jwt.claim.sub = '10000000-0000-0000-0000-000000000001';
select public.cc_update_calendar('80000000-0000-0000-0000-000000000001','30000000-0000-0000-0000-000000000002','another','Another calendar');
select public.cc_test_assert((select count(*)=0 from public.calendar_events),'changing selection clears old mirror');
reset role;
select public.cc_test_reject(format('select public.cc_apply_calendar_snapshot(%L,%L,0,%L,%L,%L)',
  '80000000-0000-0000-0000-000000000001',:'old_token','2026-09-01','2026-10-01','[]'),'Calendar changed during sync');
select (public.cc_claim_calendar_sync('80000000-0000-0000-0000-000000000001')->>'sync_lock_token') as token \gset
select public.cc_test_reject(format('select public.cc_apply_calendar_snapshot(%L,%L,1,%L,%L,%L)',
  '80000000-0000-0000-0000-000000000001',:'token','2026-09-01','2026-10-01','[{"external_id":"bad","title":"Bad","start_time":"2026-09-20","end_time":"2026-09-19","all_day":false}]'),'Invalid calendar event');
select public.cc_test_assert((select count(*)=0 from public.calendar_events),'invalid snapshot cannot partially apply');
select public.cc_apply_calendar_snapshot('80000000-0000-0000-0000-000000000001',:'token',1,'2026-09-01','2026-10-01',
  '[{"external_id":"new","title":"New","start_time":"2026-09-20T12:00:00Z","end_time":"2026-09-20T13:00:00Z","all_day":false,"family_id":"20000000-0000-0000-0000-000000000002"}]');
select public.cc_test_assert((select family_id='20000000-0000-0000-0000-000000000001' and member_id='30000000-0000-0000-0000-000000000002' from public.calendar_events),'snapshot derives family and member from current connection');

set role authenticated;
set request.jwt.claim.sub = '10000000-0000-0000-0000-000000000001';
insert into public.meal_plans(id,family_id,date,slot,name,ingredients) values('90000000-0000-0000-0000-000000000001','20000000-0000-0000-0000-000000000001','2026-09-27','dinner','Pasta',array['Pasta','Tomatoes']);
select id as grocery from public.lists where name='Grocery' \gset
select public.cc_test_assert(public.cc_meal_to_list('90000000-0000-0000-0000-000000000001',:'grocery',array['Pasta','Tomatoes','pasta'],'91000000-0000-0000-0000-000000000001')=2,'ingredient transfer deduplicates unchecked items');
select public.cc_meal_to_list('90000000-0000-0000-0000-000000000001',:'grocery',array['Pasta','Tomatoes','pasta'],'91000000-0000-0000-0000-000000000001');
select public.cc_test_assert((select count(*)=2 from public.list_items),'ingredient retry does not duplicate');
select public.cc_test_reject(format('select public.cc_meal_to_list(%L,%L,array[%L,%L],%L)',
  '90000000-0000-0000-0000-000000000001',:'grocery','Cheese','',gen_random_uuid()),'Invalid ingredient');
select public.cc_test_assert((select count(*)=2 from public.list_items),'invalid ingredient rolls back preceding inserts');
reset role;
