# Family Calendar — Design Spec

**Date:** 2026-04-15
**Status:** Draft

A DIY replacement for the Skylight Max Calendar. Touch-screen family hub wall-mounted in the kitchen, built for ~$300 using a Raspberry Pi and off-the-shelf monitor.

---

## 1. Users & Context

**Family composition:** 2 adults, 3 kids (ages 6, 4, 1).

- Adults manage calendars, chores, meals, lists, and settings.
- The 6-year-old and 4-year-old interact with chore charts (tap to complete).
- The 1-year-old is tracked on the calendar but doesn't interact directly.

**Environment:** Wall-mounted 21.5" touchscreen in the kitchen. Always on during the day, sleep mode at night.

**Tech comfort:** Parents can follow setup guides and do basic configuration but prefer low ongoing maintenance.

---

## 2. Hardware

| Part | Model | Est. Cost |
|------|-------|-----------|
| Touchscreen monitor | Acer UT222Q — 21.5" FHD (1920×1080) IPS, 10-point touch, 75Hz, 7H hardness | ~$230 |
| Compute | Raspberry Pi 4 (4GB RAM) | ~$55 |
| Storage | 32GB microSD card (Class 10 / A2) | ~$8 |
| Power | USB-C power supply (5V/3A) for Pi | ~$10 |
| **Total** | | **~$303** |

**Physical setup:**
- Monitor wall-mounted in kitchen (VESA mount or French cleat bracket).
- Pi mounted behind the monitor (velcro or VESA Pi bracket).
- HDMI cable: Pi → monitor video.
- USB cable: Monitor → Pi for touch input.
- Single power strip behind the monitor for both devices.

---

## 3. Architecture

### Overview

```
┌─────────────┐     ┌──────────────┐     ┌──────────────────┐
│  Pi Kitchen  │────▶│  Vercel      │────▶│  Supabase        │
│  (Chromium   │     │  (Next.js    │     │  (PostgreSQL,    │
│   kiosk)     │     │   App)       │     │   Auth, Realtime,│
│              │     │              │     │   Storage)       │
└─────────────┘     └──────┬───────┘     └──────────────────┘
                           │
┌─────────────┐            │          ┌──────────────────┐
│  Phone      │────────────┘          │  External APIs   │
│  (Browser)  │                       │  - Google Cal    │
└─────────────┘                       │  - CalDAV (Hey)  │
                                      │  - OpenWeather   │
                                      └──────────────────┘
```

### Stack

| Layer | Technology | Tier |
|-------|-----------|------|
| Frontend framework | Next.js 14+ (App Router, React 18+) | — |
| Hosting | Vercel | Free (Hobby) |
| Database + Auth | Supabase | Free (500MB DB, 1GB storage, 50K MAU) |
| Realtime sync | Supabase Realtime (Postgres changes) | Free tier |
| Photo storage | Supabase Storage | Free (1GB) |
| Calendar sync | Vercel Cron Jobs (every 5 min) | Free tier |
| Weather | OpenWeatherMap API | Free (1,000 calls/day) |
| CSS | Tailwind CSS | — |

### Pi Configuration

The Pi's only job is to be a browser kiosk:

