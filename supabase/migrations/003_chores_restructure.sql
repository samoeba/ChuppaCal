-- Add chores_enabled to family_members
alter table public.family_members
  add column if not exists chores_enabled boolean not null default true;

-- Drop old tables (completions first — FK dependency on assignments)
drop table if exists public.chore_completions;
drop table if exists public.chore_assignments;

-- Recreate completions keyed on (template_id, member_id, date)
create table public.chore_completions (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families(id) on delete cascade,
  template_id uuid not null references public.chore_templates(id) on delete cascade,
  member_id uuid not null references public.family_members(id) on delete cascade,
  date date not null,
  stars_earned int not null default 1,
  completed_at timestamptz not null default now()
);

create unique index idx_chore_completions_unique
  on public.chore_completions(template_id, member_id, date);

create index idx_chore_completions_family_date
  on public.chore_completions(family_id, date);

-- Template-to-member join (replaces chore_assignments for membership)
create table public.chore_template_members (
  template_id uuid not null references public.chore_templates(id) on delete cascade,
  member_id uuid not null references public.family_members(id) on delete cascade,
  primary key (template_id, member_id)
);

-- RLS: chore_completions
alter table public.chore_completions enable row level security;

create policy "family read completions"
  on public.chore_completions for select
  using (family_id = (select family_id from public.family_members where user_id = auth.uid() limit 1));

create policy "family insert completions"
  on public.chore_completions for insert
  with check (family_id = (select family_id from public.family_members where user_id = auth.uid() limit 1));

create policy "family delete completions"
  on public.chore_completions for delete
  using (family_id = (select family_id from public.family_members where user_id = auth.uid() limit 1));

-- RLS: chore_template_members
alter table public.chore_template_members enable row level security;

create policy "family read template members"
  on public.chore_template_members for select
  using (
    template_id in (
      select id from public.chore_templates
      where family_id = (select family_id from public.family_members where user_id = auth.uid() limit 1)
    )
  );

create policy "family manage template members"
  on public.chore_template_members for all
  using (
    template_id in (
      select id from public.chore_templates
      where family_id = (select family_id from public.family_members where user_id = auth.uid() limit 1)
    )
  );
