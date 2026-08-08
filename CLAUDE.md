@AGENTS.md

# ChuppaCal — DIY Family Calendar

## Project Overview
A DIY replacement for the Skylight Max Calendar (~$300 budget). Touch-screen family hub wall-mounted in the kitchen for a family of 5 (2 adults, 3 kids ages 6, 4, 1).

## Key Documents
- **Design spec:** `docs/superpowers/specs/2026-04-15-family-calendar-design.md`
- **Implementation plan:** `.claude/plans/twinkling-doodling-emerson.md`
- **Database migration:** `supabase/migrations/001_initial_schema.sql`

## Tech Stack
- **Frontend:** Next.js 16 (App Router, TypeScript, Tailwind CSS)
- **Backend:** Supabase (PostgreSQL, Auth, Realtime, Storage) — free tier
- **Hosting:** Vercel (free Hobby tier)
- **Hardware:** Acer UT222Q 21.5" touchscreen + Raspberry Pi 4 (4GB)
- **Calendar sync:** Google Calendar API + Hey Calendar (CalDAV)
- **Weather:** OpenWeatherMap API

## Design System
- **Display font:** Robuck Rounded (self-hosted, `public/fonts/RobuckRounded.woff2`)
- **Body font:** National Park (Google Fonts)
- **Color palette:** cc-beige, cc-cream, cc-ink + family colors (sun, sky, clover, coral, petal, lagoon, plum)
- **Design tokens:** defined in `app/globals.css` under `@theme inline`
- **Typography classes:** `.text-display-xl`, `.text-heading-md`, `.text-body`, `.text-caption`, `.text-label`

## Architecture
Pi runs Chromium in kiosk mode → loads Vercel URL. Supabase is the cloud backend. Same URL works on phones for mobile access. Pi is just a browser — zero server maintenance.

## Next.js 16 Notes
- `middleware.ts` is renamed to `proxy.ts` with `export function proxy()` (not `middleware()`)
- All request APIs are async: `await cookies()`, `await params`, `await searchParams`
- `useSearchParams()` must be wrapped in `<Suspense>`
- Layouts are static by default — auth checks go in leaf components

## Current Status — Live in Production

The app is deployed at **https://chuppa-cal.vercel.app** and pulling real calendar data on a 5-min loop. See "Production" section below for deploy + repo + sync details. The remaining work is on-device verification, kiosk hardware setup, and the optional Phase 9 voice work.

### ✅ Completed
- **Phase 1: Project Scaffolding & Database**
  - Next.js 16 project with TypeScript, Tailwind, Supabase client libs
  - Full database schema (13 tables) with RLS policies deployed to Supabase
  - Supabase client helpers (browser, server, service-role)
  - TypeScript types (`lib/types.ts`), Vercel cron config (`vercel.json`)
  - `.env.local` configured with Supabase keys

- **Phase 2: Auth & Family Setup**
  - Google OAuth via Supabase Auth (login page, callback route, proxy)
  - Family creation onboarding wizard (`/api/onboarding` server route uses service-role to bypass RLS chicken-and-egg)
  - Invite second parent flow (invite link with family_id)
  - Family member CRUD in Settings (add/edit/remove, color picker, avatar picker, role)
  - `<PinGate>` component (4-digit numeric keypad, shake animation on wrong PIN)
  - Google OAuth configured in both Google Cloud Console and Supabase dashboard (OAuth app published — no longer in Testing mode)
  - Sign-out button in Settings → Account section (`supabase.auth.signOut()` + redirect to `/login`)

- **Phase 3: Layout Shell & Navigation**
  - Left sidebar (desktop) / bottom tabs (mobile) with CC branding
  - Route stubs for all 5 sections (calendar, chores, meals, lists, settings)
  - Touch-optimized global CSS (manipulation, no text select, tap highlight)
  - Settings page wrapped in `<PinGate>`

