# Chores Restructure: Expectations / Extra Work / Expenses — Design Spec

**Date:** 2026-08-10
**Status:** Approved
**Supersedes parts of:** `2026-04-26-chores-design.md` (Phase 5)

---

## 1. Overview

Phase 5 shipped a flat star economy: every chore carries a `star_value`, completing
one mints stars, rewards burn them. Every chore pays, so contributing to the household
and earning are the same act.

This restructure splits that into a three-category model borrowed from a family-finance
framework:

- **Expectations** — what you do because you live here. Pays nothing.
- **Extra work** — optional jobs above the baseline. The only thing that earns.
- **Expenses** — things the kid now funds themselves.

The lesson the split teaches is the one the flat model can't: being part of a family
isn't transactional, and money comes from work you chose to take on.

**Currency stays abstract.** Balances are stars, not dollars. No real money, no cash-out,
no ledger of household debt.

---

## 2. Scope

**Included:**
- `category` split on chore templates (`expectation` | `extra_work`)
- Expectations become unpaid and gate access to extra work
- Extra work becomes a family-wide open pool on its own tab, claimed via a "who did it?" modal
- Top-level view tabs replace the current per-column view switchers
- Settings splits chore management into Expectations and Extra Work sections
- Quick-add for rewards from the Rewards tab
- Migration `005_chores_three_buckets.sql`

**Not included:**
- Real-money tracking, allowance payouts, or cash-out
- A separate "expenses" table or surface — expenses are `star_rewards` rows (see §3)
- Parent approval queues for extra work (claims are instant, revocable)
- Auto-expiry of one-off job postings — they persist until deleted by hand
- Job claim locking or reservation between kids
- Age-based eligibility rules on jobs

---

## 3. Concept Model

The three framework buckets do **not** become three new things in the app. They land on
two chore categories plus the store that already exists:

| Framework | In the app | Pays | Assigned | Available |
|---|---|---|---|---|
| Expectations | `chore_templates` where `category='expectation'` | Never | Per kid, via `chore_template_members` | On its recurrence schedule |
| Extra work | `chore_templates` where `category='extra_work'` | Yes | Nobody — open pool | Always, until deleted |
| Expenses | `star_rewards` — unchanged | — | — | Always |

**Why expenses need no new schema.** An expense in this family's terms is a movie ticket,
a birthday present for a friend, a gift for a sibling — a named thing with a star cost
that a kid spends down to. That is exactly what `star_rewards` already models. Expenses
and rewards are mechanically identical and are collectively called **rewards** in the UI.
The distinction between "a cost you must cover" and "a splurge you saved for" is a
labeling difference the parents apply when naming the row, not a structural one.

**Consequence for extra work.** Because the pool is open, `chore_template_members` and
`recurrence` are meaningless for `extra_work` rows. Those columns are inert for that
category. This is the accepted cost of keeping one templates table (see §11).

---

## 4. Data Model Changes

### Migration `005_chores_three_buckets.sql`

```sql
alter table public.chore_templates
  add column category text not null default 'expectation'
    check (category in ('expectation','extra_work')),
  add column is_special boolean not null default false;

-- Every pre-existing template is a recurring, assigned, paid chore — i.e. an
-- expectation minus the payment. Zero the values before adding the constraint.
update public.chore_templates set star_value = 0;

alter table public.chore_templates
  add constraint chk_pay_matches_category check (
    (category = 'expectation' and star_value = 0) or
    (category = 'extra_work'  and star_value > 0)
  );

-- Denormalized purely so the partial unique index below can exist.
alter table public.chore_completions
  add column category text not null default 'expectation'
    check (category in ('expectation','extra_work'));

update public.chore_completions c set category = t.category
  from public.chore_templates t where c.template_id = t.id;

-- Extra work is claimable once per job per day, family-wide.
create unique index idx_extra_work_once_per_day
  on public.chore_completions(template_id, date)
  where category = 'extra_work';
```

### Index behavior

The existing `idx_chore_completions_unique` on `(template_id, member_id, date)` stays and
continues to enforce one completion per kid per expectation per day. The new partial index
adds a stricter, family-wide cap that applies only to extra work. Both coexist.

**The cap is per job, not per kid.** A child may claim any number of *different* jobs in a
day; what they cannot do is claim the same job twice, and neither can their sibling.

### Why `category` is denormalized onto completions

A partial unique index cannot join to `chore_templates` to read the category, so the cap
would otherwise have to be enforced in a server action — a guard that is easy to forget
and impossible to trust under concurrency. Copying the category onto the completion row at
insert moves the rule into Postgres. `claimJob()` and `completeChore()` are responsible for
setting it correctly.

