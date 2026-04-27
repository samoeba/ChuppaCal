# Phase 6: Meal Planning — Design Spec

**Date:** 2026-04-26
**Status:** Approved

---

## 1. Overview

A weekly meal planning grid displayed on the family wall calendar. Any family member can tap an empty slot to add a meal (name + emoji), or tap a filled slot to edit or delete it. Parents manage which meal slots are visible via Settings.

---

## 2. Scope

**Included:**
- Meals screen: weekly grid (rows = meal slots, columns = days)
- Tap-to-add / tap-to-edit modal with name field + emoji picker
- Week navigation via `?week=YYYY-MM-DD` URL param (← Prev / Current Week / Next →)
- Today's column highlighted
- Meal slot toggles in Settings (Breakfast, Lunch, Dinner, Snack)
- Optimistic UI updates with rollback on error

**Not included:**
- Recipe details, notes, or links
- Meal prep reminders or notifications
- Sharing or copying meals between weeks
- PIN gate (meals are low-stakes, any family member can edit)

---

## 3. Data Model

### Existing table (no migration needed)

```sql
create table public.meal_plans (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families(id) on delete cascade,
  date date not null,
  slot text not null check (slot in ('breakfast', 'lunch', 'dinner', 'snack')),
  name text not null,
  emoji text,
  created_at timestamptz not null default now()
);

create unique index idx_meal_plans_unique on public.meal_plans(family_id, date, slot);
create index idx_meal_plans_family_date on public.meal_plans(family_id, date);
```

### Existing type (no changes needed)

```typescript
export type MealSlot = "breakfast" | "lunch" | "dinner" | "snack";

export interface MealPlan {
  id: string;
  family_id: string;
  date: string;   // YYYY-MM-DD
  slot: MealSlot;
  name: string;
  emoji: string | null;
  created_at: string;
}
```

### Family settings (already in schema)

`families.settings.meal_slots: Record<MealSlot, boolean>` — default: breakfast/lunch/dinner true, snack false.

---

## 4. Page Architecture

### `/app/(main)/meals/page.tsx` (server component)

- Reads `?week` search param (YYYY-MM-DD string, the Monday of the target week)
- Defaults to the current week's Monday if param is absent
- Fetches in parallel:
  - `families` row for `settings.meal_slots`
  - `meal_plans` where `family_id = X` and `date >= weekStart` and `date <= weekEnd`
- Passes both as props to `<MealBoard>`

### Server Actions (`app/actions/meals.ts`)

- `setMeal(date, slot, name, emoji)` — upserts via the unique `(family_id, date, slot)` index
- `deleteMeal(mealId)` — deletes by id
- `updateMealSlots(slots: Record<MealSlot, boolean>)` — patches `families.settings`
- All call `revalidatePath('/meals')` on success

---

## 5. Component Tree

```
MealBoard (client)
├── WeekNav — ← Prev | Current Week | Next →
├── MealGrid
│   ├── Header row — Mon Tue Wed Thu Fri Sat Sun (today column highlighted)
│   └── SlotRow × N (only enabled slots shown)
│       ├── Slot label — "Breakfast", "Lunch", etc.
│       └── MealCell × 7
│           ├── Filled — emoji + truncated name
│           └── Empty — muted "+" tap target
└── MealModal (conditionally rendered)
    ├── Slot + date label (read-only header)
    ├── Text input — meal name (autofocused)
    ├── Emoji picker — 16 food emojis
    └── Actions: Save | Delete (if editing) | Cancel
```

---

## 6. Week Navigation

- URL param: `?week=YYYY-MM-DD` (always the Monday of the target week)
- No param = current week's Monday (computed server-side)
- `<WeekNav>` uses `router.push` to update the param
- "Current Week" button resets to today's week
- Week label displayed between Prev/Next: e.g. "Apr 28 – May 4"

---

## 7. Meal Cell Interaction

1. **Tap empty cell** → modal opens with day + slot pre-set, empty name field, no emoji selected
2. **Tap filled cell** → modal opens pre-filled with existing name + emoji; Delete button visible
3. **Save** → optimistic add/update in local state → `setMeal` server action → rollback + toast on error
4. **Delete** → optimistic remove → `deleteMeal` server action → rollback + toast on error
5. **Cancel** → modal closes, no change

---

## 8. Emoji Picker

16 food emojis offered inline in the modal (no search, no scroll):

🍳 🥞 🥗 🍕 🍔 🌮 🍝 🍜 🥘 🍲 🍣 🍱 🥙 🌯 🧇 🥣

Selected emoji appears to the left of the name in the cell. If no emoji selected, just the name is shown.

---

## 9. Settings Addition

New **Meal Slots** section in Settings (below Calendar Connections):

- Four toggle rows: Breakfast, Lunch, Dinner, Snack
- Current state read from `families.settings.meal_slots`
- Toggling calls `updateMealSlots` server action immediately (no Save button)
- Optimistic toggle with rollback on error
- Toggling a slot off hides that row from the meals grid immediately

---

## 10. Design Tokens

Follows existing design system:
- Background: `cc-beige` / `cc-cream`
- Typography: `.text-heading-md`, `.text-body`, `.text-caption`
- Today highlight: `sky` color (`#4AB8E8`) with low opacity background
- Empty cell "+": `cc-ink` at 30% opacity, scales up slightly on hover/focus
- Modal: white card, `24px` border radius, consistent with chores modals

---

## 11. Verification

1. Current week loads by default with correct days and enabled slots
2. Prev/Next navigation changes the week and URL param
3. Tapping empty cell opens modal; saving shows meal in cell immediately
4. Tapping filled cell opens modal pre-filled; editing updates cell; deleting removes it
5. Rollback works — if server action fails, cell reverts and toast appears
6. Disabling a slot in Settings hides that row from the grid
7. Today's column is visually highlighted
8. Snack slot is hidden by default (off in family settings)