- **Phase 4: Calendar** (Google + weather; CalDAV deferred)
  - Day, Week, and Month views (`components/calendar/{day,week,month}-view.tsx`)
  - Week view is a 5-day time grid with hour rail, scrollable 6-hour viewport, red current-time indicator (auto-scrolls on load), tap-to-open event detail popover, and a clickable member-legend filter (selection persisted to `localStorage`)
  - Google Calendar OAuth: `/api/calendar/google/connect`, `/api/calendar/google/callback`, connection management at `/api/calendar/connections/[id]`
  - Sync engine: `/api/cron/sync-calendars` triggered every ~5 min by GitHub Actions (`*/5 * * * *`); pulls Google events into `calendar_events`. See "Calendar Sync Architecture" below for the full chain and debugging order.
  - Color-coded events per family member (members own a color, events join via `member_id`)
  - Weather: OpenWeatherMap via `lib/weather.ts` rendered in `<WeatherBar>`; location set in Settings
  - **Deferred:** Hey Calendar (CalDAV) — `CalendarProvider` type already includes `"caldav"`; sync route notes "CalDAV handled separately in a follow-up"

- **Phase 5: Chores**
  - Templates with per-kid assignment (many-to-many via `chore_template_members`) and recurrence (daily / weekly-on-days)
  - Tap-to-complete with star-burst animation + `startViewTransition` for the green-state cross-fade; ~850ms delay before the row flips so the celebration plays through
  - Optimistic local `pendingComplete` flag with rollback on write failure; long-press to undo a completion
  - Star rewards: redemption view per kid, computed balance via `lib/chores.ts`, settings section to manage rewards
  - Per-member `chores_enabled` toggle hides kids from the board without deleting them
  - Migration `003_chores_restructure.sql` applied to Supabase (chore_assignments dropped, chore_template_members + new chore_completions live)
  - Spec: `docs/superpowers/specs/2026-04-26-chores-design.md`; plan: `docs/superpowers/plans/2026-04-26-chores.md`

- **Phase 6: Meal Planning** (v1 spec complete)
  - Weekly grid (7 days × 4 slots) with today highlight
  - Meal CRUD modal with emoji picker
  - Slot toggles in Settings (enable/disable breakfast/lunch/dinner/snack)
  - Full Supabase integration with RLS on `meal_plans` table
  - Recipe linking and Claude-powered ingredient suggestions intentionally deferred (out of scope for v1; depends on Phase 9)

- **Phase 7: Lists** (v1 spec complete)
  - Default lists seeded on family creation (in `/api/onboarding`) + idempotent backfill server action `seedDefaultsIfEmpty()` for the pre-Phase-7 family
  - Item CRUD: add (optimistic), check/uncheck (optimistic), tap-to-edit text inline, long-press (500ms, mouse + touch) to delete with confirmation
  - Per-list "Clear completed (n)" with confirmation
  - Settings management section (PIN-gated): create / rename / change emoji + color / delete lists, all via `<ListEditModal>`
  - Spec: `docs/superpowers/specs/2026-04-30-lists-design.md`; plan: `docs/superpowers/plans/2026-04-30-lists.md`
  - Drag-to-reorder, realtime sync (Lists+Meals+Chores in one PR), and voice integration intentionally deferred

- **Auxiliary: On-Screen Keyboard** (kiosk-mode QWERTY)
  - Global `<TouchKeyboardProvider>` mounted in `app/layout.tsx`; built on `react-simple-keyboard`, themed via overrides in `app/globals.css`
  - Activated via `?kiosk=1` URL flag (persisted to `localStorage.chuppacal_kiosk`) or PIN-gated toggle in `/settings`
  - Auto-shows on focus of text/number/search/email/tel/url `<input>` and `<textarea>`; opt out per-input via `data-no-keyboard`
  - Press Enter on the keyboard dispatches a real `keydown` so existing save-on-Enter handlers fire; Done blurs the input; backdrop tap dismisses
  - Phones using the same URL keep their OS keyboard (kiosk flag is per-device)
  - `.npmrc` enables `legacy-peer-deps=true` because `react-simple-keyboard` declares peerDeps on React ≤18 (works fine with React 19)
  - Spec: `docs/superpowers/specs/2026-04-30-on-screen-keyboard-design.md`; plan: `docs/superpowers/plans/2026-04-30-on-screen-keyboard.md`

