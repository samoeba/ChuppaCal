# Chores Three-Buckets Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Split the flat star economy into unpaid **expectations** that gate access to paid, family-wide **extra work**, with expenses served by the existing rewards store.

**Architecture:** A `category` column on `chore_templates` distinguishes the two chore kinds; a check constraint enforces that expectations can't pay and jobs can't be free. `category` is denormalized onto `chore_completions` so a partial unique index can cap extra work at once-per-job-per-day family-wide. The per-column view switchers are promoted to one top-level tab bar so the shared job board has somewhere to live.

**Tech Stack:** Next.js 16 (App Router), React 19, TypeScript, Tailwind v4, Supabase (Postgres + RLS), Vitest (added in Task 2).

**Spec:** `docs/superpowers/specs/2026-08-10-chores-three-buckets-design.md`

## Global Constraints

- **Next.js 16.** All request APIs are async — `await cookies()`, `await params`, `await searchParams`. Middleware is `proxy.ts` exporting `proxy()`, not `middleware()`. Read `node_modules/next/dist/docs/` before using an unfamiliar API; this version differs from older training data.
- **Migrations are applied by hand.** Files live in `supabase/migrations/`. Nothing runs them automatically — you paste them into the Supabase SQL editor for project ref `skkxvyebvcjvhcbdzqhc`. Migrations `001`–`004` are already applied.
- **Touch-first kiosk.** Wall-mounted 21.5" touchscreen used by a 6- and 4-year-old. Tap targets minimum 44×44px. Use `touch-manipulation` on interactive elements. Assume no hover.
- **Design tokens live in `app/globals.css`** under `@theme inline`. Use them, not raw hex, in new Tailwind classes. Key values for reference: cc-beige `#F3EFE0`, cc-cream `#FAF6E8`, cc-ink `#1C1A14`, sun `#FDCB40`, clover `#00B351`, petal `#F780D4`, sky `#2668FD`, plum `#6B3088`.
- **Existing components use inline `style={{}}` for token colors** (see `components/chores/kid-column.tsx:51`). Follow the surrounding file's convention rather than converting it.
- **`.npmrc` sets `legacy-peer-deps=true`.** Leave it; `react-simple-keyboard` requires it.
- **Commit style:** conventional commits (`feat(chores):`, `fix(chores):`, `docs(chores):`). Commit at the end of every task.
- **Verification commands:** `npm run lint` must pass before any commit, and after Task 2 so
  must `npx vitest run`.
- **Use `npx tsc --noEmit`, not `npm run build`, to check types mid-plan.** Turbopack aborts at
  the first module-resolution failure and never type-checks the remaining files, so during the
  tasks where the tree is deliberately half-migrated, `npm run build` will show you *one* error
  and hide the rest — it cannot confirm a claim like "errors are confined to these three files."
  `tsc --noEmit` reports them all. Run `npm run build` as the final gate once the tree is whole
  again (Task 8 onward), where it must pass.

## Testing Strategy — read before Task 1

**This project has no test framework and no tests.** `package.json` defines only `dev`, `build`, `start`, `lint`.

This plan does **not** attempt to retrofit full test coverage. It adds Vitest in Task 2 and unit-tests exactly one thing: the pure gate logic in `lib/chores.ts`. That function decides whether a child is allowed to earn, it is pure input→output, and getting it wrong silently locks a kid out of the entire economy — it is worth real tests and cheap to write them.

Everything else — the migration, Supabase-backed server actions, and kiosk UI — is verified manually with the exact commands and expected results given in each task. Unit-testing those would require a test database, React Testing Library, and Playwright: infrastructure far out of proportion to a single-family kiosk app, and none of it currently exists.

**If you disagree with adding Vitest,** Task 2 is the only place it appears. Dropping it means verifying the gate logic by hand in the browser instead, and every other task is unaffected.

---

## File Structure

**Created:**

| File | Responsibility |
|---|---|
| `supabase/migrations/005_chores_three_buckets.sql` | Schema change: category, is_special, constraint, partial index |
| `vitest.config.ts` | Test runner config |
| `lib/chores.test.ts` | Unit tests for gate logic and helpers |
| `components/chores/view-tabs.tsx` | Top-level tab bar (Today / Extra Work / Week / Rewards) |
| `components/chores/job-board.tsx` | Shared extra-work board |
| `components/chores/job-row.tsx` | One job: emoji, name, value, ✦ badge, per-kid avatars |
| `components/chores/job-claim-modal.tsx` | "Who did it?" kid picker |
| `components/chores/unlock-celebration.tsx` | Overlay when a kid's last expectation lands |
| `components/settings/extra-work-section.tsx` | Settings CRUD for jobs |

**Modified:**

| File | Change |
|---|---|
| `lib/types.ts` | `ChoreCategory`; `category`/`is_special` on `ChoreTemplate`; `category` on `ChoreCompletion` |
| `lib/chores.ts` | `expectationsForDay()`, `gateOpen()`; `templatesForDay()` removed |
| `app/actions/chores.ts` | `completeChore` drops stars; add `claimJob`, `revokeJob`; template actions take category |
| `app/(main)/chores/page.tsx` | Fetch jobs + today's claims; compute gate per kid |
| `components/chores/chores-board.tsx` | Owns `view` state; renders tabs; routes to job board |
| `components/chores/kid-column.tsx` | `view` becomes a prop; footer switcher removed |
| `components/chores/chore-row.tsx` | Star chips removed; no star burst |
| `components/chores/rewards-view.tsx` | "Add reward" quick-add button |
| `components/settings/chore-templates-section.tsx` | Becomes expectations-only (no star field) |
| `app/(main)/settings/page.tsx` | Renders both chore sections |

---

## Task 1: Migration and types

**Files:**
- Create: `supabase/migrations/005_chores_three_buckets.sql`
- Modify: `lib/types.ts:68-100`

**Interfaces:**
- Consumes: nothing (first task)
- Produces: `ChoreCategory = "expectation" | "extra_work"`; `ChoreTemplate.category: ChoreCategory`; `ChoreTemplate.is_special: boolean`; `ChoreCompletion.category: ChoreCategory`

- [ ] **Step 0: Snapshot the tables you are about to mutate**

This migration **irreversibly zeroes `star_value` on every existing template** and is applied
by hand. There is no rollback. Take a snapshot first — run in the Supabase SQL editor:

```sql
create table public.chore_templates_backup_005 as
  select * from public.chore_templates;

create table public.chore_completions_backup_005 as
  select * from public.chore_completions;

select
  (select count(*) from public.chore_templates_backup_005)   as templates_saved,
  (select count(*) from public.chore_completions_backup_005) as completions_saved;
```

Expected: both counts non-zero and matching the live tables. Do not proceed until they do.

Drop the backups only after the full verification checklist at the end of this plan passes.

- [ ] **Step 1: Write the migration file**

Create `supabase/migrations/005_chores_three_buckets.sql`:

```sql
-- Phase 5 restructure: expectations (unpaid, gating) vs extra work (paid, open pool).
-- Spec: docs/superpowers/specs/2026-08-10-chores-three-buckets-design.md

alter table public.chore_templates
  add column category text not null default 'expectation'
    check (category in ('expectation','extra_work')),
  add column is_special boolean not null default false;

-- Every pre-existing template is a recurring, assigned, paid chore -- i.e. an
-- expectation minus the payment. Zero the values BEFORE adding the constraint.
update public.chore_templates set star_value = 0;

alter table public.chore_templates
  add constraint chk_pay_matches_category check (
    (category = 'expectation' and star_value = 0) or
    (category = 'extra_work'  and star_value > 0)
  );

-- Denormalized purely so the partial unique index below can exist: a partial
-- index cannot join to chore_templates to read the category.
alter table public.chore_completions
  add column category text not null default 'expectation'
    check (category in ('expectation','extra_work'));

update public.chore_completions c set category = t.category
  from public.chore_templates t where c.template_id = t.id;

-- Extra work is claimable once per job per day, family-wide. Expectations keep
-- using idx_chore_completions_unique (template_id, member_id, date).
create unique index idx_extra_work_once_per_day
  on public.chore_completions(template_id, date)
  where category = 'extra_work';
```

