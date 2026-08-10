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