- **Auxiliary: Family Member Photos**
  - Members can have a real photo as their avatar; emoji is now a fallback
  - `<MemberAvatar>` (`components/family/member-avatar.tsx`) centralizes the photo-or-emoji choice and is used in settings, the kid column, the chore-template assignment chips, and the calendar event popover
  - `<PhotoCropModal>` uses `react-easy-crop` for a round 1:1 cropper; output is JPEG capped at 512px / quality 0.85
  - Uploads land in the public `family-photos` bucket at `${family.id}/${uuid}.jpg`; paths are unguessable so privacy is acceptable for the kiosk use case
  - Migration `004_family_photos_public.sql` applied (flips the bucket to `public = true`)

- **Phase 8 (partial): Pi Kiosk Auto-Launch** — kiosk auto-launch done; screensaver + sleep still deferred
  - Pi 4 runs Raspberry Pi OS **Desktop (Debian 13 Trixie)** on **Wayland/`labwc`** — auto-logs into the desktop, then labwc runs the kiosk launcher
  - Launcher at `~/.config/labwc/autostart` opens Chromium full-screen (`--kiosk`) to `https://chuppa-cal.vercel.app/calendar?kiosk=1`, wrapped in a `while` loop so it relaunches on crash/close
  - Screen blanking disabled via `raspi-config` → Display Options → Screen Blanking (display stays on; sleep-on-schedule still deferred)
  - Chromium profile persists the Supabase/Google session, so reboots go straight to the calendar (no re-login)
  - Binary is `chromium` (`/usr/bin/chromium`), **not** `chromium-browser`. Maintenance escape hatch: **Ctrl+Alt+F2** → console login → edit/disable the autostart file
  - Full runbook (setup-from-reflash, recovery, optional hardening): `docs/pi-kiosk-runbook.md`

### 🟡 Active / Next up

- **On-device UI shake-out** — kiosk now auto-launches full-screen on the Pi 4 + Acer touchscreen (✅ verified; see `docs/pi-kiosk-runbook.md`). Still worth exercising the live UI on-device: time-grid week view renders synced events with Dada's color-coding, current-time line tracks correctly, member-legend filter persists across reloads, weather bar populates, touch keyboard appears on inputs, sign-out works.

### 🔲 Remaining

- **Phase 4 follow-up:** Hey Calendar (CalDAV) connection + sync — only matters if a family member uses Hey Calendar
- **Phase 8 remainder:** Sleep Mode (dim on schedule per `families.settings.sleep_start/end`) + Photo Screensaver (cycle after `screensaver_timeout_minutes`). Pi kiosk auto-launch is ✅ done — see `docs/pi-kiosk-runbook.md`.
- **Phase 9:** Voice Assistant (Alexa Custom Skill + Claude AI)

## Production

- **Live URL:** https://chuppa-cal.vercel.app (Vercel Hobby plan, auto-deploys on push to `main`)
- **Repo:** https://github.com/samoeba/ChuppaCal (public; gives the calendar-sync workflow unlimited Actions minutes)
- **Active calendar connection:** `scasey@gbgmarketing.com` primary calendar, attached to Family A's Dada member (~250 events upserted on each sync). Note: the Supabase login (`samcaseydesign@gmail.com`) and the Calendar OAuth grant (`scasey@gbgmarketing.com`) are independent — see the "Supabase login ≠ Calendar OAuth account" gotcha below.
- **Vercel cron jobs (`vercel.json`):** only `generate-chores` daily at 00:00 UTC. Calendar sync was moved off Vercel because Hobby caps cron at 1×/day.
- **GitHub Actions workflows:** `sync-calendars.yml` runs `*/5 * * * *`; requires repo secrets `CALENDAR_SYNC_URL` and `CRON_SECRET` (mirrored from Vercel env).
- **Vercel env vars (Production):** `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `OPENWEATHER_API_KEY`, `CRON_SECRET`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`.
- **Google OAuth client:** Published (Audience tab in Google Cloud Console — no longer Testing). Authorized redirect URIs include both prod and localhost callbacks for Supabase auth and Calendar API. App is unverified — first-time consent shows the yellow "unsafe" warning, click through Advanced.