- [ ] **Step 2: Apply it to Supabase**

Open the Supabase dashboard for project `skkxvyebvcjvhcbdzqhc` → SQL Editor → paste the file contents → Run.

Expected: "Success. No rows returned."

If it fails on `chk_pay_matches_category`, a template row still has a non-zero `star_value` — confirm the `update` statement ran before the `alter table ... add constraint`.

- [ ] **Step 3: Verify the schema in Supabase**

Run in the SQL editor:

```sql
select category, count(*), min(star_value), max(star_value)
from public.chore_templates group by category;

select indexname from pg_indexes
where tablename = 'chore_completions';

select count(*) filter (where category = 'expectation') as expectations,
       count(*) filter (where category = 'extra_work')  as jobs
from public.chore_completions;
```

Expected:
- One row: `expectation | <n> | 0 | 0` — every template is an expectation and pays nothing
- `idx_extra_work_once_per_day` present alongside `idx_chore_completions_unique`
- All existing completions counted under `expectations`

- [ ] **Step 4: Verify the constraint actually bites**

```sql
-- Both of these MUST fail.
insert into public.chore_templates (family_id, name, emoji, star_value, recurrence, category)
select family_id, 'constraint probe', '🧪', 3, '{"type":"daily"}'::jsonb, 'expectation'
from public.families limit 1;

insert into public.chore_templates (family_id, name, emoji, star_value, recurrence, category)
select family_id, 'constraint probe', '🧪', 0, '{"type":"daily"}'::jsonb, 'extra_work'
from public.families limit 1;
```

Expected: both raise `new row for relation "chore_templates" violates check constraint "chk_pay_matches_category"`. If either succeeds, delete the row and fix the constraint before continuing.

- [ ] **Step 5: Update the TypeScript types**

In `lib/types.ts`, add the category union above `ChoreTemplate` and extend both interfaces:

```ts
export type ChoreCategory = "expectation" | "extra_work";

export interface ChoreTemplate {
  id: string;
  family_id: string;
  name: string;
  emoji: string;
  star_value: number;
  recurrence: ChoreRecurrence;
  active: boolean;
  created_at: string;
  category: ChoreCategory;
  is_special: boolean;
}

export interface ChoreCompletion {
  id: string;
  family_id: string;
  template_id: string;
  member_id: string;
  date: string; // YYYY-MM-DD
  stars_earned: number;
  completed_at: string;
  category: ChoreCategory;
}
```

- [ ] **Step 6: Confirm the build breaks where expected**

Run: `npm run build`

Expected: FAIL. Type errors where `ChoreCompletion` objects are constructed without `category` — specifically `components/chores/chore-row.tsx:48` (the optimistic completion literal). This is the correct failure; later tasks fix each site. Note the full list of errors, then continue.

- [ ] **Step 7: Commit**

```bash
git add supabase/migrations/005_chores_three_buckets.sql lib/types.ts
git commit -m "feat(chores): category + is_special schema for three-bucket model"
```

---

## Task 2: Vitest harness and gate logic

**Files:**
- Create: `vitest.config.ts`, `lib/chores.test.ts`
- Modify: `lib/chores.ts:45-47` (replace `templatesForDay`), `package.json`

**Interfaces:**
- Consumes: `ChoreCategory`, `ChoreTemplate`, `ChoreCompletion` from Task 1
- Produces:
  - `expectationsForDay(templates: ChoreTemplate[], date: Date): ChoreTemplate[]`
  - `gateOpen(memberTemplates: ChoreTemplate[], memberCompletions: ChoreCompletion[], dateStr: string): boolean`
  - `templatesForDay()` is **removed** — Task 4 updates its only caller

- [ ] **Step 1: Install Vitest**

```bash
npm install -D vitest
```

- [ ] **Step 2: Add the config and script**

Create `vitest.config.ts`:

```ts
import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  test: { environment: "node", include: ["lib/**/*.test.ts"] },
  resolve: { alias: { "@": path.resolve(__dirname, ".") } },
});
```

Add to `package.json` scripts, after `"lint": "eslint"`:

```json
"test": "vitest run"
```

- [ ] **Step 3: Write the failing tests**

Create `lib/chores.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { expectationsForDay, gateOpen } from "@/lib/chores";
import type { ChoreCompletion, ChoreTemplate } from "@/lib/types";

const MONDAY = "2026-08-10"; // getDay() === 1

function template(over: Partial<ChoreTemplate> = {}): ChoreTemplate {
  return {
    id: "t1", family_id: "f1", name: "Make bed", emoji: "🛏️",
    star_value: 0, recurrence: { type: "daily" }, active: true,
    created_at: "", category: "expectation", is_special: false,
    ...over,
  };
}

function completion(over: Partial<ChoreCompletion> = {}): ChoreCompletion {
  return {
    id: "c1", family_id: "f1", template_id: "t1", member_id: "m1",
    date: MONDAY, stars_earned: 0, completed_at: "",
    category: "expectation", ...over,
  };
}

describe("expectationsForDay", () => {
  it("keeps active daily expectations", () => {
    expect(expectationsForDay([template()], new Date(MONDAY + "T00:00:00"))).toHaveLength(1);
  });

  it("drops extra work", () => {
    const job = template({ id: "j1", category: "extra_work", star_value: 3 });
    expect(expectationsForDay([job], new Date(MONDAY + "T00:00:00"))).toHaveLength(0);
  });

  it("drops inactive templates", () => {
    expect(expectationsForDay([template({ active: false })], new Date(MONDAY + "T00:00:00"))).toHaveLength(0);
  });

  it("respects custom recurrence days", () => {
    const sundayOnly = template({ recurrence: { type: "custom", days: [0] } });
    expect(expectationsForDay([sundayOnly], new Date(MONDAY + "T00:00:00"))).toHaveLength(0);
  });
});

describe("gateOpen", () => {
  it("is open when nothing is scheduled", () => {
    expect(gateOpen([], [], MONDAY)).toBe(true);
  });

  it("is open when the only expectations are extra work", () => {
    const job = template({ id: "j1", category: "extra_work", star_value: 3 });
    expect(gateOpen([job], [], MONDAY)).toBe(true);
  });

  it("is closed when a scheduled expectation is unfinished", () => {
    expect(gateOpen([template()], [], MONDAY)).toBe(false);
  });

  it("is closed when only some are finished", () => {
    const a = template({ id: "a" });
    const b = template({ id: "b" });
    expect(gateOpen([a, b], [completion({ template_id: "a" })], MONDAY)).toBe(false);
  });

  it("is open when all are finished", () => {
    const a = template({ id: "a" });
    const b = template({ id: "b" });
    const done = [completion({ template_id: "a" }), completion({ id: "c2", template_id: "b" })];
    expect(gateOpen([a, b], done, MONDAY)).toBe(true);
  });

  it("ignores completions from another date", () => {
    const stale = completion({ date: "2026-08-09" });
    expect(gateOpen([template()], [stale], MONDAY)).toBe(false);
  });

  it("ignores expectations not scheduled today", () => {
    const sundayOnly = template({ id: "s", recurrence: { type: "custom", days: [0] } });
    expect(gateOpen([template(), sundayOnly], [completion()], MONDAY)).toBe(true);
  });

  // Without this case the suite only ever compares counts, and a wrong
  // implementation (`completions.length >= due.length`) passes everything above.
  it("requires completions for the right templates", () => {
    const a = template({ id: "a" });
    const b = template({ id: "b" });
    const bothForA = [
      completion({ id: "c1", template_id: "a" }),
      completion({ id: "c2", template_id: "a" }),
    ];
    expect(gateOpen([a, b], bothForA, MONDAY)).toBe(false);
  });
});
```

- [ ] **Step 4: Run the tests to verify they fail**

Run: `npx vitest run`