### Historical balances

Existing `chore_completions` rows keep their `stars_earned` values. Kids earned those stars
under the old rules; the new rules apply going forward only. No claw-back, no reset. Opening
balances under the new system are inherited from the old one, which is intentional.

`computeStarBalance()` in `lib/chores.ts` needs no change — expectations insert
`stars_earned = 0` and therefore contribute nothing to the sum.

---

## 5. The Gate

Extra work is locked for a kid until that kid's expectations for the day are done.

```
gateOpen(memberId, date) =
  every expectation template that is
    (a) active,
    (b) assigned to memberId via chore_template_members, and
    (c) scheduled on `date` per isScheduledToday()
  has a matching chore_completions row for (template_id, memberId, date)
```

- **Evaluated per kid, per day.** The board can be unlocked for one child and locked for
  the other at the same moment, so the lock renders per-kid on each job row rather than
  over the whole board.
- **Vacuously open.** A kid with no expectations scheduled today has nothing to finish
  first, so the board is unlocked.
- **Computed server-side** in the page component, then recomputed client-side as boxes are
  checked so the unlock is immediate rather than waiting on a round trip.
- **Re-locking is forward-only.** If a parent adds an expectation or revokes a completion
  after a kid has already claimed a job, the gate closes for *future* claims. Stars already
  earned are never removed by a gate change.

---

## 6. Page Architecture

### `/app/(main)/chores/page.tsx` (server component)

Fetches in parallel:
- `family_members` where `role = 'child'` and `chores_enabled = true`
- `chore_templates` where `active = true`, split by `category`, expectations joined to
  their assigned members
- `chore_completions` for today and the current week
- `star_rewards` and `star_redemptions` for balance computation

Computes `gateOpen` per child and passes everything to `<ChoresBoard>`.

### Server actions (`app/actions/chores.ts`)

| Action | Behavior |
|---|---|
| `completeChore(templateId, memberId, date)` | Inserts an expectation completion with `stars_earned = 0`, `category = 'expectation'` |
| `uncompleteChore(templateId, memberId, date)` | Deletes the completion (parent, PIN-gated) |
| `claimJob(templateId, memberId, date)` | Inserts an extra-work completion with `category = 'extra_work'` and `stars_earned` copied from the template. Rejects if the gate is closed for that member. Handles `23505` as "already claimed" |
| `revokeJob(templateId, date)` | Deletes the claim, returning the stars (parent, PIN-gated) |
| `redeemReward(rewardId, memberId)` | Unchanged |

All actions call `revalidatePath('/chores')` on success.

**`claimJob` re-checks the gate server-side.** The client-side gate is for responsiveness;
it is not the authority.

---

## 7. Component Tree

The per-column view switchers from Phase 5 are replaced by a single top-level tab bar,
because a shared job board cannot live inside a per-kid column.

```
ChoresBoard (client)
├── ViewTabs ── Today │ Extra Work │ Week │ Rewards
├── TodayView
│   └── KidColumn × 2
│       ├── KidHeader — avatar, name, star balance, progress
│       └── ExpectationRow × N — tap circle, name (NO star chip)
├── JobBoard (new, shared)
│   ├── JobRow × N — emoji, name, ★ value, ✦ special badge, per-kid lock avatars
│   └── JobClaimModal — job name, payout, kid picker with locked states
├── WeekView — expectations only
└── RewardsView — both kids side by side + "Add reward" quick-add
```

**Trade-off accepted:** kids can no longer view different sections simultaneously (Nora on
Rewards while Ellis is on Today). One coherent navigation model replaces two nested ones.

**Star balance** remains in the kid's column header on Today. Expectations show no star
chips at all — that absence is the point.

**Week view** covers expectations only. It is a routine-consistency view; extra work is
optional by definition and its absence on a given day means nothing.

---

## 8. Interaction Flows

### Expectation check-off

1. Kid taps the circle on an `ExpectationRow`
2. Optimistic update via the existing `pendingComplete` pattern
3. Green fill, checkmark, strikethrough via `startViewTransition` — **no star burst**,
   because nothing was earned
4. `completeChore(...)` inserts the row
5. On failure: optimistic state rolls back, brief error toast
6. **When the last expectation of the day is checked**, a larger celebration plays and the
   job board visibly unlocks

The unlock *is* the reward for finishing your part. That is the framework expressed as an
animation.

### Job claim