## Calendar Sync Architecture

Every ~5 min, calendar events get pulled from connected Google calendars into Supabase. Four-link chain — when something breaks, identify which link first:

```
GitHub Actions ──▶ Vercel cron route ─────────▶ Supabase ──────────▶ Google Calendar API
   schedule         /api/cron/sync-calendars   calendar_connections   OAuth refresh + /events
   + URL call          /route.ts                                       fetch
```

- **Trigger:** `.github/workflows/sync-calendars.yml` (`*/5 * * * *`) on a public-repo runner. Just runs `curl` with `Authorization: Bearer ${CRON_SECRET}`. Sends nothing else.
- **Worker:** `app/api/cron/sync-calendars/route.ts` does the actual work — reads connections, refreshes Google OAuth, upserts events.
- **Why GitHub Actions, not Vercel cron:** Vercel Hobby crons run **1×/day max** regardless of cron string. GitHub Actions = free, every 5 min, public repo = unlimited minutes. Trade-off: GitHub's scheduler is best-effort, can slip 5–15 min under load.
- **Required secrets:** `CALENDAR_SYNC_URL` and `CRON_SECRET` in GitHub Repository Secrets (Settings → Secrets and variables → Actions); `CRON_SECRET` mirrored in Vercel Production env.

### Debugging order

1. **GitHub Actions logs** (https://github.com/samoeba/ChuppaCal/actions/workflows/sync-calendars.yml) — did the workflow fire? curl exit clean?
2. **HTTP status in run output** — 401 = secret mismatch between GitHub and Vercel; 5xx = code error in the route; 200 = look at the body.
3. **JSON body's `results` array** — `events_upserted: <n>` per connection means success. An `error` key means the route reached Google and Google said no.
4. **Vercel function logs** — for any 5xx, stack trace lives here.
5. **Supabase `calendar_connections`** — confirm the right rows exist for the right family/member.

### Known gotchas

- **HTTP 200 with `error` in body.** The cron route always returns 200; per-connection failures live in `results[i].error`. Don't trust the workflow's green checkmark alone — read the JSON.
- **Google OAuth Testing mode → 7-day refresh token expiry.** If the OAuth app's publishing status is **Testing**, refresh tokens die every 7 days. Fix: in Google Cloud Console → Audience → **Publish App** (unverified production is fine for personal apps; first-time consent shows a yellow warning, click through Advanced).
- **Onboarding-loop on wrong-account login.** Any Google account that signs in but isn't already a `family_members` row gets routed through `/onboarding` and creates a *new* family. Symptom: fresh empty "Casey Family" rows appear in the DB. Fix: sign in as an account already linked to the target family, or use the invite-link flow.
- **Supabase login ≠ Calendar OAuth account.** They're independent OAuth grants. The current setup uses Supabase login = `samcaseydesign@gmail.com` (personal, the family owner) but Calendar connection = `scasey@gbgmarketing.com` (work calendar). Each Calendar OAuth popup uses whatever Google session is currently active in the browser, which may not match the chuppa-cal login — watch the account picker.

## Supabase Setup Notes
- Project ref: `skkxvyebvcjvhcbdzqhc`
- All migrations applied through `004_family_photos_public.sql` (verified live: `chore_template_members` and `family_members.chores_enabled` exist; `chore_assignments` is gone; `family-photos` bucket is public)
- Google OAuth enabled and working (Sign in / Providers → Google)
- RLS note: onboarding uses service-role client (`/api/onboarding`) to bypass the chicken-and-egg problem where `get_family_id()` returns NULL for new users

## Commands
- `npm run dev` — start dev server
- `npm run build` — production build
