begin;

alter table public.meal_recipes add column instructions text check (length(instructions) <= 20000);
alter table public.meal_plans add column instructions text check (length(instructions) <= 20000);

-- Keep the six-argument RPC for existing clients. Its updates leave instructions intact.
create function public.cc_set_meal_and_recipe(
  p_date date, p_slot text, p_name text, p_emoji text, p_recipe_url text,
  p_ingredients text[], p_instructions text
) returns public.meal_plans
language plpgsql security invoker set search_path = '' as $$
declare
  v_meal public.meal_plans;
begin
  -- Reuse the original atomic upsert and its family check.
  select * into v_meal from public.cc_set_meal_and_recipe(
    p_date, p_slot, p_name, p_emoji, p_recipe_url, p_ingredients
  );

  update public.meal_plans set instructions = p_instructions
  where id = v_meal.id returning * into v_meal;

  -- A meal without instructions can still update the recipe's other details.
  if p_instructions is not null then
    update public.meal_recipes set instructions = p_instructions
    where family_id = v_meal.family_id and lower(btrim(name)) = lower(btrim(p_name));
  end if;

  return v_meal;
end $$;

revoke all on function public.cc_set_meal_and_recipe(date, text, text, text, text, text[], text) from public, anon, authenticated;
grant execute on function public.cc_set_meal_and_recipe(date, text, text, text, text, text[], text) to authenticated;

commit;
