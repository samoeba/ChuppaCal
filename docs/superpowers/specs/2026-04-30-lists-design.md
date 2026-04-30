# Lists — Phase 7 Design

**Status:** Approved 2026-04-30
**Parent spec:** `2026-04-15-family-calendar-design.md` §5.4
**Phase:** 7

## 1. Goal

Build the family Lists feature: a horizontally-scrollable board of named lists (Grocery, To-Do, Shopping by default) where any family member can add, check, edit, and delete items. Parents (PIN-gated) can create, rename, recolor, and delete entire lists from Settings.

## 2. Scope

### In scope (this PR)
- Default lists seeded on family creation
- Item CRUD: add, edit text, check/uncheck, delete
- Checked items sink to bottom on tap (immediate)
- Per-list "Clear completed" button
- Settings management: create / rename / change emoji + color / delete lists
- Backfill seeding for the existing pre-Phase-7 family

### Deferred (future PRs)
- Drag-to-reorder items within a list
- Drag-to-reorder lists themselves in Settings
- **Realtime sync** across Lists, Meals, and Chores (Option C from brainstorming) — bundled as one focused project rather than a one-off here
- Voice integration (Phase 9 — Alexa Custom Skill calls the same server actions)

## 3. Architecture

Pattern follows Meals: Server Components for reads, Server Actions for writes, optimistic UI for tap responsiveness.

```
app/(main)/lists/page.tsx          Server Component, fetches lists+items, renders <ListsBoard>
app/actions/lists.ts               Server Actions (mutations)
app/api/onboarding/route.ts        Add seed-defaults step
components/lists/
  lists-board.tsx                  Horizontal-scroll container of <ListColumn>s
  list-column.tsx                  One list — header + items + add bar + clear-completed
  list-item-row.tsx                Checkbox + text (tap to edit, long-press to delete)
  add-item-bar.tsx                 Input + "+ Add" button at column bottom
components/settings/
  lists-section.tsx                Manage lists in PIN-gated Settings page
  list-edit-modal.tsx              Emoji + color + name editor
```

**Read path:** server-side Supabase client → `lists` and `list_items` tables, RLS-scoped by family. Single round-trip on page load.

**Write path:** Server Actions call `supabase.from(...).insert/update/delete()`, then `revalidatePath('/lists')` (and `'/settings'` for list-management actions). Optimistic UI via `useOptimistic` so taps feel instant.

## 4. Data Model

No schema changes. The `lists` and `list_items` tables already exist in `supabase/migrations/001_initial_schema.sql`.

`lists`: `id, family_id, name, emoji, color, sort_order, created_at`
`list_items`: `id, list_id, family_id, text, checked, sort_order, created_at`

### Sort behavior
- Items render ordered by `(checked ASC, sort_order ASC, created_at ASC)` — unchecked on top in authored order, checked on the bottom.
- New items get `sort_order = max(sort_order)+1` for that list.
- "Clear completed" deletes all `list_items` where `list_id = X AND checked = true`.
- `sort_order` is functionally unused beyond append order in v1 (drag-reorder deferred).

## 5. Server Actions (`app/actions/lists.ts`)

| Action | Args | Effect |
|--------|------|--------|
| `addItem` | `listId, text` | Insert with `sort_order = max+1`, `checked = false`. |
| `toggleItem` | `itemId, checked` | Update `checked` to the given value. |
| `editItem` | `itemId, text` | Update `text`. Trimmed; reject empty. |
| `deleteItem` | `itemId` | Delete row. |
| `clearCompleted` | `listId` | Delete all checked items in this list. |
| `createList` | `name, emoji, color` | Insert with `sort_order = max+1`. |
| `renameList` | `listId, name` | Update `name`. |
| `updateListAppearance` | `listId, emoji, color` | Update `emoji` and `color`. |
| `deleteList` | `listId` | Delete row (cascade removes items). |

All actions resolve `family_id` from the authenticated user via the existing `get_family_id()` helper, then rely on RLS for authorization. Errors throw and are caught client-side to revert optimistic state.

## 6. Default-List Seeding

### New families
`app/api/onboarding/route.ts` already creates the family using the service-role client. After family insert, also insert:

```
{ name: "Grocery",  emoji: "🛒", color: "#10b981", sort_order: 0 }
{ name: "To-Do",    emoji: "✅", color: "#6366f1", sort_order: 1 }
{ name: "Shopping", emoji: "🛍",  color: "#f59e0b", sort_order: 2 }
```

### Existing pre-Phase-7 family (one-time backfill)
The `/lists` Server Component fetches lists for the family. If the result is empty, it calls a `seedDefaultsIfEmpty()` server action that re-checks emptiness server-side (race-safe) and inserts the same three rows. After that, the page re-renders normally.

This keeps the migration idempotent and avoids a separate SQL backfill script.

