begin;

select public.cc_test_assert(not has_table_privilege('anon', 'public.meal_recipes', 'select'), 'recipe bank requires sign-in');
set local role authenticated;
set local request.jwt.claim.sub = '10000000-0000-0000-0000-000000000001';
select public.cc_test_assert((select count(*)=1 from public.meal_recipes), 'one saved recipe per name and family, excluding meals without recipe details');
select public.cc_test_assert((select name='CHILI' and ingredients=array['Beans'] and emoji='🥣' and recipe_url='https://example.com/chili' from public.meal_recipes), 'backfill uses latest meal with details');

select public.cc_set_meal_and_recipe('2026-09-20', 'dinner', 'Chili', null, null, array['Beans', 'Tomatoes']);
select public.cc_set_meal_and_recipe('2026-09-20', 'dinner', 'Chili', null, null, array['Beans', 'Tomatoes']);
select public.cc_test_assert((select count(*)=1 from public.meal_recipes where ingredients=array['Beans', 'Tomatoes']), 'saving a recipe updates the matching name without duplicates');
select public.cc_test_assert((select count(*)=1 from public.meal_plans where date='2026-09-20' and ingredients=array['Beans', 'Tomatoes']), 'scheduled meal stores the same ingredients');
select public.cc_test_reject($q$select public.cc_set_meal_and_recipe('2026-09-20', 'dinner', '', null, null, '{}')$q$, 'meal_recipes_name_check');
select public.cc_test_assert((select name='Chili' from public.meal_plans where date='2026-09-20' and slot='dinner'), 'recipe failure rolls back the meal update');

select public.cc_test_reject($q$insert into public.meal_recipes (family_id, name) values ('20000000-0000-0000-0000-000000000002', 'Other family')$q$, 'row-level security');
set local request.jwt.claim.sub = '10000000-0000-0000-0000-000000000002';
select public.cc_test_assert((select count(*)=1 from public.meal_recipes where ingredients=array['Peppers']), 'another family keeps its own recipe with the same name');

rollback;
