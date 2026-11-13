@AGENTS.md

# ChuppaCal — project notes

Family wall calendar for a Raspberry Pi 4 and Acer UT222Q touchscreen, also used on phones. The Pi runs Raspberry Pi OS Desktop/Wayland (`labwc`) and launches Chromium in kiosk mode; Vercel hosts the Next.js app and Supabase hosts Auth/Postgres/Storage. Production is `https://chuppa-cal.vercel.app`.

## Read first

- [README](README.md): actual features, setup, verification and current release state.
- [Release gate](docs/release-2026-09-27.md): live migration evidence and remaining deployment/acceptance work.
- [Re-audit](docs/audit-2026-09-26.md): numbered approval queue. Approved: 5, 7–12; held: 1–4, 6.
- [Pi runbook](docs/pi-kiosk-runbook.md): boot, maintenance and recovery.
- Specs/plans in `docs/superpowers/` for historical product rules.

**Important:** Migrations 005–009 are applied to the live Supabase project via its SQL Editor, and matching app code is directly deployed to Vercel. Do not rerun 003 or 005–009 on the live database. The user authorized applying migrations to disposable test data without a backup; no restorable live backup exists. Supabase Free currently offers no project backup there. This machine's `pg_dump` is PostgreSQL 14 while live Postgres is 17.6; acquire compatible tools and a private direct DB connection before relying on backups for future real data.

## Stack and behavior

- Next.js 16.3.6 App Router, React 19, TypeScript, Tailwind 4. Read the **installed** `node_modules/next/dist/docs/` for any relevant API before editing; training-memory Next conventions may be wrong. `proxy.ts` is the session proxy and request APIs are async.
- Supabase browser/request/service-role clients in `lib/supabase/`. The service-role key must stay server-only. RLS and data-integrity RPCs are in `supabase/migrations/`. `lib/types.ts` is maintained manually.
- Google login via Supabase Auth and a **separate** read-only Google Calendar OAuth grant. The GitHub workflow is configured to invoke `/api/cron/sync-calendars` about every five minutes. Its `CALENDAR_SYNC_URL` and `CRON_SECRET` repository secrets must match the deployment.
- Today, calendar (day/five-day/month/phone agenda), chores/stars, weekly meals and shared lists. The default family timezone is America/Chicago. Calendar sync mirrors a bounded window, not all historical Google data.
- Family-scoped Realtime broadcasts carry only invalidation table names; polling/return-to-page refresh remains as fallback. Kiosk sleep/idle photo clock and read-only offline Today snapshot are optional/disabled by default.
- Robuck Rounded display font, bundled National Park body and Geist Mono utilities; color tokens are in `app/globals.css`.

## Explicit trust and product boundaries

- Held items 1–4, 6 remain: client-side parent PIN, browser-readable connection credentials through family RLS, public family-photo bucket, reusable UUID invites, and destructive member/reward history. Do not describe this as hardened multi-tenant security or introduce a child-restricted account without a separate decision.
- HEY's documented sharing is read-only ICS; a CalDAV interface has not been confirmed. Voice/Alexa/Claude and offline writes are not implemented. Do not store new third-party secrets or send household data without choosing a provider/privacy model.
- A local green build and structurally verified hosted migration do not prove hosted app workflows, Realtime delivery, Google consent, physical Pi behavior, or backup restore. Keep those states distinct in reports.

## Commands

```bash
npm run dev
npm run check
node scripts/test-database.mjs
npm run build
node scripts/verify-database.mjs # read-only live probe when configured
```

The database test spins up a disposable local PostgreSQL fixture and dump/restore; it never reads `.env.local`. `scripts/backup-live-database.mjs` is an operator-only tool using `SUPABASE_DB_URL` and compatible `pg_dump`/`pg_restore`; inspect `docs/release-2026-09-27.md` before using it. Production deploys may auto-trigger when the configured branch is pushed, so do not push casually.
