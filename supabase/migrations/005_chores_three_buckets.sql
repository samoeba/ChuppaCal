-- Phase 5 restructure: expectations (unpaid, gating) vs extra work (paid, open pool).
-- Spec: docs/superpowers/specs/2026-08-10-chores-three-buckets-design.md

alter table public.chore_templates
  add column category text not null default 'expectation'
    check (category in ('expectation','extra_work')),
  add column is_special boolean not null default false;

-- Every pre-existing template is a recurring, assigned, paid chore -- i.e. an
-- expectation minus the payment. Zero the values BEFORE adding the constraint.

-- 001 created `check (star_value between 1 and 3)`, which nothing since has dropped.
-- It is incompatible in both directions with the three-bucket model: expectations must
-- store 0, and jobs may go to 10. Drop it before zeroing, then re-add a widened range.
alter table public.chore_templates
  drop constraint if exists chore_templates_star_value_check;

update public.chore_templates set star_value = 0;

alter table public.chore_templates
  add constraint chk_pay_matches_category check (
    (category = 'expectation' and star_value = 0) or
    (category = 'extra_work'  and star_value > 0)
  );

alter table public.chore_templates
  add constraint chore_templates_star_value_range check (star_value between 0 and 10);

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

-- Post-apply verification — both of these must be true before anyone claims a job:
--   select conname, pg_get_constraintdef(oid) from pg_constraint
--     where conrelid = 'public.chore_templates'::regclass and contype = 'c';
--   -- expect chk_pay_matches_category + chore_templates_star_value_range,
--   -- and NO chore_templates_star_value_check
--   select indexname from pg_indexes where tablename = 'chore_completions';
--   -- expect idx_extra_work_once_per_day to be present
