begin;

-- Nullable additions preserve existing recipes and plans. HTML is read on demand.
alter table public.meal_recipes
  add column instructions_html text,
  add column instructions_html_name text,
  add constraint meal_recipes_html_check check (
    (instructions_html is null and instructions_html_name is null) or
    (instructions_html is not null and instructions_html_name is not null
      and octet_length(instructions_html) between 1 and 524288
      and length(instructions_html_name) between 1 and 200)
  );
alter table public.meal_plans
  add column instructions_html text,
  add column instructions_html_name text,
  add constraint meal_plans_html_check check (
    (instructions_html is null and instructions_html_name is null) or
    (instructions_html is not null and instructions_html_name is not null
      and octet_length(instructions_html) between 1 and 524288
      and length(instructions_html_name) between 1 and 200)
  );

-- Snapshot every recipe field atomically so library edits leave planned meals intact.
create function public.cc_plan_saved_recipe(p_recipe_id uuid, p_date date, p_slot text)
returns public.meal_plans
language plpgsql security invoker set search_path = '' as $$
declare
  v_family uuid := public.get_family_id();
  v_meal public.meal_plans;
begin
  if v_family is null then raise exception 'Family membership could not be verified'; end if;
  insert into public.meal_plans (
    family_id, date, slot, name, emoji, recipe_url, ingredients, instructions,
    instructions_html, instructions_html_name
  )
  select family_id, p_date, p_slot, name, emoji, recipe_url, ingredients, instructions,
    instructions_html, instructions_html_name
  from public.meal_recipes where id = p_recipe_id and family_id = v_family
  on conflict (family_id, date, slot) do update set
    name = excluded.name, emoji = excluded.emoji, recipe_url = excluded.recipe_url,
    ingredients = excluded.ingredients, instructions = excluded.instructions,
    instructions_html = excluded.instructions_html, instructions_html_name = excluded.instructions_html_name
  returning * into v_meal;
  if v_meal.id is null then raise exception 'Recipe is unavailable in your family'; end if;
  return v_meal;
end $$;

revoke all on function public.cc_plan_saved_recipe(uuid, date, text) from public, anon, authenticated;
grant execute on function public.cc_plan_saved_recipe(uuid, date, text) to authenticated;

commit;
