# ChuppaCal

A family calendar for a Raspberry Pi wall kiosk and phones. It uses Next.js, Supabase Auth/Postgres/Storage, read-only Google Calendar, and optional OpenWeatherMap weather.

## Release state

The September 27 approved app work is live at [chuppa-cal.vercel.app](https://chuppa-cal.vercel.app), and migrations **005–009 were applied to its Supabase project**. The migration objects and deployed routes passed structural/read-only checks, but authenticated family workflows, Google sync, Realtime delivery, and phone/Pi acceptance remain unverified. The user confirmed the existing records are disposable test data and authorized the migration without a restorable backup; no backup was taken. The September 27 deployment was uploaded directly to Vercel. See [the release record](docs/release-2026-09-27.md) and [the original re-audit](docs/audit-2026-09-26.md).

This remains a household prototype, not a secure multi-tenant product. Approval items 1–4 and 6 are on hold: the parent PIN is a client-side convenience lock; Google credentials remain in a family-readable table; family photos are in a public bucket; UUID-based invites are reusable; and reward/member deletion can remove history. Do not treat the kiosk as a restricted child account.

## Features

- Today dashboard with upcoming events, dinner, remaining child expectations, and calendar-sync warning.
- Calendar day, five-day, month, and phone agenda views, member filters, overlapping/multi-day events, family-timezone date handling, and weather.
- Google calendar selection, manual sync/reconnect/status, and a bounded full-window importer that reconciles moved/cancelled events transactionally while preserving rows outside the window.
- Expectations, extra-work claims, star balances, and reward redemptions via family-scoped database transactions; atomic template/assignment edits.
- Weekly meals with recipe links/ingredients and an explicit, deduplicated grocery-list transfer; shared lists and idempotent starter-list creation.
- Family-scoped Realtime *invalidation* (no row payloads), with the existing refresh-on-return/polling fallback.
- Kiosk touch keyboard, optional scheduled sleep and idle clock cycling existing family member photos. Both display modes default off. Optional read-only offline Today snapshot is opt-in per device and expires after seven days; it does not queue writes or cache authenticated pages.

The intended IANA timezone defaults to `America/Chicago` until the household selects another one in Settings. Historical dates are not automatically rewritten.

## Local setup

1. Use Node.js 22.20+; run `npm ci --ignore-scripts`.
2. Copy `.env.example` to `.env.local` and enter **development** Supabase/Google credentials. Never commit real credentials. The service-role key is server-only and bypasses RLS.
3. Use a separate Supabase development project. Apply `supabase/migrations/001`–`009` in filename order to a new empty project. **Never replay 003 against live data:** it drops the old chore-assignment model. The existing live project already has 005–009; do not replay them or assume the dashboard recorded CLI migration history.
4. Configure Google sign-in in Supabase Auth and the separate Calendar OAuth callback (`/api/calendar/google/callback`) for each intended origin. The login account and connected calendar account can differ.
5. Run `npm run dev` and open `http://localhost:3000`. Create a test family, add children, connect a test calendar, and try chores, meals, and lists.

National Park and Geist Mono fonts are bundled from npm; Robuck Rounded is served from `public/fonts`. Builds do not download fonts from Google.

## Verification

```bash
npm run check                 # strict lint, types and unit/component tests
node scripts/test-database.mjs # disposable local PostgreSQL migration/RLS/RPC/restore tests
npm run build                 # production bundle
npm run build -- --webpack    # documented Next fallback if Turbopack cannot bind a local worker port
npm audit                     # current dependency advisories
node scripts/verify-database.mjs # optional read-only live columns/photo-bucket probe
```

`test-database.mjs` requires local PostgreSQL tools (`initdb`, `pg_ctl`, `psql`, `pg_dump`, `pg_restore`) and never reads `.env.local` or contacts Supabase. It uses a Supabase-shaped local fixture; it does **not** prove deployment compatibility, hosted Realtime delivery, or a production restore. CI runs these checks without production secrets. `verify-database.mjs` does not validate constraints, RLS, policies, backups, or end-to-end workflows.

## Calendar operations

The GitHub workflow `.github/workflows/sync-calendars.yml` is configured to call `/api/cron/sync-calendars` approximately every five minutes. Check the workflow state and recent run results in GitHub Actions. Set repository secrets `CALENDAR_SYNC_URL` (full deployed endpoint) and `CRON_SECRET`, matching the server secret. Missing/mismatched authorization fails closed. A 502 / `ok:false` signals at least one attempted connection failed; 200 / `ok:true` does not establish that any calendar is configured. The worker limits concurrent calls and preserves the last successful mirror on a failed fetch. Settings shows sync age/errors and supports an authorized manual retry/reconnect.

The importer mirrors a rolling 14-day-back/60-day-ahead window, not a historical Google backup. It must pass a live Google acceptance test for recurring events, moved/cancelled events, all-day dates, and calendar changes before release. Old cached rows outside the window remain. Google consent/publishing and redirect settings must be verified in their dashboards.

## Deployment and devices

Production is `https://chuppa-cal.vercel.app`. The September 27 direct deployment was `dpl_5dWc4qKHdK3LcaHGhH3intH2qHTL`. The app is deployed but not fully accepted. Run the remaining [release checklist](docs/release-2026-09-27.md), then test the live household on the Pi and a phone. See the [Pi runbook](docs/pi-kiosk-runbook.md) for auto-launch, recovery and display settings. `?kiosk=1` turns on the on-screen keyboard for that device; `?kiosk=0` turns it off.

## Code map

- `app/(main)`: authenticated Today, calendar, chores, meals, lists and settings.
- `app/actions`, `app/api`: validated mutations, onboarding, Google OAuth and the calendar worker.
- `lib/supabase`, `lib/google`, `lib/calendar*`, `lib/chores`, `lib/time-zone`: backend clients and domain rules.
- `components`: feature boards, dialogs, kiosk/offline/refresh behavior.
- `supabase/migrations`: forward schema/RLS/RPC history; `lib/types.ts` is manually maintained.
- `tests`, `scripts`: regression suites and read-only/local database tools.

[HEY's published sharing path](https://help.hey.com/article/829-share-a-hey-calendar) is a read-only ICS feed, not a verified CalDAV account integration. Voice/Alexa/Claude integration and offline writes are not implemented. Those require separate provider, credential, privacy and product decisions.