Expected: FAIL — `expectationsForDay` and `gateOpen` are not exported from `lib/chores.ts`.

- [ ] **Step 5: Implement both functions**

In `lib/chores.ts`, **delete** `templatesForDay` (lines 45-47) and append:

```ts
export function expectationsForDay(templates: ChoreTemplate[], date: Date): ChoreTemplate[] {
  return templates.filter(
    (t) => t.active && t.category === "expectation" && isScheduledToday(t.recurrence, date)
  );
}

/**
 * A child may claim extra work only once every expectation assigned to them and
 * scheduled today is complete. A child with nothing scheduled is vacuously open.
 *
 * `memberCompletions` must already be filtered to a single member.
 */
export function gateOpen(
  memberTemplates: ChoreTemplate[],
  memberCompletions: ChoreCompletion[],
  dateStr: string
): boolean {
  const due = expectationsForDay(memberTemplates, new Date(dateStr + "T00:00:00"));
  if (due.length === 0) return true;
  const doneIds = new Set(
    memberCompletions.filter((c) => c.date === dateStr).map((c) => c.template_id)
  );
  return due.every((t) => doneIds.has(t.id));
}
```

- [ ] **Step 6: Run the tests to verify they pass**

Run: `npx vitest run`

Expected: PASS — 12 tests in one file (`lib/chores.test.ts`), across two `describe` blocks:
4 for `expectationsForDay`, 8 for `gateOpen`.

- [ ] **Step 7: Commit**

```bash
git add package.json package-lock.json vitest.config.ts lib/chores.ts lib/chores.test.ts
git commit -m "feat(chores): gate logic with vitest coverage"
```

---

## Task 3: Server actions

**Files:**
- Modify: `app/actions/chores.ts:7-24` (completeChore), `:55-95` (template CRUD), and append new actions

**Interfaces:**
- Consumes: `gateOpen` (Task 2), `ChoreCategory` (Task 1)
- Produces:
  - `completeChore(templateId: string, memberId: string, familyId: string, date: string): Promise<void>` — **signature changed**, `starsEarned` parameter removed
  - `claimJob(templateId, memberId, familyId, date): Promise<ClaimResult>`
  - `revokeJob(templateId: string, date: string): Promise<void>`
  - `type ClaimResult = { ok: true } | { ok: false; reason: "already_claimed" | "locked" | "unavailable" }`
  - `createChoreTemplate` / `updateChoreTemplate` data param gains `category` and `is_special`

- [ ] **Step 1: Update `completeChore` to stop paying**

Replace lines 7-24 of `app/actions/chores.ts`:

```ts
export async function completeChore(
  templateId: string,
  memberId: string,
  familyId: string,
  date: string
) {
  const supabase = await createClient();
  const { error } = await supabase.from("chore_completions").insert({
    template_id: templateId,
    member_id: memberId,
    family_id: familyId,
    date,
    stars_earned: 0,
    category: "expectation",
  });
  if (error) throw new Error(error.message);
  revalidatePath("/chores");
}
```

- [ ] **Step 2: Add the claim and revoke actions**

Append to `app/actions/chores.ts`. Note this file's existing actions `throw` on failure; `claimJob` returns a result instead because the caller must distinguish "someone beat you to it" from a real error.

```ts
export type ClaimResult =
  | { ok: true }
  | { ok: false; reason: "already_claimed" | "locked" | "unavailable" };

export async function claimJob(
  templateId: string,
  memberId: string,
  familyId: string,
  date: string
): Promise<ClaimResult> {
  const supabase = await createClient();

  // maybeSingle, NOT single: single() returns a PGRST116 *error* for zero rows, which
  // would throw below instead of falling through to the "unavailable" branch.
  const { data: job, error: jobError } = await supabase
    .from("chore_templates")
    .select("id,star_value,category,active")
    .eq("id", templateId)
    .maybeSingle();
  if (jobError) throw new Error(jobError.message);
  if (!job || !job.active || job.category !== "extra_work") {
    return { ok: false, reason: "unavailable" };
  }

  // Re-check the gate server-side. The client gate is for responsiveness only.
  //
  // Every query below MUST check `error` and throw. A failed query returns data: null,
  // which is indistinguishable from "this child has no assigned templates" — and
  // gateOpen treats a child with nothing scheduled as vacuously unlocked. Swallowing
  // these errors makes the gate fail OPEN, paying a child who hasn't done their chores.
  // A legitimately empty result set (data: [], error: null) must still read as zero rows.
  const { data: tmRows, error: tmError } = await supabase
    .from("chore_template_members")
    .select("template_id")
    .eq("member_id", memberId);
  if (tmError) throw new Error(tmError.message);
  const assignedIds = (tmRows ?? []).map((r) => r.template_id);

  const { data: myTemplates, error: myTemplatesError } = assignedIds.length
    ? await supabase.from("chore_templates").select("*").in("id", assignedIds).eq("active", true)
    : { data: [] as ChoreTemplate[], error: null };
  if (myTemplatesError) throw new Error(myTemplatesError.message);

  const { data: myCompletions, error: myCompletionsError } = await supabase
    .from("chore_completions")
    .select("*")
    .eq("member_id", memberId)
    .eq("date", date);
  if (myCompletionsError) throw new Error(myCompletionsError.message);

  if (!gateOpen((myTemplates ?? []) as ChoreTemplate[], (myCompletions ?? []) as ChoreCompletion[], date)) {
    return { ok: false, reason: "locked" };
  }

  const { error } = await supabase.from("chore_completions").insert({
    template_id: templateId,
    member_id: memberId,
    family_id: familyId,
    date,
    stars_earned: job.star_value,
    category: "extra_work",
  });

  if (error) {
    // 23505 = unique_violation from idx_extra_work_once_per_day: the sibling won the race.
    if (error.code === "23505") return { ok: false, reason: "already_claimed" };
    throw new Error(error.message);
  }

  revalidatePath("/chores");
  return { ok: true };
}

export async function revokeJob(templateId: string, date: string) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("chore_completions")
    .delete()
    .eq("template_id", templateId)
    .eq("date", date)
    .eq("category", "extra_work");
  if (error) throw new Error(error.message);
  revalidatePath("/chores");
}
```

Update the imports at the top of the file:

```ts
import { gateOpen } from "@/lib/chores";
import type { ChoreCategory, ChoreCompletion, ChoreRecurrence, ChoreTemplate } from "@/lib/types";
```

`revokeJob` needs no `memberId` — the partial unique index guarantees at most one extra-work claim per `(template_id, date)`.

- [ ] **Step 3: Widen the template CRUD data param**

In `createChoreTemplate` (line 55) and `updateChoreTemplate` (line 77), change the `data` parameter type in both signatures from:

```ts
data: { name: string; emoji: string; star_value: number; recurrence: ChoreRecurrence }
```

to:

```ts
data: {
  name: string;
  emoji: string;
  star_value: number;
  recurrence: ChoreRecurrence;
  category: ChoreCategory;
  is_special: boolean;
}
```

No body changes — both already spread `data` into the insert/update.

- [ ] **Step 4: Verify it compiles**

Run: `npm run build`

Expected: still FAILS, but the errors have moved. `app/actions/chores.ts` itself must be clean; remaining errors should only be in `components/chores/chore-row.tsx` (calls `completeChore` with 5 args) and `components/settings/chore-templates-section.tsx` (missing `category`/`is_special`). Both are fixed in later tasks.

- [ ] **Step 5: Commit**

```bash
git add app/actions/chores.ts
git commit -m "feat(chores): claimJob + revokeJob actions, completeChore stops paying"
```

---

## Task 4: Page data and gate computation

**Files:**
- Modify: `app/(main)/chores/page.tsx:53-107`

**Interfaces:**
- Consumes: `expectationsForDay` (Task 2)
- Produces — new props passed to `<ChoresBoard>`:
  - `jobs: ChoreTemplate[]` — active `extra_work` templates
  - `claimsToday: ChoreCompletion[]` — today's `extra_work` completions

