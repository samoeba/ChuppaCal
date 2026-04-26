-- Family Calendar: Initial Schema
-- Run this in Supabase SQL Editor to set up all tables + RLS policies.

-- ============================================================
-- Tables (created first so the helper function can reference them)
-- ============================================================

-- Families
create table public.families (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  settings jsonb not null default '{
    "sleep_start": "22:00",
    "sleep_end": "06:00",
    "weather_location": "",
    "screensaver_timeout_minutes": 5,
    "meal_slots": { "breakfast": true, "lunch": true, "dinner": true, "snack": false },
    "pin_hash": null
  }'::jsonb,
  created_at timestamptz not null default now()
);

-- Family members
create table public.family_members (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families(id) on delete cascade,
  user_id uuid references auth.users(id) on delete set null,  -- null for kids
  name text not null,
  color text not null default '#4ecdc4',
  avatar_emoji text not null default '👤',
  avatar_url text,
  role text not null check (role in ('parent', 'child')) default 'child',
  created_at timestamptz not null default now()
);

create index idx_family_members_family on public.family_members(family_id);
create index idx_family_members_user on public.family_members(user_id);

-- Calendar connections
create table public.calendar_connections (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families(id) on delete cascade,
  member_id uuid not null references public.family_members(id) on delete cascade,
  provider text not null check (provider in ('google', 'caldav')),
  credentials jsonb not null default '{}',
  calendar_external_id text,
  calendar_name text,
  last_synced_at timestamptz,
  created_at timestamptz not null default now()
);

create index idx_calendar_connections_family on public.calendar_connections(family_id);

-- Calendar events
create table public.calendar_events (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families(id) on delete cascade,
  connection_id uuid references public.calendar_connections(id) on delete cascade,
  member_id uuid references public.family_members(id) on delete set null,
  external_id text,
  title text not null,
  start_time timestamptz not null,
  end_time timestamptz not null,
  location text,
  all_day boolean not null default false,
  synced_at timestamptz not null default now()
);

create index idx_calendar_events_family on public.calendar_events(family_id);
create index idx_calendar_events_time on public.calendar_events(family_id, start_time, end_time);
create unique index idx_calendar_events_external on public.calendar_events(connection_id, external_id)
  where external_id is not null;

