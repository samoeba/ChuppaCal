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

select public.cc_test_assert((select instructions is null from public.meal_recipes where name='Chili'), 'pre-migration recipe has optional instructions');
select public.cc_test_assert((select name=' CHILI ' and instructions is null from public.meal_plans where date='2026-09-15'), 'pre-migration meal is intact');

insert into public.meal_recipes (family_id, name, recipe_url, ingredients, instructions)
values (public.get_family_id(), 'Soup', 'https://example.com/soup', array['Broth'], E'Heat broth.\nServe.');
select public.cc_test_assert(not exists (select 1 from public.meal_plans where name='Soup'), 'recipe can be saved without scheduling');
update public.meal_recipes set instructions=E'Heat broth.\nAdd beans.' where name='Soup';
insert into public.meal_plans (family_id, date, slot, name, recipe_url, ingredients, instructions)
select family_id, '2026-09-23', 'dinner', name, recipe_url, ingredients, instructions
from public.meal_recipes where name='Soup';
update public.meal_recipes set instructions=null where name='Soup';
select public.cc_test_assert((select recipe_url='https://example.com/soup' and ingredients=array['Broth'] and instructions=E'Heat broth.\nAdd beans.' from public.meal_plans where date='2026-09-23'), 'planned copy retains recipe details after library edits');

select public.cc_set_meal_and_recipe('2026-09-20', 'dinner', 'Chili', null, null, array['Beans'], 'Simmer.');
select public.cc_test_assert((select instructions='Simmer.' from public.meal_plans where date='2026-09-20'), 'atomic save sets planned instructions');
select public.cc_set_meal_and_recipe('2026-09-20', 'dinner', 'Chili', null, null, array['Beans']);
select public.cc_test_assert((select instructions='Simmer.' from public.meal_recipes where name='Chili'), 'older RPC preserves recipe instructions');
select public.cc_test_assert((select instructions='Simmer.' from public.meal_plans where date='2026-09-20'), 'older RPC preserves meal instructions');
select public.cc_test_reject($q$select public.cc_set_meal_and_recipe('2026-09-20', 'dinner', 'Chili', null, null, array['Peppers'], repeat('x', 20001))$q$, 'meal_plans_instructions_check');
select public.cc_test_assert((select ingredients=array['Beans'] from public.meal_recipes where name='Chili'), 'invalid instructions roll back recipe changes');

update public.meal_recipes set instructions_html='<h1>Simmer</h1>', instructions_html_name='chili.html' where name='Chili';
select public.cc_plan_saved_recipe((select id from public.meal_recipes where name='Chili'), '2026-09-24', 'dinner');
update public.meal_recipes set instructions_html=null, instructions_html_name=null where name='Chili';
select public.cc_test_assert((select instructions_html='<h1>Simmer</h1>' and instructions_html_name='chili.html' and ingredients=array['Beans'] from public.meal_plans where date='2026-09-24'), 'planned visual instructions survive replacement or removal from the library');
select public.cc_test_reject($q$update public.meal_recipes set instructions_html='<p>Incomplete</p>' where name='Chili'$q$, 'meal_recipes_html_check');
select public.cc_test_reject($q$update public.meal_recipes set instructions_html=repeat('x',524289), instructions_html_name='big.html' where name='Chili'$q$, 'meal_recipes_html_check');
select public.cc_test_reject($q$select public.cc_plan_saved_recipe('ffffffff-ffff-ffff-ffff-ffffffffffff', '2026-09-24', 'dinner')$q$, 'unavailable in your family');

select public.cc_test_reject($q$insert into public.meal_recipes (family_id, name) values ('20000000-0000-0000-0000-000000000002', 'Other family')$q$, 'row-level security');
set local request.jwt.claim.sub = '10000000-0000-0000-0000-000000000002';
select public.cc_test_assert((select count(*)=1 from public.meal_recipes where ingredients=array['Peppers']), 'another family keeps its own recipe with the same name');

select public.cc_test_assert(not exists (select 1 from public.meal_recipes where name='Soup'), 'another family cannot see unscheduled recipes');
with changed as (update public.meal_recipes set instructions='Outside edit' where name='Soup' returning id)
select public.cc_test_assert(not exists (select 1 from changed), 'another family cannot edit unscheduled recipes');

select public.cc_test_assert(not exists (select 1 from public.meal_plans where instructions_html_name='chili.html'), 'planned HTML is private to its family');

rollback;