**Deviation from spec §5, deliberate:** the spec says the gate is computed server-side then
recomputed client-side. Doing both means two sources of truth for the same boolean, and the
server value would be dead on arrival — `ChoresBoard` is a client component that already holds
the completions and recomputes the gate on its first render, producing an identical value. So
the gate is computed **only** in `ChoresBoard` (Task 5). The spec's actual requirement — that
the server is the authority for whether a claim is *allowed* — is preserved by `claimJob`
re-checking `gateOpen` in Task 3. Behavior is unchanged; there is simply one computation
instead of two.

- [ ] **Step 1: Split templates by category**

In `app/(main)/chores/page.tsx`, replace the block at lines 79-88 with:

```ts
  const allTemplates = (templates ?? []) as ChoreTemplate[];
  const expectations = allTemplates.filter((t) => t.category === "expectation");
  const jobs = allTemplates.filter((t) => t.category === "extra_work");

  const familyTemplateIds = new Set(allTemplates.map((t) => t.id));
  const allTMs = ((templateMembers ?? []) as ChoreTemplateMember[]).filter(
    (tm) => familyTemplateIds.has(tm.template_id)
  );

  const todayCompletions = (completionsToday ?? []) as ChoreCompletion[];

  // Expectations only. Extra work has no chore_template_members rows by design,
  // so this filter is belt-and-braces against a stray assignment.
  const templatesByMember: Record<string, ChoreTemplate[]> = {};
  for (const kid of members ?? []) {
    const ids = allTMs.filter((tm) => tm.member_id === kid.id).map((tm) => tm.template_id);
    templatesByMember[kid.id] = expectations.filter((t) => ids.includes(t.id));
  }

  const claimsToday = todayCompletions.filter((c) => c.category === "extra_work");
```

- [ ] **Step 2: Pass the new props**

Add two props to the `<ChoresBoard>` element (after `redemptions`):

```tsx
      jobs={jobs}
      claimsToday={claimsToday}
```

No import change is needed in this file — `gateOpen` is not used here.

- [ ] **Step 4: Verify**

Run: `npm run build`

Expected: fails only on the missing props in `ChoresBoardProps` (Task 5) plus the two known component errors. The page file itself must be error-free.

- [ ] **Step 5: Commit**

```bash
git add "app/(main)/chores/page.tsx"
git commit -m "feat(chores): split templates by category, compute gate per kid"
```

---

## Task 5: Top-level tabs

**Files:**
- Create: `components/chores/view-tabs.tsx`
- Modify: `components/chores/chores-board.tsx`, `components/chores/kid-column.tsx:12,37,92-118`

**Interfaces:**
- Consumes: `jobs`, `claimsToday` (Task 4); `gateOpen` (Task 2)
- Produces:
  - `type ChoresView = "today" | "jobs" | "week" | "rewards"` exported from `view-tabs.tsx`
  - `KidColumn` gains required prop `view: Exclude<ChoresView, "jobs">` and **loses** its internal state and footer

- [ ] **Step 1: Create the tab bar**

Create `components/chores/view-tabs.tsx`:

```tsx
"use client";

export type ChoresView = "today" | "jobs" | "week" | "rewards";

const TABS: { id: ChoresView; label: string }[] = [
  { id: "today", label: "Today" },
  { id: "jobs", label: "Extra Work" },
  { id: "week", label: "Week" },
  { id: "rewards", label: "Rewards" },
];

interface ViewTabsProps {
  view: ChoresView;
  onChange: (v: ChoresView) => void;
  allLocked: boolean;
}

export default function ViewTabs({ view, onChange, allLocked }: ViewTabsProps) {
  return (
    <div className="flex gap-2 px-4 pt-4">
      {TABS.map((tab) => {
        const active = view === tab.id;
        const locked = tab.id === "jobs" && allLocked;
        return (
          <button
            key={tab.id}
            onClick={() => onChange(tab.id)}
            className="px-5 py-2.5 rounded-full text-base font-bold touch-manipulation transition-colors"
            style={
              active
                ? { background: "#1C1A14", color: "#FAF6E8" }
                : { background: "#FAF6E8", color: "#1C1A14B3" }
            }
          >
            {locked ? "🔒 " : ""}
            {tab.label}
          </button>
        );
      })}
    </div>
  );
}
```

The lock glyph is informational only — the tab stays tappable so kids can browse what they could earn (spec §10).

- [ ] **Step 2: Lift view state into ChoresBoard**

In `components/chores/chores-board.tsx`, add the new props to the interface:

```ts
  jobs: ChoreTemplate[];
  claimsToday: ChoreCompletion[];
```

Destructure them in the function signature, then add view state and the gate computation.
This is the **only** place the gate is computed for display — it derives from `optToday`, the
same optimistic state the checkboxes mutate, so the board unlocks the instant a kid finishes
without waiting on a server round trip:

```tsx
  const [view, setView] = useState<ChoresView>("today");

  function liveGate(completions: ChoreCompletion[], memberId: string) {
    return gateOpen(
      templatesByMember[memberId] ?? [],
      completions.filter((c) => c.member_id === memberId),
      today
    );
  }

  const liveGateByKid: Record<string, boolean> = Object.fromEntries(
    kids.map((k) => [k.id, liveGate(optToday, k.id)])
  );
  const allLocked = kids.every((k) => !liveGateByKid[k.id]);
```

Import at the top:

```ts
import ViewTabs, { type ChoresView } from "@/components/chores/view-tabs";
import { expectationsForDay, gateOpen } from "@/lib/chores";
```

- [ ] **Step 3: Replace the render tree**

Replace the returned JSX (lines 72-97) with:

```tsx
  return (
    <div className="flex flex-col h-full">
      <ViewTabs view={view} onChange={setView} allLocked={allLocked} />

      {view === "jobs" ? (
        <div className="flex-1 p-4 overflow-y-auto">
          <p className="text-sm text-slate-400">Job board lands in Task 7.</p>
        </div>
      ) : (
        <div className="flex gap-4 flex-1 p-4 overflow-hidden">
          {kids.map((kid) => (
            <KidColumn
              key={kid.id}
              kid={kid}
              view={view}
              todayTemplates={expectationsForDay(templatesByMember[kid.id] ?? [], todayDate)}
              allTemplates={templatesByMember[kid.id] ?? []}
              completionsToday={optToday.filter((c) => c.member_id === kid.id)}
              completionsWeek={optWeek.filter((c) => c.member_id === kid.id)}
              allCompletions={optAll.filter((c) => c.member_id === kid.id)}
              rewards={rewards}
              redemptions={optRedemptions}
              familyId={familyId}
              familyPin={familyPin}
              today={today}
              weekStartStr={weekStartStr}
              onComplete={addCompletion}
              onUncomplete={removeCompletion}
              onRedeem={addRedemption}
            />
          ))}
        </div>
      )}
    </div>
  );
```

The `jobs` placeholder is replaced in Task 7. It exists so this task builds and is independently reviewable.

- [ ] **Step 4: Make KidColumn take view as a prop**

In `components/chores/kid-column.tsx`:

1. Delete line 12 (`type ViewType = ...`) and line 37 (`const [view, setView] = useState<ViewType>("today")`).
2. Add `view: "today" | "week" | "rewards";` to `KidColumnProps` and destructure it.
3. Delete the entire footer block (lines 92-118).
4. Remove the now-unused `useState` import on line 3.

Leave the header, `progressLabel`, and body conditionals exactly as they are.

- [ ] **Step 5: Verify**

Run: `npm run build && npm run lint`

Expected: build passes except for `chore-row.tsx` and `chore-templates-section.tsx` (Tasks 6 and 8). No errors in `chores-board.tsx`, `kid-column.tsx`, or `view-tabs.tsx`.

- [ ] **Step 6: Commit**

```bash
git add components/chores/view-tabs.tsx components/chores/chores-board.tsx components/chores/kid-column.tsx
git commit -m "feat(chores): promote view switcher to top-level tabs"
```

---

## Task 6: Expectations stop paying