-- Chore templates
create table public.chore_templates (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families(id) on delete cascade,
  name text not null,
  emoji text not null default '✅',
  star_value int not null default 1 check (star_value between 1 and 3),
  recurrence jsonb not null default '{"type": "daily"}'::jsonb,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create index idx_chore_templates_family on public.chore_templates(family_id);

-- Chore assignments (which kid has which chore on which day)
create table public.chore_assignments (
  id uuid primary key default gen_random_uuid(),
  template_id uuid not null references public.chore_templates(id) on delete cascade,
  member_id uuid not null references public.family_members(id) on delete cascade,
  family_id uuid not null references public.families(id) on delete cascade,
  date date not null,
  created_at timestamptz not null default now()
);

create index idx_chore_assignments_family_date on public.chore_assignments(family_id, date);
create unique index idx_chore_assignments_unique on public.chore_assignments(template_id, member_id, date);

-- Chore completions
create table public.chore_completions (
  id uuid primary key default gen_random_uuid(),
  assignment_id uuid not null references public.chore_assignments(id) on delete cascade,
  family_id uuid not null references public.families(id) on delete cascade,
  completed_at timestamptz not null default now(),
  stars_earned int not null default 1,
  verified_by uuid references public.family_members(id) on delete set null
);

create index idx_chore_completions_family on public.chore_completions(family_id);
create unique index idx_chore_completions_assignment on public.chore_completions(assignment_id);

-- Star rewards
create table public.star_rewards (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families(id) on delete cascade,
  name text not null,
  star_cost int not null check (star_cost > 0),
  emoji text default '🎁',
  created_at timestamptz not null default now()
);

create index idx_star_rewards_family on public.star_rewards(family_id);

-- Star redemptions
create table public.star_redemptions (
  id uuid primary key default gen_random_uuid(),
  reward_id uuid not null references public.star_rewards(id) on delete cascade,
  member_id uuid not null references public.family_members(id) on delete cascade,
  family_id uuid not null references public.families(id) on delete cascade,
  redeemed_at timestamptz not null default now(),
  stars_spent int not null check (stars_spent > 0)
);

create index idx_star_redemptions_family on public.star_redemptions(family_id);

-- Meal plans
create table public.meal_plans (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families(id) on delete cascade,
  date date not null,
  slot text not null check (slot in ('breakfast', 'lunch', 'dinner', 'snack')),
  name text not null,
  emoji text,
  created_at timestamptz not null default now()
);

create index idx_meal_plans_family_date on public.meal_plans(family_id, date);
create unique index idx_meal_plans_unique on public.meal_plans(family_id, date, slot);

-- Lists
create table public.lists (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families(id) on delete cascade,
  name text not null,
  emoji text not null default '📝',
  color text not null default '#6366f1',
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);

create index idx_lists_family on public.lists(family_id);

-- List items
create table public.list_items (
  id uuid primary key default gen_random_uuid(),
  list_id uuid not null references public.lists(id) on delete cascade,
  family_id uuid not null references public.families(id) on delete cascade,
  text text not null,
  checked boolean not null default false,
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);

create index idx_list_items_list on public.list_items(list_id);
create index idx_list_items_family on public.list_items(family_id);

-- Photos
create table public.photos (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families(id) on delete cascade,
  storage_path text not null,
  uploaded_by uuid references public.family_members(id) on delete set null,
  uploaded_at timestamptz not null default now()
);

create index idx_photos_family on public.photos(family_id);

-- ============================================================
-- Helper function: get family_id for the current authenticated user
-- (created after tables exist so the reference resolves)
-- ============================================================
create or replace function public.get_family_id()
returns uuid
language sql
stable
security definer
as $$
  select family_id from public.family_members
  where user_id = auth.uid()
  limit 1;
$$;

-- ============================================================
-- Row-Level Security Policies
-- ============================================================

alter table public.families enable row level security;
alter table public.family_members enable row level security;
alter table public.calendar_connections enable row level security;
alter table public.calendar_events enable row level security;
alter table public.chore_templates enable row level security;
alter table public.chore_assignments enable row level security;
alter table public.chore_completions enable row level security;
alter table public.star_rewards enable row level security;
alter table public.star_redemptions enable row level security;
alter table public.meal_plans enable row level security;
alter table public.lists enable row level security;
alter table public.list_items enable row level security;
alter table public.photos enable row level security;

-- Families: users can only access their own family
create policy "Users can view their family"
  on public.families for select
  using (id = public.get_family_id());

create policy "Users can update their family"
  on public.families for update
  using (id = public.get_family_id());

create policy "Authenticated users can create a family"
  on public.families for insert
  with check (auth.uid() is not null);

-- Family members: scoped to family
create policy "Users can view family members"
  on public.family_members for select
  using (family_id = public.get_family_id());

create policy "Users can insert family members"
  on public.family_members for insert
  with check (family_id = public.get_family_id());

create policy "Users can update family members"
  on public.family_members for update
  using (family_id = public.get_family_id());

create policy "Users can delete family members"
  on public.family_members for delete
  using (family_id = public.get_family_id());

-- Calendar connections
create policy "Family access" on public.calendar_connections
  for all using (family_id = public.get_family_id());

-- Calendar events
create policy "Family access" on public.calendar_events
  for all using (family_id = public.get_family_id());

-- Chore templates
create policy "Family access" on public.chore_templates
  for all using (family_id = public.get_family_id());

-- Chore assignments
create policy "Family access" on public.chore_assignments
  for all using (family_id = public.get_family_id());

-- Chore completions
create policy "Family access" on public.chore_completions
  for all using (family_id = public.get_family_id());

-- Star rewards
create policy "Family access" on public.star_rewards
  for all using (family_id = public.get_family_id());

-- Star redemptions
create policy "Family access" on public.star_redemptions
  for all using (family_id = public.get_family_id());

-- Meal plans
create policy "Family access" on public.meal_plans
  for all using (family_id = public.get_family_id());

-- Lists
create policy "Family access" on public.lists
  for all using (family_id = public.get_family_id());

-- List items
create policy "Family access" on public.list_items
  for all using (family_id = public.get_family_id());

-- Photos
create policy "Family access" on public.photos
  for all using (family_id = public.get_family_id());

-- ============================================================
-- Storage bucket for family photos
-- ============================================================

insert into storage.buckets (id, name, public)
values ('family-photos', 'family-photos', false);

create policy "Family members can upload photos"
  on storage.objects for insert
  with check (
    bucket_id = 'family-photos'
    and auth.uid() is not null
  );

create policy "Family members can view their photos"
  on storage.objects for select
  using (
    bucket_id = 'family-photos'
    and auth.uid() is not null
  );

create policy "Family members can delete their photos"
  on storage.objects for delete
  using (
    bucket_id = 'family-photos'
    and auth.uid() is not null
  );
