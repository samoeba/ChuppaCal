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

## Current Status — PHASE 7 IN PROGRESS (Phase 4 also paused mid-stream)

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
  - Google OAuth configured in both Google Cloud Console and Supabase dashboard

- **Phase 3: Layout Shell & Navigation**
  - Left sidebar (desktop) / bottom tabs (mobile) with CC branding
  - Route stubs for all 5 sections (calendar, chores, meals, lists, settings)
  - Touch-optimized global CSS (manipulation, no text select, tap highlight)
  - Settings page wrapped in `<PinGate>`

- **Phase 6: Meal Planning** (v1 spec complete)
  - Weekly grid (7 days × 4 slots) with today highlight
  - Meal CRUD modal with emoji picker
  - Slot toggles in Settings (enable/disable breakfast/lunch/dinner/snack)
  - Full Supabase integration with RLS on `meal_plans` table
  - Recipe linking and Claude-powered ingredient suggestions intentionally deferred (out of scope for v1; depends on Phase 9)

### 🚧 In Progress: Phase 7 — Lists
- Columns (named lists), items, drag-to-reorder
- Will later integrate with Phase 9 voice ("add milk to grocery")

### 🔲 Paused: Phase 4 — Calendar
1. Google Calendar connection in Settings (OAuth scopes for Calendar API)
2. Hey Calendar (CalDAV) connection in Settings
3. Sync engine (Vercel Cron: `/api/cron/sync-calendars`)
4. Week view (default), Day view, Month view
5. Color-coded events per family member
6. Weather integration (OpenWeatherMap)

### 🔲 Remaining Phases
- Phase 5: Chores (templates, assignments, tap-to-complete, star rewards) — migration `003_chores_restructure.sql` written but not yet applied to Supabase
- Phase 8: Screensaver, Sleep Mode & Pi kiosk setup
- Phase 9: Voice Assistant (Alexa Custom Skill + Claude AI)

## Supabase Setup Notes
- Project ref: `skkxvyebvcjvhcbdzqhc`
- Migration run successfully (all 13 tables + RLS + storage bucket)
- Google OAuth enabled and working (Sign in / Providers → Google)
- RLS note: onboarding uses service-role client (`/api/onboarding`) to bypass the chicken-and-egg problem where `get_family_id()` returns NULL for new users

## Commands
- `npm run dev` — start dev server
- `npm run build` — production build