1. Kid opens the **Extra Work** tab
2. Taps a `JobRow` → `JobClaimModal` opens showing the job name, payout, and both kids'
   avatars; a kid whose gate is closed appears greyed with a lock
3. Kid taps their own avatar
4. Optimistic claim; star burst plays in the modal; modal closes
5. `claimJob(...)` inserts the completion
6. Row locks for the rest of the day showing the claimer's avatar
7. On failure: rollback, toast, board refetches

### Revoke (parent)

Long-press a claimed `JobRow` → `<PinGate>` → `revokeJob(...)` → stars return, row reopens.
Mirrors the existing long-press-to-undo on chore completions.

### Next day

Claimed jobs return to the board unclaimed. Jobs are never removed automatically, including
one-off postings.

---

## 9. Settings Changes

The current **Chore Templates** section splits in two. Both remain inside the PIN gate that
already wraps the settings page.

**Expectations**
- Fields: name, emoji, recurrence (daily / weekdays / custom days), assigned kids
- No star field — `chk_pay_matches_category` forbids a non-zero value
- Delete is a soft delete (`active = false`), unchanged

**Extra Work**
- Fields: name, emoji, star value (1–10), `is_special` toggle
- No recurrence, no kid assignment — jobs are always available and open to both
- Star range widened from Phase 5's 1–3 selector; a garage is not a made bed

**Rewards**
- Section itself unchanged
- Gains a matching **"Add reward"** quick-add on the Rewards tab of the chores screen,
  opening the same modal behind the same PIN. Rewards in this family are reactive — a
  movie ticket on Saturday, a friend's birthday present — and requiring a trip into
  Settings to create one is friction at exactly the wrong moment.

**Family Members**
- `chores_enabled` toggle unchanged

---

## 10. Edge Cases and Error Handling

| Case | Behavior |
|---|---|
| Both kids claim the same job simultaneously | Partial unique index rejects the loser with `23505`. Catch that code specifically and show "<Name> already claimed this one" — not a generic failure. **This will genuinely happen**: two kids, one screen |
| Expectation added, or completion revoked, after a claim | Gate closes for future claims; the existing claim and its stars stand |
| Job deleted while the claim modal is open | Claim fails, toast, board refetches |
| Kid has no expectations scheduled today | Gate is vacuously open |
| Kid has expectations but none assigned to them at all | Gate is vacuously open |
| Both kids are locked | Jobs stay visible with every avatar locked. The board is browsable but nothing is claimable — seeing what you could earn is the motivation to go finish your expectations |
| `is_special` badge | Purely presentational — affects no query, no rule, no availability. This is why it is nearly free |
| Client gate disagrees with server | Server wins; `claimJob` re-checks and rejects |

All writes follow the existing optimistic-with-rollback pattern established in Phase 5.

---

## 11. Design Trade-offs Accepted

**Inert columns on `chore_templates`.** `recurrence` and `chore_template_members` apply
only to expectations; nothing enforces that a stray `recurrence` on an extra-work row is
ignored beyond the query layer. The alternative — a separate `job_postings` table — buys
schema purity at the cost of a second completion path, a second server-action set, and a
second settings section, for a distinction the kids never perceive. The
`chk_pay_matches_category` constraint keeps the most dangerous half of the ambiguity
(who pays) enforced in the database.

**One-off jobs never expire.** A `is_special` job persists and stays claimable daily until
deleted by hand. This is deliberate: no expiry job, no dated table, no cleanup logic. The
garage gets messy again.

---

## 12. Verification

1. Existing templates migrate to `expectation`, pay nothing, remain tappable
2. Historical star balances survive the migration unchanged
3. Expectation check-off plays no star burst
4. Completing the last expectation plays the larger celebration and unlocks the board
   without a page reload
5. Job board is locked per-kid; one child can be unlocked while the other is not
6. A kid with no scheduled expectations sees an unlocked board
7. Claiming pays the correct kid and locks the row for the day
8. A second kid claiming the same job gets "already claimed", not a crash
9. Claimed jobs return to the board unclaimed the next day
10. Parent long-press revoke returns the stars and reopens the row
11. `chk_pay_matches_category` rejects an expectation with a star value and a job without one
12. `claimJob` rejects a claim from a kid whose gate is closed, even if the client allowed it
13. Settings creates expectations without a star field and jobs without recurrence
14. Quick-add on the Rewards tab creates a reward behind the PIN
15. `is_special` jobs show the ✦ badge and behave identically to standard jobs
16. Week view shows expectations only — extra work never appears in it
17. One kid can claim several different jobs in the same day