**Files:**
- Create: `components/chores/unlock-celebration.tsx`
- Modify: `components/chores/chore-row.tsx:40-68,101-105,141-157`, `components/chores/chores-board.tsx`

**Interfaces:**
- Consumes: `completeChore` 4-arg signature (Task 3), `gateOpen` (Task 2)
- Produces: `<UnlockCelebration kidName={string} onDone={() => void} />`

- [ ] **Step 1: Strip payment from ChoreRow**

In `components/chores/chore-row.tsx`:

Replace the optimistic literal and the call inside `handleTap` (lines 48-61) with:

```tsx
    const optimistic: ChoreCompletion = {
      id: crypto.randomUUID(),
      family_id: familyId,
      template_id: template.id,
      member_id: kid.id,
      date: today,
      stars_earned: 0,
      completed_at: new Date().toISOString(),
      category: "expectation",
    };
    try {
      await Promise.all([
        completeChore(template.id, kid.id, familyId, today),
        new Promise((r) => setTimeout(r, 450)),
      ]);
      withViewTransition(() => onComplete(optimistic));
    } catch {
      setPendingComplete(false);
    } finally {
      setAnimating(false);
    }
```

The 850ms delay existed to let the star burst play. With no burst, 450ms is enough for the bounce.

- [ ] **Step 2: Remove the star burst and star chips**

1. Delete the `fireStars` call inside `handleTap` (lines 44-47).
2. Delete the entire `fireStars` function (lines 141-157).
3. Delete the star chip block (lines 101-105) — the `<div className="flex gap-0.5">` containing the `Array.from({ length: template.star_value })` map.
4. Delete the `@keyframes starFly` and `.star-particle` rules from the `<style>` block (lines 127-135). Keep `@keyframes choreComplete`.
5. Remove the now-unused `Image` import on line 5.

- [ ] **Step 3: Create the unlock celebration**

Create `components/chores/unlock-celebration.tsx`:

```tsx
"use client";

import { useEffect } from "react";
import Image from "next/image";

interface UnlockCelebrationProps {
  kidName: string;
  onDone: () => void;
}

export default function UnlockCelebration({ kidName, onDone }: UnlockCelebrationProps) {
  useEffect(() => {
    const t = setTimeout(onDone, 2600);
    return () => clearTimeout(t);
  }, [onDone]);

  return (
    <div
      onClick={onDone}
      className="fixed inset-0 z-9998 flex items-center justify-center touch-manipulation"
      style={{ background: "#1C1A14CC", animation: "unlockIn 0.3s ease-out" }}
    >
      <div
        className="flex flex-col items-center gap-3 px-12 py-10 rounded-cc-lg text-center"
        style={{ background: "#FAF6E8", animation: "unlockPop 0.5s cubic-bezier(0.34,1.56,0.64,1)" }}
      >
        <Image src="/star-small.png" alt="" width={56} height={56} />
        <div className="text-3xl font-bold text-cc-ink">All done, {kidName}!</div>
        <div className="text-lg font-semibold" style={{ color: "#8A5E00" }}>
          Extra Work unlocked
        </div>
      </div>
      <style>{`
        @keyframes unlockIn { from { opacity: 0 } to { opacity: 1 } }
        @keyframes unlockPop {
          0%   { transform: scale(0.7); opacity: 0 }
          60%  { transform: scale(1.06) }
          100% { transform: scale(1); opacity: 1 }
        }
      `}</style>
    </div>
  );
}
```

- [ ] **Step 4: Fire it when the gate flips**

In `components/chores/chores-board.tsx`, add state and rewrite `addCompletion` (lines 40-44):

```tsx
  const [unlockedKid, setUnlockedKid] = useState<string | null>(null);

  function addCompletion(c: ChoreCompletion) {
    const next = [...optToday, c];
    setOptToday(next);
    setOptWeek((p) => [...p, c]);
    setOptAll((p) => [...p, c]);

    if (c.category !== "expectation") return;
    const wasOpen = liveGate(optToday, c.member_id);
    const nowOpen = liveGate(next, c.member_id);
    if (!wasOpen && nowOpen) {
      const kid = kids.find((k) => k.id === c.member_id);
      if (kid) setUnlockedKid(kid.name);
    }
  }
```

`liveGate` already exists from Task 5 — reuse it, don't redefine it. The comparison must read
`optToday` for `wasOpen` (state before this completion) and the local `next` array for
`nowOpen`, because React state updates are not synchronous.

Render the overlay just inside the outer `<div>`:

```tsx
      {unlockedKid && (
        <UnlockCelebration kidName={unlockedKid} onDone={() => setUnlockedKid(null)} />
      )}
```

- [ ] **Step 5: Verify in the browser**

Run: `npm run dev`, open http://localhost:3000/chores

Check:
- Expectation rows show **no** star chips
- Tapping one bounces green with **no** flying stars
- Completing a kid's **last** expectation shows the overlay, which auto-dismisses after ~2.6s
- The Extra Work tab's 🔒 disappears for that kid without a page reload
- Reload — the completion persists and the tab stays unlocked

- [ ] **Step 6: Verify the build**

Run: `npm run build && npm run lint && npx vitest run`

Expected: only `components/settings/chore-templates-section.tsx` still fails (Task 8).

- [ ] **Step 7: Commit**

```bash
git add components/chores/chore-row.tsx components/chores/chores-board.tsx components/chores/unlock-celebration.tsx
git commit -m "feat(chores): expectations stop paying, unlock celebration on last one"
```

---

## Task 7: The job board

**Files:**
- Create: `components/chores/job-board.tsx`, `components/chores/job-row.tsx`, `components/chores/job-claim-modal.tsx`
- Modify: `components/chores/chores-board.tsx` (replace the Task 5 placeholder)

**Interfaces:**
- Consumes: `claimJob`, `revokeJob`, `ClaimResult` (Task 3); `liveGateByKid` (Task 6)
- Produces: `<JobBoard jobs kids gateByKid claimsToday familyId familyPin today onClaim onRevoke />`

- [ ] **Step 1: Create the claim modal**

Create `components/chores/job-claim-modal.tsx`:

```tsx
"use client";

import MemberAvatar from "@/components/family/member-avatar";
import type { ChoreTemplate, FamilyMember } from "@/lib/types";

interface JobClaimModalProps {
  job: ChoreTemplate;
  kids: FamilyMember[];
  gateByKid: Record<string, boolean>;
  onPick: (kid: FamilyMember) => void;
  onCancel: () => void;
}

export default function JobClaimModal({ job, kids, gateByKid, onPick, onCancel }: JobClaimModalProps) {
  return (
    <div
      onClick={onCancel}
      className="fixed inset-0 z-9997 flex items-center justify-center p-6 touch-manipulation"
      style={{ background: "#1C1A14CC" }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-md rounded-cc-lg px-8 py-8 text-center"
        style={{ background: "#FAF6E8" }}
      >
        <div className="text-5xl mb-2">{job.emoji}</div>
        <div className="text-2xl font-bold text-cc-ink">Who did it?</div>
        <div className="text-base font-semibold mt-1" style={{ color: "#8A5E00" }}>
          {job.name} · earns {"★".repeat(job.star_value)}
        </div>

        <div className="flex justify-center gap-6 mt-7">
          {kids.map((kid) => {
            const open = gateByKid[kid.id];
            return (
              <button
                key={kid.id}
                disabled={!open}
                onClick={() => open && onPick(kid)}
                className="flex flex-col items-center gap-2 touch-manipulation disabled:opacity-40"
              >
                <div className="relative">
                  <MemberAvatar member={kid} size={72} emojiClassName="text-4xl" />
                  {!open && (
                    <div className="absolute inset-0 rounded-full flex items-center justify-center text-2xl"
                         style={{ background: "#1C1A1499" }}>
                      🔒
                    </div>
                  )}
                </div>
                <span className="font-bold text-cc-ink">{kid.name}</span>
                {!open && <span className="text-xs text-slate-500">Finish your jobs</span>}
              </button>
            );
          })}
        </div>

        <button
          onClick={onCancel}
          className="mt-8 px-6 py-2.5 rounded-full font-bold touch-manipulation"
          style={{ background: "#F3EFE0", color: "#1C1A14B3" }}
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Create the job row**

Create `components/chores/job-row.tsx`:

```tsx
"use client";