## 7. Component Behavior

### `<ListColumn>`
- **Header:** `<emoji> <name> <unchecked-count>`. Color from `lists.color` used as accent on header underline.
- **Items:** rendered `<ListItemRow>` per item, ordered as in §4.
- **Footer:** `<AddItemBar>` always visible. `<ClearCompletedButton>` only when ≥1 checked item exists.

### `<ListItemRow>`
- **Checkbox:** square, color from list color when checked. Tap → optimistic toggle → `toggleItem`. Checked items get strikethrough text and 60% opacity.
- **Text:** tap to edit — swap into controlled `<input>`. Enter or blur → `editItem`. Escape → cancel. Empty trim → no-op.
- **Long-press** (~500ms with visual feedback): confirmation dialog "Delete '\<text\>'?" → `deleteItem` on confirm.
- **Sink animation:** on check, item animates to bottom via FLIP technique (transform-based, 200ms ease).

### `<AddItemBar>`
- Input + "+ Add" button. Enter or button click → `addItem(listId, value)`. Focus stays in input after submit for rapid entry. Empty trim → no-op.

### `<ClearCompletedButton>`
- Shows count: "Clear completed (3)". Confirmation dialog before deleting.

## 8. Settings Management

New section in `/settings` (PIN-gated, parallel to `<MealSlotsSection>`).

### `<ListsSection>`
- Heading: "Lists".
- For each list: row with emoji + name + color swatch + Edit button + Delete button.
- "+ New List" button opens `<ListEditModal>` in create mode.

### `<ListEditModal>`
- Used for both create and edit.
- Fields: name input, emoji picker (grid of list-appropriate icons: 🛒 ✅ 🛍 📝 🍳 🧺 🚗 🎁 📚 🧸 🎨 🏠 🏥 ✈️), color picker (reuses family-member color palette: cc-sun, cc-sky, cc-clover, cc-coral, cc-petal, cc-lagoon, cc-plum).
- Save in create mode → `createList(name, emoji, color)`.
- Save in edit mode → `renameList` if name changed AND/OR `updateListAppearance` if emoji or color changed (calls in parallel; either may be a no-op).
- Cancel → close without changes.

### Delete
- Confirmation dialog: "Delete '\<name\>' and all its items? Cannot be undone." → `deleteList`.

## 9. Mobile and Wall-Display Layout

- **Wall display (≥ ~1024px wide):** lists laid out side-by-side, fitting as many columns as the viewport allows. Horizontal scroll if more.
- **Mobile (< ~1024px):** horizontal-scroll carousel of full-width-ish columns (matches the chore chart and meal grid pattern). Each column is touch-friendly width.

## 10. Permissions

- **Item add / check / edit / delete:** anyone using the device. Lists are family-shared content; no kid-vs-parent gating on items.
- **List management** (create / rename / change appearance / delete the list itself): in `/settings`, which is already PIN-gated by `<PinGate>`.

## 11. Error Handling and Edge Cases

- All server actions wrapped in try/catch. On error: revert optimistic state, show a toast (reuse existing toast pattern from meals if present, else add a minimal one).
- **Empty list** → "No items yet" placeholder text where items would render.
- **No lists exist** (existing pre-Phase-7 family) → trigger one-time `seedDefaultsIfEmpty()` server action and re-render.
- **Long item text** → CSS truncate with ellipsis at column width; full text shown when item is in edit mode.
- **Concurrent edits** (two devices add the same item) → both succeed, both appear. v1 has no realtime conflict resolution by design.
- **Delete-then-undo** is not supported in v1; confirmation dialog is the safety net.

## 12. Verification

Manual checks before marking the phase done:

1. Onboard a fresh test family → /lists shows Grocery, To-Do, Shopping seeded.
2. Existing family with no lists → /lists shows the same three lists (backfill path).
3. Add 3 items to Grocery, check 1 → it animates to bottom, count drops, "Clear completed (1)" appears.
4. Tap checked item → unchecks, returns to top.
5. Long-press an item → confirmation → delete works.
6. Tap item text → edit → Enter → text updated.
7. Open /settings → enter PIN → Lists section shows all lists.
8. Create new list "Costco", emoji 🛒, color cc-coral → appears on /lists.
9. Rename "To-Do" → "Chores"; change color → reflected on /lists.
10. Delete a list with items → confirmation → list and items gone.
11. Mobile viewport → horizontal scroll works; tapping items behaves identically.
12. Type-check (`npm run build`) clean.

## 13. Out of Scope (Future)

- Drag-to-reorder items
- Drag-to-reorder lists in Settings
- **Realtime sync** across Lists + Meals + Chores (planned as one focused PR; Option C from brainstorming)
- Voice integration (Phase 9)
- Item due dates, assignees, notes
- Recurring/templated lists
