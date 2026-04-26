# ChuppaCal — Style Guide (v1 draft)

> This is the source of truth for ChuppaCal's look & feel. Iterate here first; roll changes into `app/globals.css` + component styles after each revision lands.

## Design Intent

A **warm, playful, tactile** family hub — inspired by [maximatherapy.com](https://maximatherapy.com/) (see `research/2026-04-20-maxima-therapy-teardown.md`) but adapted for a 21.5" wall-mounted touchscreen in a kitchen, viewed from 1–6 feet away by 2 adults and 3 kids (ages 1, 4, 6).

**Four pillars:**
1. **Legible across the room.** Today's date, the next event, and the current weather must be readable at a glance from 6 feet.
2. **Tactile on touch.** Every tap earns a bounce. Elastic eases everywhere — it rewards the 4-year-old and doesn't annoy the adult.
3. **A character per person.** Each family member owns a color. Their events, chores, and stars wear that color without us ever having to ask.
4. **Warm, never clinical.** Beige surfaces, soft corners, hand-drawn feel. This is not a productivity app; it's a kitchen object.

**What we take from Maxima:** Robuck Rounded display, rounded corners, elastic button bounce, per-person color theming (their per-program system), drifting-cloud ambient decor.
**What we leave behind:** 14rem scroll-triggered titles (no scroll here), curtain page transitions (kiosk is single-app), the entire Tweakpane/Matter/Lottie complexity stack unless earned by a feature.

---

## 1 — Color Tokens

### Brand neutrals (always-on surfaces)

| Token | Value | Use |
|---|---|---|
| `--cc-beige` | `#F3EFE0` | App background. Warm, soft, not-white. |
| `--cc-cream` | `#FAF6E8` | Raised card surface on beige. |
| `--cc-ink` | `#1C1A14` | Primary text on light surfaces (not pure black — softer). |
| `--cc-ink-dim` | `#1C1A14B3` | Secondary text (70%). |
| `--cc-line` | `#1C1A1414` | Hairline dividers. |
| `--cc-white` | `#FFFFFF` | Text on colored surfaces; event pill interiors. |

### Accent palette (borrowed from Maxima, tuned warmer)

These are the palette we'll assign to family members, event categories, and status. Each has a **primary**, **soft** (for tinted backgrounds), and **deep** (for text-on-soft / outlines).

| Family name | Primary | Soft surface | Deep (text) |
|---|---|---|---|
| Sun | `#FDCB40` | `#FFF2B7` | `#8A5E00` |
| Sky | `#2668FD` | `#CFE0FF` | `#0B2E7A` |
| Clover | `#00B351` | `#A7EB98` | `#005C00` |
| Coral | `#FD4401` | `#FFCCCD` | `#AE0C36` |
| Petal | `#F780D4` | `#F5CBFF` | `#5D2B75` |
| Lagoon | `#2CD1D0` | `#B9ECEA` | `#0E5E5D` |
| Plum | `#6B3088` | `#E7D5F0` | `#3D1B4F` |

*(Names are working labels — feel free to rename when we assign people.)*

### Family member assignment (to confirm)

Five people, so five of the seven above. Suggested starting assignments:

| Person | Color | Why |
|---|---|---|
| Parent 1 | Sky `#2668FD` | Steady, dependable |
| Parent 2 | Coral `#FD4401` | Warm counterpoint to Sky |
| Kid (6) | Sun `#FDCB40` | Bright, eldest-energy |
| Kid (4) | Clover `#00B351` | Growing things |
| Kid (1) | Petal `#F780D4` | Littlest |

*Lagoon and Plum stay reserved for shared events, the whole family, or future use (babysitter? grandparents?).*

### Status tokens (independent of family)

| Token | Value | Use |
|---|---|---|
| `--cc-success` | `#00B351` (Clover) | Chore complete, star earned |
| `--cc-warning` | `#FDCB40` (Sun) | Due today |
| `--cc-urgent` | `#AE0C36` (Coral-deep) | Overdue, conflict |
| `--cc-info` | `#2668FD` (Sky) | Weather / informational |

---

## 2 — Typography

### Fonts

| Role | Family | Loading |
|---|---|---|
| Display (hero numbers, oversize titles) | **Robuck Rounded** | Local — user has it installed. We'll self-host the `.woff2` in `public/fonts/` + declare `@font-face`. |
| Body + small headlines | **National Park** | [Google Fonts](https://fonts.google.com/specimen/National+Park). Load via `next/font/google`. |
| Monospace (times, counts, debug) | `ui-monospace, Menlo, monospace` | System. |

### Scale (at 1920×1080, ~3ft viewing distance)

Assume `:root { font-size: 16px }`. Values in `rem`.

| Token | Size | Line-height | Font | Weight | Tracking | Use |
|---|---|---|---|---|---|---|
| `text-display-xl` | `9rem` (144px) | `0.85` | Robuck Rounded | 400 | `0` | **Today's date** on home view; screensaver clock |
| `text-display-lg` | `5rem` (80px) | `0.9` | Robuck Rounded | 400 | `0` | Section headers ("This Week", "Chores") |
| `text-display-md` | `3rem` (48px) | `0.95` | Robuck Rounded | 400 | `0` | Card titles, day labels in month grid |
| `text-heading-lg` | `2rem` (32px) | `1.1` | National Park | 600 | `-0.01em` | Event names, meal names |
| `text-heading-md` | `1.5rem` (24px) | `1.15` | National Park | 600 | `-0.01em` | List item titles |
| `text-body-lg` | `1.25rem` (20px) | `1.3` | National Park | 500 | `-0.01em` | Primary body (descriptions, notes) |
| `text-body` | `1rem` (16px) | `1.35` | National Park | 500 | `-0.01em` | Secondary body |
| `text-caption` | `0.875rem` (14px) | `1.3` | National Park | 500 | `0` | Timestamps, meta |
| `text-label` | `0.75rem` (12px) | `1.2` | National Park | 700 | `0.08em` (uppercase) | Tiny all-caps labels, badges |

### Display styling rules (Robuck Rounded)

All Robuck Rounded text follows Maxima's convention — it's designed to be **set tight**:

```css
.text-display-xl, .text-display-lg, .text-display-md {
  font-family: 'Robuck Rounded', sans-serif;
  font-weight: 400;
  text-transform: uppercase;
  line-height: 0.85;       /* 80-95% per size above */
  letter-spacing: 0;
  margin-bottom: -0.1em;   /* negative to kill descender gap when stacked */
}
```

> **Open question:** is uppercase right for "Saturday, April 18" — or do we want mixed case and let Robuck's rounded letterforms do the work? v1 ships uppercase; revisit after seeing it on-screen.

---

## 3 — Radius, Spacing, Shadow

### Radius (from Maxima's `corners-*` system)

| Token | Value | Use |
|---|---|---|
| `--cc-r-xs` | `0.3125rem` (5px) | Chips, inline pills |
| `--cc-r-sm` | `0.625rem` (10px) | Small buttons, inputs |
| `--cc-r-md` | `1rem` (16px) | List items, small cards |
| `--cc-r-lg` | `2.1875rem` (35px) | Primary cards, day-of-week tiles |
| `--cc-r-pill` | `3.125rem` (50px) | CTA buttons, member avatars |

### Spacing

Tailwind v4 default `--spacing: 0.25rem` (4px). Stick with it; use `p-3` / `p-5` / `p-8` / `p-12` / `p-20` for typical card padding. Large section breathing room goes higher — up to `p-32` for hero panels.

### Shadow

No drop shadows. Depth is expressed via surface color (beige → cream elevation) and outline. Shadow feels too web, not enough kitchen object.

> **If** we want to add depth later, try a soft sun-direction shadow: `0 8px 0 -2px rgba(28,26,20,0.08)` (downward only, no blur) — reads as a sticker, not a UI panel.

---

## 4 — Motion Tokens

### Eases (GSAP)

| Token | Value | Use |
|---|---|---|
| `ease-bounce-hover` | `elastic.out(2, 0.6)` | Tap / hover scale. From Maxima's BounceButton — unchanged. |
| `ease-pop-in` | `elastic.out(1.2, 0.8)` | New item appears (chore added, event saved). Softer than hover. |
| `ease-exit` | `expo.out` | Anything leaving. |
| `ease-settle` | `cubic-bezier(0.16, 1, 0.3, 1)` | Non-bouncy transitions — view switches, curtain slides. |

### Signature interactions

- **Tap bounce.** Every tappable element scales from 1 → 1.1 over 1s with `ease-bounce-hover`, back to 1 on release. Wrap at the component level (`<BouncyTap>` component).
- **Chore complete.** The card scales briefly 1 → 1.05, then a gold star spins in from behind with `ease-pop-in`, then settles. Haptic if we can get it on the Pi (likely no; screen-only).
- **View swap.** When tapping a sidebar nav item, current view fades+slides 12px down and out (200ms, `ease-settle`); incoming view fades+slides from 12px above in (250ms, `ease-settle`). No curtain overlay — too heavy for a kiosk.
- **Cloud drift (ambient mode / screensaver).** Exactly like Maxima: 4 CSS-only keyframes, 20s/25s/35s/45s, half forward + half reverse, clouds absolutely positioned behind the live-time display.
- **Idle → screensaver.** After 90s of no touch, the UI fades to a minimal clock + date + current weather over a drifting-cloud background. Tap wakes it with a ripple that scales out from the touch point.

### Timing defaults

- Tap: 1000ms (elastic is slow on purpose — feels alive)
- View swap: 200–250ms
- Pop-in for new content: 800ms
- Screensaver fade: 1500ms

---

## 5 — Component Patterns (descriptions, not code yet)

### Event pill
- Rounded `--cc-r-pill`, filled with member's **soft** color, text in member's **deep** color.
- Left edge has a 4px solid bar in member's **primary** color for extra recognition at distance.
- Wraps to two lines if event title is long; times stay on a single line.

### Day tile (calendar week view)
- `--cc-r-lg` (35px), cream surface on beige background.
- Date number in Robuck Rounded `text-display-md` (48px) top-left.
- Events stack inside as pills.
- **Today** gets a stroke in `--cc-ink` 3px, no fill change — subtle, not garish.

### Chore card
- `--cc-r-lg`, soft color of the assigned child.
- Large emoji + task name in `text-heading-lg`.
- Tap to complete: card morphs, gold star spins in, stays shown for 5s.
- Reward counter (top-right corner) in Robuck Rounded `text-display-md`.

### CTA button
- `--cc-r-pill` (50px radius → fully rounded).
- Min height 64px (touch target), padding `px-8 py-4`.
- Text in National Park 600 `text-heading-md`.
- Primary: filled in context color, white text. Secondary: ink outline + transparent fill.

### Member avatar
- Circle, 48px diameter (small) or 80px (home hero).
- Filled with member's primary color, initial in Robuck Rounded white.

### List item (for Lists feature)
- `--cc-r-md`, cream surface.
- Checkbox is a 32px circle with a 3px ink stroke; when checked, fills with member's primary color + a drawn checkmark in white.

### Toast / confirmation
- Slides up from bottom, 48px from edge.
- `--cc-r-lg`, filled with `--cc-ink`, text white.
- Lives 2.5s then exits with `ease-exit`.

---

## 6 — Ambient Decoration

Not every surface needs to be busy — but a few curated ambient elements give it personality:

- **Clouds** in screensaver + empty states (the "no events today" illustration).
- **Stars** (simple 5-point SVG) in reward UI and as sparkle decorations on streaks.
- **Hand-drawn wavy divider** between the main content and the sidebar — pure SVG, ink color.

**Keep off the main views.** The home screen is mostly data; ornament goes in the gaps.

---

## 7 — Implementation Mapping

### What rolls into `app/globals.css`

```css
@import "tailwindcss";

@font-face {
  font-family: 'Robuck Rounded';
  src: url('/fonts/RobuckRounded.woff2') format('woff2');
  font-weight: 400;
  font-display: swap;
}

@theme inline {
  /* Neutrals */
  --color-cc-beige: #F3EFE0;
  --color-cc-cream: #FAF6E8;
  --color-cc-ink: #1C1A14;
  --color-cc-ink-dim: #1C1A14B3;
  --color-cc-line: #1C1A1414;

  /* Family palette (base) */
  --color-sun: #FDCB40;
  --color-sun-soft: #FFF2B7;
  --color-sun-deep: #8A5E00;
  --color-sky: #2668FD;
  --color-sky-soft: #CFE0FF;
  --color-sky-deep: #0B2E7A;
  --color-clover: #00B351;
  --color-clover-soft: #A7EB98;
  --color-clover-deep: #005C00;
  --color-coral: #FD4401;
  --color-coral-soft: #FFCCCD;
  --color-coral-deep: #AE0C36;
  --color-petal: #F780D4;
  --color-petal-soft: #F5CBFF;
  --color-petal-deep: #5D2B75;
  --color-lagoon: #2CD1D0;
  --color-lagoon-soft: #B9ECEA;
  --color-lagoon-deep: #0E5E5D;
  --color-plum: #6B3088;

  /* Radius */
  --radius-cc-xs: 0.3125rem;
  --radius-cc-sm: 0.625rem;
  --radius-cc-md: 1rem;
  --radius-cc-lg: 2.1875rem;
  --radius-cc-pill: 3.125rem;

  /* Fonts */
  --font-display: 'Robuck Rounded', sans-serif;
  --font-body: 'National Park', ui-sans-serif, system-ui, sans-serif;

  /* Motion */
  --ease-settle: cubic-bezier(0.16, 1, 0.3, 1);
}

body {
  background: var(--color-cc-beige);
  color: var(--color-cc-ink);
  font-family: var(--font-body);
  font-weight: 500;
  letter-spacing: -0.01em;
}
```

### Per-family-member theming (React context, like Maxima's `LogoColorContext`)

```ts
// Example: a <MemberThemeProvider memberId="kid-6"> wraps subtrees.
// It sets CSS vars on the wrapper:
//   --member-primary, --member-soft, --member-deep
// Child components use `bg-[color:var(--member-soft)]` etc.
```

### Component library plan

- `<BouncyTap>` — wraps any tappable node; GSAP scale animation on touch.
- `<EventPill>` — consumes member theme.
- `<DayTile>`, `<ChoreCard>`, `<MemberAvatar>`, `<CtaButton>`.
- `<Screensaver>` — idle-timer-activated clock + clouds.

Ship none of these until we've iterated on this guide.

---

## 8 — Known Open Questions

1. **Uppercase for all Robuck Rounded?** Or mixed case for dates like "Saturday, April 18"? (Currently: uppercase.)
2. **Is seven accent colors too many** for five family members + status? Consider collapsing Lagoon/Plum into status-only.
3. **Does the beige background feel right on a backlit screen in a kitchen?** Might need a slightly cooler beige (`#EFEBD9`?) when we see it on the actual Acer UT222Q at night.
4. **Night mode.** Kids go to bed at 7; do we want a dimmed/darker variant after sunset? (Phase 8 "Sleep Mode" is the hook.)
5. **Robuck Rounded licensing.** User has it installed locally — confirm we have a license to self-host the `.woff2` in production.

---

**Next step:** review this draft, flag the pieces that feel wrong, and I'll revise before rolling any of it into `app/globals.css` or components.