1. Raspberry Pi OS Lite (headless, no desktop environment).
2. Boot into Chromium in kiosk mode pointed at the Vercel deployment URL.
3. Auto-hide cursor after 3 seconds of inactivity.
4. Disable screen blanking (handled by the app's sleep mode).
5. Unclutter package to hide the mouse cursor.

This means zero server-side maintenance on the Pi. If the Pi dies, swap in a new one and point it at the same URL.

### Mobile Access

The same Next.js app is responsive. Parents open the Vercel URL on their phone browser. Supabase Realtime keeps the wall display and phone in sync — changes on the phone appear on the wall within seconds.

---

## 4. Authentication

- **Parents:** Google OAuth via Supabase Auth. First parent to sign up creates the family; second parent joins via invite link.
- **Wall display:** Stays permanently logged in via a long-lived session token. No per-visit login.
- **Parental lock:** 4-digit PIN stored hashed in the `settings` table. Required to access Settings, edit calendar events, modify chore templates, or delete anything. Kids can only tap chore completions and view screens.
- **Kids:** No login. They interact at the wall display which is already authenticated.

---

## 5. Screens & Navigation

### Navigation: Left Sidebar

Fixed icon sidebar on the left edge (~80px wide). Five sections:

| Icon | Label | Screen |
|------|-------|--------|
| 📅 | Calendar | Default/home screen |
| ✅ | Chores | Chore charts |
| 🍽️ | Meals | Meal planning |
| 📝 | Lists | All lists |
| ⚙️ | Settings | Family config (PIN-protected) |

Active section highlighted with accent color border. Icons are 48×48px minimum for easy touch targeting.

### 5.1 Calendar

**Views:** Day, Week (default), Month — toggled via pills at top right.

**Week view (default):**
- 7 day columns, today highlighted with accent background.
- Events rendered as colored rounded cards within their day column.
- Each event shows: time + title. Color = family member color.
- Weather bar below the header: icon + temperature + condition for the day.

**Day view:**
- Single-day schedule, hourly rows.
- More detail per event (time, title, location, which calendar).

**Month view:**
- Traditional grid. Dots/pills per day showing event density by color.
- Tap a day to drill into day view.

**Data source:** Read-only sync from Google Calendar API and Hey Calendar (CalDAV). Events pulled every 5 minutes via Vercel Cron Job and written to Supabase. Each event tagged with the family member's color based on which calendar it came from.

**Color coding:** Each family member assigned a color during setup. Events from their linked calendar(s) render in that color. A legend row at the bottom shows all members + colors.

### 5.2 Chores

**Layout:** Side-by-side columns, one per kid. Each column contains:

- **Header:** Avatar (emoji/photo) + kid name + star count + progress badge ("2 of 4 done").
- **Chore rows:** 44px circular tap target with emoji icon on the left, chore name in the middle, star value on the right.
- **Completed chores:** Green background, checkmark replaces the emoji circle, text gets strikethrough.
- **Interaction:** Kid taps the circle → satisfying animation (confetti burst / star fly-up) → chore marked complete → star count increments.

**Views:** Today (default), Week (shows completion history as a grid).

**Chore templates:** Parents define chores in Settings with: name, emoji icon, star value (1-3), and recurrence (daily, specific weekdays, one-time). Templates are assigned to specific kids.

**Star rewards:** Parents define rewards in Settings (e.g., "10 stars = ice cream trip", "25 stars = new toy"). Kids can see the rewards and their progress toward them on a rewards sub-screen within Chores.

**Parental controls:** Only parents (after PIN) can create/edit/delete chore templates, adjust star counts, or mark chores as incomplete.

### 5.3 Meal Planning

**Layout:** Weekly grid. Rows = meal slots, columns = days of the week.

- **Meal slots:** Breakfast, Lunch, Dinner, Snacks. Each slot can be toggled on/off in Settings (e.g., hide breakfast if you don't plan it).
- **Cells:** Show meal name + optional emoji. Tap to add/edit. Empty cells show a dashed "+ Add" button.
- **Today's column** highlighted with accent border.
- **Navigation:** "← Prev" and "Next →" buttons to scroll weeks.

**Interaction:** Tap a cell → modal/drawer opens with text input for meal name. Future enhancement: recipe linking, but out of scope for v1.

### 5.4 Lists

**Layout:** Side-by-side columns, one per list. Same visual pattern as chore chart.

**Default lists:** Grocery, To-Do, Shopping. Parents can create additional custom lists.

**Each list column:**
- Header: emoji icon + list name + item count.
- Items: checkbox + text. Tap checkbox to mark done (green + strikethrough).
- "+ Add item" button at the bottom → opens on-screen keyboard input.
- Completed items sink to the bottom of the list.

**Interaction:** Tap and hold an item to delete (with confirmation). Parents can reorder items via drag handle (touch drag).

### 5.5 Settings (PIN-Protected)

Entering Settings requires the 4-digit parental PIN.

**Sections:**
- **Family Members:** Add/edit/remove members. Set name, color, avatar (emoji or uploaded photo), role (parent/child).
- **Calendar Connections:** Link/unlink Google Calendar and Hey Calendar accounts. OAuth flow for Google, CalDAV credentials for Hey. Assign calendars to family members.
- **Chore Templates:** Create, edit, delete chore definitions. Set recurrence and star values. Assign to kids.
- **Star Rewards:** Define reward tiers (star cost + reward name).
- **Meal Slots:** Toggle breakfast, lunch, dinner, snacks on/off.
- **Lists:** Manage list names, icons, colors. Delete lists.
- **Display:** Sleep mode schedule (start/end times). Photo screensaver idle timeout. Weather location (city or zip code).
- **Parental PIN:** Change the 4-digit PIN.
- **Photos:** Upload/delete family photos for the screensaver.

### 5.6 Photo Screensaver

- Activates after a configurable idle timeout (default: 5 minutes of no touch).
- Cycles through uploaded family photos with a slow crossfade transition.
- Tap anywhere to dismiss and return to the last active screen.
- Displays a small clock overlay in the corner.

### 5.7 Sleep Mode

- Screen dims to minimum brightness (or goes black) on a schedule set in Settings.
- Default: 10:00 PM – 6:00 AM.
- Tap to wake during sleep mode.
- Implemented via CSS overlay + brightness control. The Pi's HDMI signal stays active (monitor handles actual backlight).

---

## 6. Data Model

### Tables

```
families
├── id (uuid, PK)
├── name (text)
├── created_at (timestamptz)
└── settings (jsonb) — sleep times, weather location, meal slot toggles, screensaver timeout, pin_hash

family_members
├── id (uuid, PK)
├── family_id (uuid, FK → families)
├── name (text)
├── color (text) — hex color
├── avatar_emoji (text) — default avatar
├── avatar_url (text, nullable) — uploaded photo
├── role (text) — 'parent' or 'child'
└── created_at (timestamptz)

calendar_connections
├── id (uuid, PK)
├── family_id (uuid, FK → families)
├── member_id (uuid, FK → family_members)
├── provider (text) — 'google' or 'caldav'
├── credentials (jsonb, encrypted) — OAuth tokens or CalDAV creds
├── calendar_external_id (text)
├── calendar_name (text)
└── last_synced_at (timestamptz)

calendar_events
├── id (uuid, PK)
├── family_id (uuid, FK → families)
├── connection_id (uuid, FK → calendar_connections)
├── member_id (uuid, FK → family_members)
├── external_id (text) — ID from Google/Hey for dedup
├── title (text)
├── start_time (timestamptz)
├── end_time (timestamptz)
├── location (text, nullable)
├── all_day (boolean)
└── synced_at (timestamptz)

chore_templates
├── id (uuid, PK)
├── family_id (uuid, FK → families)
├── name (text)
├── emoji (text)
├── star_value (int) — 1-3
├── recurrence (jsonb) — { type: 'daily' | 'weekdays' | 'custom', days: [0-6] }
└── created_at (timestamptz)

chore_assignments
├── id (uuid, PK)
├── template_id (uuid, FK → chore_templates)
├── member_id (uuid, FK → family_members)
├── date (date)
└── created_at (timestamptz)

chore_completions
├── id (uuid, PK)
├── assignment_id (uuid, FK → chore_assignments)
├── completed_at (timestamptz)
├── stars_earned (int)
└── verified_by (uuid, nullable, FK → family_members) — parent who verified, if applicable

star_rewards
├── id (uuid, PK)
├── family_id (uuid, FK → families)
├── name (text)
├── star_cost (int)
├── emoji (text, nullable)
└── created_at (timestamptz)

star_redemptions
├── id (uuid, PK)
├── reward_id (uuid, FK → star_rewards)
├── member_id (uuid, FK → family_members)
├── redeemed_at (timestamptz)
└── stars_spent (int)

meal_plans
├── id (uuid, PK)
├── family_id (uuid, FK → families)
├── date (date)
├── slot (text) — 'breakfast', 'lunch', 'dinner', 'snack'
├── name (text)
├── emoji (text, nullable)
└── created_at (timestamptz)

lists
├── id (uuid, PK)
├── family_id (uuid, FK → families)
├── name (text)
├── emoji (text)
├── color (text) — hex
├── sort_order (int)
└── created_at (timestamptz)

list_items
├── id (uuid, PK)
├── list_id (uuid, FK → lists)
├── text (text)
├── checked (boolean)
├── sort_order (int)
└── created_at (timestamptz)

photos
├── id (uuid, PK)
├── family_id (uuid, FK → families)
├── storage_path (text) — Supabase Storage path
├── uploaded_by (uuid, FK → family_members)
└── uploaded_at (timestamptz)
```

### Row-Level Security

All tables use Supabase RLS policies scoped to `family_id`. A user can only read/write data belonging to their family. The `family_id` is derived from the authenticated user's JWT via a lookup in `family_members`.

---

## 7. Calendar Sync

### Google Calendar

1. Parent connects via Google OAuth in Settings.
2. OAuth tokens stored in `calendar_connections.credentials`.
3. Vercel Cron Job runs every 5 minutes:
   - For each Google connection, call Google Calendar API `events.list` with `updatedMin` set to last sync time.
   - Upsert events into `calendar_events` (dedup by `external_id`).
   - Handle token refresh when access tokens expire.

### Hey Calendar (CalDAV)

1. Parent enters Hey CalDAV URL and app-specific password in Settings.
2. Credentials stored in `calendar_connections.credentials`.
3. Same Vercel Cron Job:
   - For each CalDAV connection, issue a `REPORT` request with a time range.
   - Parse the iCalendar response and upsert into `calendar_events`.

### Sync Direction

**Read-only** for v1. Events are pulled from external calendars and displayed. Creating events on the wall display is not supported — parents use their phone calendar apps for that.

---

## 8. External APIs

| API | Purpose | Free Tier Limits |
|-----|---------|------------------|
| Google Calendar API | Sync events | 1M requests/day |
| CalDAV (Hey) | Sync events | No API limit (self-managed) |
| OpenWeatherMap | Weather for header + event locations | 1,000 calls/day |
| Supabase Auth | Google OAuth for parent login | 50K MAU |

---

## 9. Voice Assistant Integration (Alexa + Claude AI)

### Overview

Add items to lists, update meal plans, and query ChuppaCal hands-free via an existing Alexa device in the kitchen. An AI layer (Claude) handles natural language understanding so the Alexa Skill itself is a simple pass-through.

### Architecture

```
Voice → Alexa → Lambda → Claude API (tool use) → Supabase → Realtime → Wall Display
                                                                ↑
Alexa speaks ← Lambda ← Claude response ─────────────────────────┘
```

- **Alexa** captures voice and transcribes to text (wake word, microphone, speech-to-text).
- **AWS Lambda** receives the raw utterance string from Alexa, forwards it to Claude.
- **Claude API** (Haiku or Sonnet) interprets the request using tool use, executes the right action against Supabase, and returns a spoken confirmation.
- **Supabase Realtime** pushes the change to the wall display and any open mobile browsers.

### Alexa Skill Design

**Invocation name:** "chuppa cal"

**Single catch-all intent** using `AMAZON.SearchQuery` slot type — captures the entire utterance as freeform text. No custom intents, no slot training, no NLU configuration. All understanding is delegated to Claude.

**Example interactions:**
- *"Alexa, ask Chuppa Cal to add milk and eggs to grocery"* → adds 2 items to grocery list
- *"Alexa, ask Chuppa Cal we're doing tacos on Friday"* → sets Friday dinner to tacos, optionally adds common taco ingredients to grocery list
- *"Alexa, ask Chuppa Cal what's on the shopping list"* → reads back items
- *"Alexa, ask Chuppa Cal did the kids do their chores today"* → reads today's chore completion status
- *"Alexa, ask Chuppa Cal add diapers"* → AI infers grocery list (no list name needed)

**Skill deployment:** Dev mode only (personal account). No Alexa Skill Store review needed since this is a family-only tool.

### Claude Tool Definitions

The Lambda function calls Claude with a system prompt describing the family's data and the following tools:

| Tool | Description |
|------|-------------|
| `add_list_items` | Add one or more items to a named list |
| `get_list_items` | Read items from a named list (for read-back) |
| `check_list_item` | Mark a list item as done |
| `set_meal` | Set a meal for a specific day and slot |
| `get_meal_plan` | Read the meal plan for a date range |
| `get_chore_status` | Get today's chore completion status for one or all kids |

Claude decides which tool(s) to call based on the natural language input. It can call multiple tools in a single turn (e.g., "tacos on Friday" → `set_meal` + `add_list_items` for ingredients).

### Smart Behaviors

- **Auto list routing:** If no list name is specified, Claude infers the best list based on the item (food → grocery, household item → shopping, task → to-do).
- **Batch parsing:** "Add milk, eggs, bread, and butter" → 4 separate items in one request.
- **Meal-to-grocery:** When a meal is added, Claude can optionally suggest or auto-add common ingredients. This uses the model's general knowledge (it knows tacos need tortillas, cheese, etc.) — no recipe database required.
- **Context-aware responses:** Claude's reply is concise and designed to be spoken aloud ("Added 3 items to grocery. Set tacos for Friday dinner.").

### Lambda Function

A single Node.js Lambda function (~100 lines):
1. Receive the Alexa skill request (JSON with the raw utterance).
2. Fetch the family's list names from Supabase (so Claude knows what lists exist).
3. Call Claude API with the utterance, system prompt, and tool definitions.
4. Execute any tool calls against Supabase REST API.
5. Return Claude's text response to Alexa for speech output.

### Cost

| Service | Usage | Cost |
|---------|-------|------|
| Alexa Skill (dev mode) | Unlimited | Free |
| AWS Lambda | ~600 invocations/month (20/day) | Free tier (1M/month) |
| Claude Haiku API | ~300 tokens/invocation × 600/month | ~$0.03/month |
| Claude Sonnet API (if preferred) | ~300 tokens/invocation × 600/month | ~$0.50/month |

**Total incremental cost: effectively $0/month.**

### Requirements

- Amazon Developer account (free)
- AWS account (free tier)
- Anthropic API key ($5 free credit on signup)

---

## 10. Out of Scope (v1)

These are intentionally excluded to keep scope manageable:

- **Recipe storage** — Meals are names only. No recipe database. (Claude's general knowledge handles ingredient suggestions via voice.)
- **Two-way calendar sync** — Read-only. No creating/editing events from the display.
- **Multi-device linking** — Single display. No syncing between multiple wall calendars.
- **Push notifications** — No alerts to phones.
- **Camera / microphone** — Not present on wall display hardware. (Alexa provides the microphone.)
- **Messaging between family members** — Use existing apps (iMessage, etc.).
- **Google Home integration** — Alexa is the supported voice assistant. Google Home could be added later via a similar webhook approach.

---

## 11. Verification Plan

### Hardware Verification
1. Pi boots into Chromium kiosk mode and loads the deployed URL.
2. Touch input works: tap, scroll, long-press all function correctly.
3. Display stays on during the day, sleep mode dims on schedule.

### Feature Verification
1. **Calendar:** Connect a Google Calendar. Events appear within 5 minutes. Color matches assigned family member. Day/week/month views render correctly.
2. **Chores:** Create a chore template. Assign to a kid. Chore appears on the wall display. Kid taps to complete → animation plays, star increments. Parent views weekly history.
3. **Meals:** Add meals to the weekly grid. Toggle off breakfast in settings → row disappears. Navigate between weeks.
4. **Lists:** Create a grocery list. Add items. Check off items. Create a custom list.
5. **Photos:** Upload 5 photos. Wait for idle timeout. Screensaver activates and cycles photos. Tap to dismiss.
6. **Mobile:** Open the URL on a phone. Make a change (add a list item). Confirm it appears on the wall display within seconds.
7. **Auth:** Verify parental PIN blocks Settings access. Verify kids can tap chores but not edit templates.

### Voice Verification
1. **Add single item:** "Alexa, ask Chuppa Cal to add milk to grocery" → item appears on wall display grocery list within 3 seconds.
2. **Add multiple items:** "Add milk, eggs, and bread to grocery" → 3 separate items created.
3. **Auto-route item:** "Add diapers" (no list specified) → AI routes to the correct list.
4. **Set meal:** "We're having tacos on Friday" → Friday dinner updates on wall display.
5. **Query list:** "What's on the shopping list" → Alexa reads back items.
6. **Query chores:** "Did the kids do their chores" → Alexa reads completion status.
7. **Latency:** Full round-trip (voice → response) completes in under 4 seconds.
