-- Fix: replace partial unique index with a full unique constraint so that
-- Supabase upsert ON CONFLICT (connection_id, external_id) works correctly.

drop index if exists public.idx_calendar_events_external;

alter table public.calendar_events
  add constraint calendar_events_connection_external_unique
  unique (connection_id, external_id);
