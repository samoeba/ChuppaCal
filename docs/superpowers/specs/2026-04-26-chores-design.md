# Phase 5: Chores — Design Spec

**Date:** 2026-04-26
**Status:** Approved

---

## 1. Overview

A tap-to-complete chore chart for the two older kids (ages 6 and 4), displayed as side-by-side columns on the wall screen. Kids tap their chore circles to mark them done; parents manage templates and star rewards in Settings.

---

## 2. Scope

**Included:**
- Chores screen: Today view (default), Week history view, Rewards sub-screen
- Tap-to-complete with bounce + glow animation and star fly-up particles (`public/star-small.png`)
- Star reward system: earn stars for chores, redeem for parent-defined rewards (PIN required to redeem)
- Settings: chore templates CRUD, star rewards CRUD, per-kid chores toggle
- DB migration: drop `chore_assignments`, restructure `chore_completions`, add `chores_enabled` to `family_members`

**Not included:**
- Chore notifications / reminders
- Photo verification of completed chores
- Chore sharing between kids

---

## 3. Data Model Changes

### Migration `003_chores_restructure.sql`

```sql
-- Add chores_enabled flag to family_members
alter table public.family_members
  add column chores_enabled boolean not null default true;

-- Drop old assignment-based completions
drop table if exists public.chore_completions;
drop table if exists public.chore_assignments;

-- Recreate completions keyed directly on (template_id, member_id, date)
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
```

### Also add: template-to-member assignments

Since `chore_assignments` is dropped (it served dual duty as both schedule and member link), we need a lightweight join table:

```sql
create table public.chore_template_members (
  template_id uuid not null references public.chore_templates(id) on delete cascade,
  member_id uuid not null references public.family_members(id) on delete cascade,
  primary key (template_id, member_id)
);
```

The chores page queries this table to know which kids have which templates.

### Existing tables used as-is
- `chore_templates` — `(family_id, name, emoji, star_value, recurrence, active)`
- `star_rewards` — `(family_id, name, emoji, star_cost)`
- `star_redemptions` — `(reward_id, member_id, family_id, stars_spent)`

### Star balance formula
```
stars_available = SUM(chore_completions.stars_earned) - SUM(star_redemptions.stars_spent)
```
Both queries scoped to `member_id` and `family_id`.

---

## 4. Recurrence Logic

A pure utility function `isScheduledToday(template, date): boolean`:

| `recurrence.type` | Logic |
|---|---|
| `"daily"` | Always true |
| `"weekdays"` | True if `date.getDay()` in `[1,2,3,4,5]` |
| `"custom"` | True if `date.getDay()` in `recurrence.days` |

Applied on the server when building the list of today's chores per kid.

---

## 5. Page Architecture

### `/app/(main)/chores/page.tsx` (server component)
Fetches in parallel:
- `family_members` where `role = 'child'` and `chores_enabled = true`
- `chore_templates` where `family_id = X` and `active = true`, with assigned members
- `chore_completions` for today (and current week for week view)
- `star_rewards` and `star_redemptions` for balance computation

Passes all data as props to `<ChoresBoard>`.

### Server Actions (`app/actions/chores.ts`)
- `completeChore(templateId, memberId, date, starsEarned)` — inserts completion row
- `uncompleteChore(templateId, memberId, date)` — deletes completion row (parent only, after PIN)
- `redeemReward(rewardId, memberId)` — inserts redemption row (parent only, after PIN)

All actions call `revalidatePath('/chores')` on success.

---

## 6. Component Tree

```
ChoresBoard (client)
├── KidColumn (client) × 2
│   ├── KidHeader — avatar, name, star count (star-small.png), progress badge
│   ├── TodayView (default)
│   │   ├── ChoreRow × N — tap circle, name, star images
│   │   └── EmptyState — "No chores today! 🎉"
│   ├── WeekView
│   │   └── WeekGrid — chores × days, dot states: done/missed/today/future
│   └── RewardsView
│       ├── StarBalanceHero — big star count
│       └── RewardRow × N — progress bar, Redeem button (PIN-gated)
└── (view switching: Today | Week | Rewards per column, independent)
```

---

## 7. Chore Completion Interaction

1. Kid taps the circle on a `ChoreRow`
2. Optimistic update: completion added to local state immediately
3. Circle animates: bounce + green glow (CSS keyframes)
4. `star-small.png` particles fan out upward (6 particles, CSS animation)
5. Server action fires: `completeChore(...)` inserts DB row
6. On failure: optimistic state rolled back, error toast shown briefly
7. Completed chores: green background, checkmark replaces emoji, name gets strikethrough

**Undo (parent only):** Requires `<PinGate>` PIN entry. On success calls `uncompleteChore(...)`.

---

## 8. Week View

- Columns: Mon–Sun of the current week
- Rows: all templates scheduled for that kid (union of all days in the week)
- Cell states:
  - ✓ green dot — completed
  - ✗ red/pink — missed (past day, was scheduled, no completion)
  - outlined — today (no completion yet)
  - grey — future day or not scheduled that day

---

## 9. Rewards View

- Opens within the kid's column (replaces chore list, same column shell)
- Star balance shown large at top
- Each reward shows: emoji, name, cost, progress bar, Redeem button
- Progress bar color: green if unlocked, yellow if >50%, blue otherwise
- Redeem button: active (sun yellow) if `stars_available >= star_cost`, grey + "Locked" otherwise
- Tapping active Redeem → `<PinGate>` → on PIN success → `redeemReward(...)` server action

---

## 10. Settings Additions

### Family Members section (existing)
- Add a toggle per child member: **"Show on Chores screen"** (`chores_enabled`)
- Only shown for members with `role = 'child'`

### New: Chore Templates section
- List of active templates with emoji, name, star value, recurrence, assigned kids
- Add / Edit modal: name (text), emoji (picker), star value (1–3 selector), recurrence (daily / weekdays / custom days picker), assigned kids (checkboxes)
- Delete with confirmation (soft-delete: sets `active = false`)

### New: Star Rewards section
- List of rewards with emoji, name, star cost
- Add / Edit modal: name, emoji, star cost (number input)
- Delete with confirmation (hard delete)

Both new sections are PIN-protected (already handled by the `<PinGate>` wrapping the whole settings page).

---

## 11. Verification

1. Kid taps a chore → animation plays, chore turns green, star count increments
2. Reload page → completion persists
3. Parent taps completed chore → PIN prompt → undo works
4. Week view shows correct done/missed/future states
5. Rewards progress bars reflect current star balance
6. Redeem button inactive until enough stars earned
7. Redeem → PIN → stars deducted → balance updates
8. Chores toggle in settings hides/shows kid column
9. New chore template appears immediately on chores screen
10. Deleted template (soft-delete) disappears from chores screen
