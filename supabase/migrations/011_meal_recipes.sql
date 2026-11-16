begin;

create table public.meal_recipes (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families(id) on delete cascade,
  name text not null check (length(btrim(name)) between 1 and 200),
  emoji text check (length(emoji) between 1 and 32),
  recipe_url text check (recipe_url is null or (length(recipe_url) <= 2048 and recipe_url ~ '^https?://[^[:space:]]+$')),
  ingredients text[] not null default '{}' check (cardinality(ingredients) <= 100)
);

create unique index meal_recipes_family_name on public.meal_recipes (family_id, lower(btrim(name)));

-- Start with the most recent planned meal with recipe details for each name.
insert into public.meal_recipes (family_id, name, emoji, recipe_url, ingredients)
select distinct on (family_id, lower(btrim(name))) family_id, btrim(name), emoji, recipe_url, ingredients
from public.meal_plans
where (recipe_url is not null or cardinality(ingredients) > 0)
  and length(btrim(name)) between 1 and 200
  and (emoji is null or length(emoji) between 1 and 32)
order by family_id, lower(btrim(name)), date desc, created_at desc, id desc;

alter table public.meal_recipes enable row level security;
revoke all on public.meal_recipes from public, anon, authenticated;
grant select, insert, update on public.meal_recipes to authenticated;
create policy "Family access" on public.meal_recipes for all to authenticated
  using (family_id = (select public.get_family_id()))
  with check (family_id = (select public.get_family_id()));

create trigger cc_family_changed after insert or update or delete on public.meal_recipes
  for each row execute function public.cc_broadcast_family_change();

-- Both writes succeed together. Retrying updates the same slot and recipe name.
create function public.cc_set_meal_and_recipe(
  p_date date, p_slot text, p_name text, p_emoji text, p_recipe_url text, p_ingredients text[]
) returns public.meal_plans
language plpgsql security invoker set search_path = '' as $$
declare
  v_family uuid := public.get_family_id();
  v_meal public.meal_plans;
begin
  if v_family is null then raise exception 'Family membership could not be verified'; end if;

  insert into public.meal_plans (family_id, date, slot, name, emoji, recipe_url, ingredients)
  values (v_family, p_date, p_slot, p_name, p_emoji, p_recipe_url, p_ingredients)
  on conflict (family_id, date, slot) do update
    set name = excluded.name, emoji = excluded.emoji, recipe_url = excluded.recipe_url, ingredients = excluded.ingredients
  returning * into v_meal;

  insert into public.meal_recipes (family_id, name, emoji, recipe_url, ingredients)
  values (v_family, p_name, p_emoji, p_recipe_url, p_ingredients)
  on conflict (family_id, lower(btrim(name))) do update
    set name = excluded.name, emoji = excluded.emoji, recipe_url = excluded.recipe_url, ingredients = excluded.ingredients;

  return v_meal;
end $$;

revoke all on function public.cc_set_meal_and_recipe(date, text, text, text, text, text[]) from public, anon, authenticated;
grant execute on function public.cc_set_meal_and_recipe(date, text, text, text, text, text[]) to authenticated;

commit;