import { useRef } from "react";
import Image from "next/image";
import MemberAvatar from "@/components/family/member-avatar";
import type { ChoreCompletion, ChoreTemplate, FamilyMember } from "@/lib/types";

interface JobRowProps {
  job: ChoreTemplate;
  kids: FamilyMember[];
  gateByKid: Record<string, boolean>;
  claim: ChoreCompletion | undefined;
  onOpen: () => void;
  onLongPress: () => void;
}

export default function JobRow({ job, kids, gateByKid, claim, onOpen, onLongPress }: JobRowProps) {
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const claimedBy = claim ? kids.find((k) => k.id === claim.member_id) : undefined;

  function startPress() {
    if (!claim) return;
    timer.current = setTimeout(onLongPress, 500);
  }
  function endPress() {
    if (timer.current) clearTimeout(timer.current);
  }

  return (
    <div
      onClick={claim ? undefined : onOpen}
      onPointerDown={startPress}
      onPointerUp={endPress}
      onPointerLeave={endPress}
      className="flex items-center gap-4 rounded-[20px] px-5 py-4 touch-manipulation"
      style={{ background: claim ? "#A7EB98" : "#FFFFFF" }}
    >
      <div className="text-3xl shrink-0">{job.emoji}</div>

      <div className="flex-1 min-w-0">
        <div className="text-lg font-bold text-cc-ink truncate">
          {job.is_special && <span style={{ color: "#6B3088" }}>✦ </span>}
          {job.name}
        </div>
        {claimedBy && (
          <div className="text-sm font-semibold" style={{ color: "#005C00" }}>
            {claimedBy.name} claimed this
          </div>
        )}
      </div>

      <div className="flex items-center gap-1 font-bold shrink-0" style={{ color: "#8A5E00" }}>
        <Image src="/star-small.png" alt="" width={18} height={18} />
        {job.star_value}
      </div>

      <div className="flex gap-1 shrink-0">
        {claimedBy ? (
          <MemberAvatar member={claimedBy} size={36} emojiClassName="text-lg" />
        ) : (
          kids.map((kid) => (
            <div key={kid.id} className="relative" style={{ opacity: gateByKid[kid.id] ? 1 : 0.35 }}>
              <MemberAvatar member={kid} size={36} emojiClassName="text-lg" />
              {!gateByKid[kid.id] && (
                <div className="absolute inset-0 rounded-full flex items-center justify-center text-xs"
                     style={{ background: "#1C1A1499" }}>
                  🔒
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Create the board**

Create `components/chores/job-board.tsx`:

```tsx
"use client";

import { useState } from "react";
import JobRow from "@/components/chores/job-row";
import JobClaimModal from "@/components/chores/job-claim-modal";
import PinGate from "@/components/pin-gate";
import { claimJob, revokeJob } from "@/app/actions/chores";
import type { ChoreCompletion, ChoreTemplate, FamilyMember } from "@/lib/types";

interface JobBoardProps {
  jobs: ChoreTemplate[];
  kids: FamilyMember[];
  gateByKid: Record<string, boolean>;
  claimsToday: ChoreCompletion[];
  familyId: string;
  familyPin: string;
  today: string;
  onClaim: (c: ChoreCompletion) => void;
  onRevoke: (templateId: string) => void;
}

export default function JobBoard({
  jobs, kids, gateByKid, claimsToday, familyId, familyPin, today, onClaim, onRevoke,
}: JobBoardProps) {
  const [picking, setPicking] = useState<ChoreTemplate | null>(null);
  const [revoking, setRevoking] = useState<ChoreTemplate | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const claimByTemplate = Object.fromEntries(claimsToday.map((c) => [c.template_id, c]));

  async function handlePick(job: ChoreTemplate, kid: FamilyMember) {
    setPicking(null);
    const optimistic: ChoreCompletion = {
      id: crypto.randomUUID(),
      family_id: familyId,
      template_id: job.id,
      member_id: kid.id,
      date: today,
      stars_earned: job.star_value,
      completed_at: new Date().toISOString(),
      category: "extra_work",
    };
    onClaim(optimistic);

    // claimJob returns a result for expected outcomes but THROWS on a genuine database
    // error, so the call needs a catch — otherwise a failed query becomes an unhandled
    // rejection inside a click handler and the optimistic claim is never rolled back.
    try {
      const result = await claimJob(job.id, kid.id, familyId, today);
      if (!result.ok) {
        onRevoke(job.id);
        const other = kids.find((k) => k.id !== kid.id);
        setToast(
          result.reason === "already_claimed"
            ? `${other?.name ?? "Someone"} already claimed this one`
            : result.reason === "locked"
            ? `${kid.name} needs to finish their jobs first`
            : "That job isn't available anymore"
        );
        setTimeout(() => setToast(null), 2600);
      }
    } catch {
      onRevoke(job.id);
      setToast("Couldn't save that — try again");
      setTimeout(() => setToast(null), 2600);
    }
  }

  async function performRevoke(job: ChoreTemplate) {
    onRevoke(job.id);
    setRevoking(null);
    try {
      await revokeJob(job.id, today);
    } catch {
      setToast("Couldn't undo that — try again");
      setTimeout(() => setToast(null), 2600);
    }
  }

  if (jobs.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <div className="text-5xl mb-3">🧰</div>
        <p className="font-semibold text-slate-600">No extra work posted</p>
        <p className="text-sm text-slate-400 mt-1">Add jobs in Settings → Extra Work.</p>
      </div>
    );
  }

  return (
    <div className="p-4 flex flex-col gap-3" style={{ background: "#F3EFE0", borderRadius: 35 }}>
      {jobs.map((job) => (
        <JobRow
          key={job.id}
          job={job}
          kids={kids}
          gateByKid={gateByKid}
          claim={claimByTemplate[job.id]}
          onOpen={() => setPicking(job)}
          onLongPress={() => setRevoking(job)}
        />
      ))}

      {picking && (
        <JobClaimModal
          job={picking}
          kids={kids}
          gateByKid={gateByKid}
          onPick={(kid) => handlePick(picking, kid)}
          onCancel={() => setPicking(null)}
        />
      )}

      {revoking && (
        <PinGate
          familyPin={familyPin}
          message={`Undo "${revoking.name}"?`}
          onVerified={() => performRevoke(revoking)}
          onCancel={() => setRevoking(null)}
        >
          <div />
        </PinGate>
      )}

      {toast && (
        <div
          className="fixed bottom-8 left-1/2 -translate-x-1/2 px-6 py-3 rounded-full font-bold z-9999"
          style={{ background: "#1C1A14", color: "#FAF6E8" }}
        >
          {toast}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 4: Wire it into ChoresBoard**

In `components/chores/chores-board.tsx`, add claim state handlers next to `addCompletion`:

```tsx
  const [optClaims, setOptClaims] = useState(claimsToday);

  function addClaim(c: ChoreCompletion) {
    setOptClaims((p) => [...p, c]);
    setOptAll((p) => [...p, c]);
  }

  function removeClaim(templateId: string) {
    setOptClaims((p) => p.filter((c) => c.template_id !== templateId));
    setOptAll((p) => p.filter((c) => !(c.template_id === templateId && c.date === today)));
  }
```

Replace the Task 5 placeholder with:

```tsx
        <div className="flex-1 p-4 overflow-y-auto">
          <JobBoard
            jobs={jobs}
            kids={kids}
            gateByKid={liveGateByKid}
            claimsToday={optClaims}
            familyId={familyId}
            familyPin={familyPin}
            today={today}
            onClaim={addClaim}
            onRevoke={removeClaim}
          />
        </div>
```

Import `JobBoard` at the top.

- [ ] **Step 5: Verify in the browser**

You need at least one extra-work template to test. Insert one directly (Settings UI arrives in Task 8):

```sql
insert into public.chore_templates (family_id, name, emoji, star_value, recurrence, category, is_special, active)
select id, 'Wash the car', '🚗', 3, '{"type":"daily"}'::jsonb, 'extra_work', false, true
from public.families limit 1;
```

Then at http://localhost:3000/chores → Extra Work:
- Job appears with both kids' avatars; locked kids are dimmed with 🔒
- Tapping the row opens the modal; a locked kid's face is not tappable
- Picking an unlocked kid claims it — row turns green, names the claimer
- Reload — the claim persists
- Long-press the claimed row → PIN → claim clears and stars return
- **Race check:** claim it, then in a second browser tab claim it as the other kid. Expected: the toast reads "<Name> already claimed this one" and the row reverts. No crash.

- [ ] **Step 6: Verify the build**

Run: `npm run build && npm run lint && npx vitest run`

- [ ] **Step 7: Commit**

```bash
git add components/chores/job-board.tsx components/chores/job-row.tsx components/chores/job-claim-modal.tsx components/chores/chores-board.tsx
git commit -m "feat(chores): shared extra-work board with claim modal"
```

---

## Task 8: Settings splits in two

**Files:**
- Create: `components/settings/extra-work-section.tsx`
- Modify: `components/settings/chore-templates-section.tsx`, `app/(main)/settings/page.tsx:410-417`

**Interfaces:**
- Consumes: `createChoreTemplate` / `updateChoreTemplate` with `category` + `is_special` (Task 3)
- Produces: `<ExtraWorkSection jobs={ChoreTemplate[]} familyId={string} onChanged={() => void} />`

- [ ] **Step 1: Make the existing section expectations-only**

In `components/settings/chore-templates-section.tsx`:

1. Change the `Form` type and default (lines 12-13) to drop `star_value`:

```ts
type Form = { name: string; emoji: string; recurrence: ChoreRecurrence; memberIds: string[] };
const DEFAULT: Form = { name: "", emoji: "✅", recurrence: { type: "daily" }, memberIds: [] };
```

2. In `openEdit` (line 31), drop `star_value` from the `setForm` call.

3. In `handleSave` (lines 40, 42), pass the category explicitly:

```ts
        await updateChoreTemplate(editing.id, {
          name: form.name, emoji: form.emoji, star_value: 0,
          recurrence: form.recurrence, category: "expectation", is_special: false,
        }, form.memberIds);
```

```ts
        await createChoreTemplate(familyId, {
          name: form.name, emoji: form.emoji, star_value: 0,
          recurrence: form.recurrence, category: "expectation", is_special: false,
        }, form.memberIds);
```

4. Delete the star-value selector block (line 112) and its surrounding label row.
5. In the list row summary (line 84), delete the `{" · "}{"★".repeat(t.star_value)}` fragment.
6. Change the section heading text to **"Expectations"** and add the subtitle: `Everyday jobs. These don't earn stars.`

- [ ] **Step 2: Create the Extra Work section**

Create `components/settings/extra-work-section.tsx`:

```tsx
"use client";

import { useState } from "react";
import { createChoreTemplate, updateChoreTemplate, deleteChoreTemplate } from "@/app/actions/chores";
import type { ChoreTemplate } from "@/lib/types";

type Form = { name: string; emoji: string; star_value: number; is_special: boolean };
const DEFAULT: Form = { name: "", emoji: "🧰", star_value: 1, is_special: false };

interface Props {
  jobs: ChoreTemplate[];
  familyId: string;
  onChanged: () => void;
}

export default function ExtraWorkSection({ jobs, familyId, onChanged }: Props) {
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<ChoreTemplate | null>(null);
  const [form, setForm] = useState<Form>(DEFAULT);
  const [saving, setSaving] = useState(false);

  function openAdd() {
    setEditing(null);
    setForm(DEFAULT);
    setShowModal(true);
  }

  function openEdit(j: ChoreTemplate) {
    setEditing(j);
    setForm({ name: j.name, emoji: j.emoji, star_value: j.star_value, is_special: j.is_special });
    setShowModal(true);
  }

  async function handleSave() {
    if (!form.name.trim() || saving) return;
    setSaving(true);
    const payload = {
      name: form.name,
      emoji: form.emoji,
      star_value: form.star_value,
      recurrence: { type: "daily" as const },
      category: "extra_work" as const,
      is_special: form.is_special,
    };
    try {
      if (editing) await updateChoreTemplate(editing.id, payload, []);
      else await createChoreTemplate(familyId, payload, []);
      setShowModal(false);
      onChanged();
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string) {
    await deleteChoreTemplate(id);
    setShowModal(false);
    onChanged();
  }

  return (
    <div className="mb-8">
      <div className="flex items-center justify-between mb-1">
        <h2 className="text-xl font-bold text-cc-ink">Extra Work</h2>
        <button onClick={openAdd} className="px-4 py-2 rounded-full bg-rose-500 text-white font-semibold touch-manipulation">
          + Add job
        </button>
      </div>
      <p className="text-sm text-slate-400 mb-3">
        Optional jobs anyone can claim. These are the only chores that earn stars.
      </p>

      <div className="flex flex-col gap-2">
        {jobs.map((j) => (
          <button
            key={j.id}
            onClick={() => openEdit(j)}
            className="flex items-center gap-3 bg-white rounded-2xl px-4 py-3 text-left touch-manipulation"
          >
            <span className="text-2xl">{j.emoji}</span>
            <span className="flex-1 font-semibold text-cc-ink">
              {j.is_special && <span style={{ color: "#6B3088" }}>✦ </span>}
              {j.name}
            </span>
            <span className="text-sm text-slate-400">{"★".repeat(j.star_value)}</span>
          </button>
        ))}
        {jobs.length === 0 && <p className="text-sm text-slate-400 py-3">No jobs posted yet.</p>}
      </div>

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-6" style={{ background: "#1C1A14CC" }}>
          <div className="w-full max-w-md rounded-3xl p-6" style={{ background: "#FAF6E8" }}>
            <h3 className="text-lg font-bold mb-4">{editing ? "Edit job" : "New job"}</h3>

            <label className="text-xs font-semibold text-slate-500">Name</label>
            <input
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              className="w-full mb-3 px-4 py-3 rounded-xl bg-white"
              placeholder="Wash the car"
            />

            <label className="text-xs font-semibold text-slate-500">Emoji</label>
            <input
              value={form.emoji}
              onChange={(e) => setForm((f) => ({ ...f, emoji: e.target.value }))}
              className="w-full mb-3 px-4 py-3 rounded-xl bg-white text-2xl"
            />

            <label className="text-xs font-semibold text-slate-500">Stars (1–10)</label>
            <div className="flex gap-1 mb-3 flex-wrap">
              {Array.from({ length: 10 }, (_, i) => i + 1).map((v) => (
                <button
                  key={v}
                  onClick={() => setForm((f) => ({ ...f, star_value: v }))}
                  className={`w-10 py-2 rounded-xl text-sm font-semibold touch-manipulation ${
                    form.star_value === v ? "bg-rose-500 text-white" : "bg-slate-100 text-slate-600"
                  }`}
                >
                  {v}
                </button>
              ))}
            </div>

            <button
              onClick={() => setForm((f) => ({ ...f, is_special: !f.is_special }))}
              className={`w-full mb-4 py-3 rounded-xl font-semibold touch-manipulation ${
                form.is_special ? "bg-purple-100 text-purple-700" : "bg-slate-100 text-slate-500"
              }`}
            >
              {form.is_special ? "✦ Marked as a one-off" : "Mark as a one-off"}
            </button>

            <div className="flex gap-2">
              <button onClick={() => setShowModal(false)} className="flex-1 py-3 rounded-xl bg-slate-100 font-semibold touch-manipulation">
                Cancel
              </button>
              <button onClick={handleSave} disabled={saving} className="flex-1 py-3 rounded-xl bg-rose-500 text-white font-semibold touch-manipulation disabled:opacity-50">
                Save
              </button>
            </div>

            {editing && (
              <button onClick={() => handleDelete(editing.id)} className="w-full mt-2 py-3 rounded-xl text-red-500 font-semibold touch-manipulation">
                Delete job
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
```

`updateChoreTemplate` is called with `[]` for member ids, which clears any assignment rows. That is correct: jobs are an open pool and must never have member assignments.

- [ ] **Step 3: Render both sections**

In `app/(main)/settings/page.tsx`:

1. Add the import next to the existing one on line 7:

```ts
import ExtraWorkSection from "@/components/settings/extra-work-section";
```

2. Add jobs state next to the existing `templates` state on line 46:

```ts
  const [jobs, setJobs] = useState<ChoreTemplate[]>([]);
```

3. In `loadData`, where templates are loaded (lines 96-125), split by category before building
   the `memberIds` map. Replace the block that currently sets `templates` state with:

```ts
      const loaded = (templatesData ?? []) as ChoreTemplate[];
      const expectations = loaded.filter((t) => t.category === "expectation");
      setJobs(loaded.filter((t) => t.category === "extra_work"));

      const allTMs = (templateMembersData ?? []) as ChoreTemplateMember[];
      setTemplates(
        expectations.map((t) => ({
          ...t,
          memberIds: allTMs.filter((tm) => tm.template_id === t.id).map((tm) => tm.member_id),
        }))
      );
```

Only expectations carry `memberIds`; jobs are an open pool and go into state untouched.

4. After `<ChoreTemplatesSection ... />` (line 410), add:

```tsx
        <ExtraWorkSection jobs={jobs} familyId={family.id} onChanged={loadData} />
```

- [ ] **Step 4: Verify in the browser**

At http://localhost:3000/settings (enter the PIN):
- **Expectations** section has no star selector; saving works and the chore still appears on the Today tab
- **Extra Work** section adds a job with a 1–10 star value and the ✦ toggle
- A new job appears immediately on the chores Extra Work tab
- Editing a job's star value updates the board
- Deleting a job removes it from the board
- Delete the `Wash the car` row you inserted by hand in Task 7 if you no longer want it

- [ ] **Step 5: Verify the build**

Run: `npm run build && npm run lint && npx vitest run`

Expected: all pass. This is the first task where the build is fully clean.

- [ ] **Step 6: Commit**

```bash
git add components/settings/extra-work-section.tsx components/settings/chore-templates-section.tsx "app/(main)/settings/page.tsx"
git commit -m "feat(settings): split chore management into expectations and extra work"
```

---

## Task 9: Rewards quick-add

**Files:**
- Modify: `components/chores/rewards-view.tsx`

**Interfaces:**
- Consumes: `createStarReward(familyId, { name, emoji, star_cost })` — already exists at `app/actions/chores.ts:105`
- Produces: nothing consumed downstream

- [ ] **Step 1: Add quick-add state and the button**

In `components/chores/rewards-view.tsx`, add to the component body:

```tsx
  const [adding, setAdding] = useState(false);
  const [pinOk, setPinOk] = useState(false);
  const [form, setForm] = useState({ name: "", emoji: "🎁", star_cost: 10 });
  const [saving, setSaving] = useState(false);

  async function saveReward() {
    if (!form.name.trim() || saving) return;
    setSaving(true);
    try {
      await createStarReward(familyId, form);
      setAdding(false);
      setPinOk(false);
      setForm({ name: "", emoji: "🎁", star_cost: 10 });
    } finally {
      setSaving(false);
    }
  }
```

Import `useState`, `createStarReward`, and `PinGate`.

Render a button beneath the reward list:

```tsx
      <button
        onClick={() => setAdding(true)}
        className="mt-3 w-full py-3 rounded-2xl font-bold touch-manipulation"
        style={{ background: "#F3EFE0", color: "#1C1A14B3" }}
      >
        + Add reward
      </button>
```

- [ ] **Step 2: Gate it behind the PIN and show the form**

```tsx
      {adding && !pinOk && (
        <PinGate
          familyPin={familyPin}
          message="Add a reward"
          onVerified={() => setPinOk(true)}
          onCancel={() => setAdding(false)}
        >
          <div />
        </PinGate>
      )}

      {adding && pinOk && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-6" style={{ background: "#1C1A14CC" }}>
          <div className="w-full max-w-sm rounded-3xl p-6" style={{ background: "#FAF6E8" }}>
            <h3 className="text-lg font-bold mb-4">New reward</h3>
            <input
              value={form.emoji}
              onChange={(e) => setForm((f) => ({ ...f, emoji: e.target.value }))}
              className="w-full mb-3 px-4 py-3 rounded-xl bg-white text-2xl"
            />
            <input
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              placeholder="Movie ticket"
              className="w-full mb-3 px-4 py-3 rounded-xl bg-white"
            />
            <input
              type="number"
              value={form.star_cost}
              onChange={(e) => setForm((f) => ({ ...f, star_cost: Number(e.target.value) }))}
              className="w-full mb-4 px-4 py-3 rounded-xl bg-white"
            />
            <div className="flex gap-2">
              <button onClick={() => { setAdding(false); setPinOk(false); }} className="flex-1 py-3 rounded-xl bg-slate-100 font-semibold touch-manipulation">
                Cancel
              </button>
              <button onClick={saveReward} disabled={saving} className="flex-1 py-3 rounded-xl bg-rose-500 text-white font-semibold touch-manipulation disabled:opacity-50">
                Save
              </button>
            </div>
          </div>
        </div>
      )}
```

`RewardsView` already receives `familyId` and `familyPin` (see `kid-column.tsx:86-87`), so no prop changes are needed.

- [ ] **Step 3: Verify in the browser**

At http://localhost:3000/chores → Rewards:
- "+ Add reward" prompts for the PIN
- A wrong PIN shakes and does not open the form
- Saving creates the reward; it appears for **both** kids after the page revalidates
- The new reward also shows in Settings → Star Rewards

- [ ] **Step 4: Verify the build**

Run: `npm run build && npm run lint && npx vitest run`

- [ ] **Step 5: Commit**

```bash
git add components/chores/rewards-view.tsx
git commit -m "feat(chores): quick-add rewards from the Rewards tab"
```

---

## Final verification

Run the spec's full checklist (spec §12) against the dev server. Every item must pass before this is considered done.

- [ ] Existing templates are expectations, pay nothing, remain tappable
- [ ] Historical star balances unchanged from before the migration
- [ ] Expectation check-off plays no star burst
- [ ] Last expectation triggers the unlock overlay and clears the 🔒 without a reload
- [ ] Board locks per-kid — one child unlocked while the other is not
- [ ] A kid with no scheduled expectations sees an unlocked board
- [ ] Claiming pays the correct kid and locks the row for the day
- [ ] Second kid claiming the same job gets "already claimed", not a crash
- [ ] Claimed jobs return unclaimed the next day (change the device date or edit the completion's `date` in Supabase to confirm)
- [ ] Long-press revoke returns the stars and reopens the row
- [ ] `chk_pay_matches_category` rejects a paid expectation and a free job (re-run Task 1 Step 4 probes)
- [ ] `claimJob` rejects a locked kid even if the client allowed it (temporarily force `gateByKid` true in devtools)
- [ ] Settings creates expectations without a star field and jobs without recurrence
- [ ] Quick-add on the Rewards tab creates a reward behind the PIN
- [ ] `is_special` jobs show the ✦ badge and behave identically
- [ ] Week view shows expectations only
- [ ] One kid can claim several different jobs in one day

- [ ] **Drop the Task 1 backups** — only once every box above is checked:

```sql
drop table public.chore_templates_backup_005;
drop table public.chore_completions_backup_005;
```

- [ ] **Update `CLAUDE.md`** — revise the Phase 5 bullet to describe the three-bucket model, note migration `005` as applied, and link the new spec.

```bash
git add CLAUDE.md
git commit -m "docs(claude.md): chores three-bucket model shipped"
```
