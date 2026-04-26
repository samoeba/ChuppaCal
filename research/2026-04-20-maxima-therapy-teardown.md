# Site Teardown: Maxima Therapy

**URL:** https://maximatherapy.com/
**Built by:** Not credited in meta; hashed-asset manifest (`/assets/*-[hash].js|css`) and route pattern match a **Remix / React Router v7** app (Vite build).
**Platform:** Remix (server-rendered) + Vite + Tailwind v4 + GSAP
**Date analyzed:** 2026-04-20

## Tech Stack (Confirmed from Source)

| Technology | Evidence | Purpose |
|---|---|---|
| Remix / React Router v7 | `/assets/entry.client-*.js`, `/assets/root-*.js`, `/assets/layout-*.js`, route-keyed chunks (`home-*.js`, `NotFound-*.js`, `Program-*.js`) — the standard Remix Vite manifest | SSR + client-side routing shell |
| React | `jsx`/`jsxs` runtime calls in every bundle (`p.jsx(...)`) | UI |
| Tailwind CSS **v4** | Root CSS declares `--spacing:.25rem`, `--text-sm--line-height`, `--tw-*` tokens and uses `@theme`-style tokens; utility class set (`grid-cols-12`, `col-span-*`, `bg-beige`, `bg-salmon`, etc.) | Design tokens + utilities |
| GSAP | `ScrollTrigger-*.js`, `SplitText-*.js`, `Draggable-*.js`, `ease-*.js`, `SplitScale-*.js` chunks imported | All animation |
| Matter.js | `/assets/matter-BbZ0w5JX.js` chunk | Physics for bouncy/draggable elements |
| Lottie | `LottiePatternAnimation-*.js` chunk, imported by the home/program routes | Decorative pattern animations |
| Tweakpane | `tweakpane-*.js` chunk (likely dev-only GUI, left in prod bundle) | Dev tuning |
| Cookieconsent (Orest Bida's lib) | `cookieconsent.esm-*.js` | Cookie banner |
| Custom SVG cursors | `/assets/svg/cursor-default.svg`, `cursor-grab`, `cursor-grabbing`, `cursor-pointer` (each with a 70%-scale mobile variant) | Branded pointer |

Custom effect chunks worth knowing: `BounceButton`, `SplitScale`, `LineImage`, `MaskImage.client`, `useCloudComponent`, `useFooterParallax`, `usePointer`, `LogoColorContext`.

## Design System

### Colors (from `--color-*` custom properties in `root-*.css`)

| Name | Value | Common use |
|---|---|---|
| `--color-blue` | `#2668FD` | Primary brand; body text on light bg; `/contact` and `/careers` pages |
| `--color-blue-dim` | `#2668FDb3` | 70% blue |
| `--color-blue-sky` | `#CFF2F1` | Soft bg tint |
| `--color-blue-moss` | `#EEF9F8` | Even softer bg |
| `--color-blue-pale` | `#B9ECEA` | 65+ program secondary |
| `--color-red` | `#FD4401` | Orange-red accent, curtain fan |
| `--color-red-dark` | `#AE0C36` | Deep red tertiary |
| `--color-salmon` | `#FFCCCD` | Soft pink surface |
| `--color-salmon-pale` | `#FFA8E5` | |
| `--color-yellow` | `#FDCB40` | Sunny, primary for 0-to-3 program |
| `--color-yellow-pale` | `#FFF2B7` | Curtain secondary |
| `--color-green` | `#00B351` | Primary for 3-to-18 program; `/faq` |
| `--color-green-pale` | `#A7EB98` | |
| `--color-green-dark` | `#005C00` | |
| `--color-pink` | `#F780D4` | Primary for 18-to-65 program |
| `--color-pink-pale` | `#F5CBFF` | |
| `--color-turquoise` | `#2CD1D0` | Primary for 65+ program |
| `--color-mauve` | `#503FD0` | |
| `--color-purple` | `#6B3088` | |
| `--color-orange` | `#F80` | |
| `--color-beige` | `#F3EFE0` | Core page background |
| `--color-light-gray` | `#F1F1F1` | |

**Per-program palette sets** (from `colors-*.js`, confirmed — each route has a themed `{main, secondary, tertiary, curtainBg, curtainFan1, curtainFan2}`):

| Route | main | secondary | tertiary | curtainBg |
|---|---|---|---|---|
| `/contact` | `#2668FD` | `#FFF2B7` | `#AE0C36` | `#FDCB40` |
| `/areas` | `#FD4401` | `#FFF2B7` | `#AE0C36` | `#FDCB40` |
| `/careers` | `#2668FD` | `#FFF2B7` | `#AE0C36` | `#FDCB40` |
| `/faq` | `#A7EB98` | `#FFF2B7` | `#AE0C36` | `#00B351` |
| `0-to-3` (Early Intervention) | `#FDCB40` | `#FFF2B7` | `#AE0C36` | `#2668FD` |
| `3-to-18` (Children & Youth) | `#00B351` | `#A7EB98` | `#163F10` | `#2668FD` |
| `18-to-65` (Adults) | `#F780D4` | `#F5CBFF` | `#5D2B75` | `#2668FD` |
| `65-and-plus` | `#2CD1D0` | `#B9ECEA` | `#4A2CD6` | `#2668FD` |

### Typography

| Role | Font | Weight | Size (desktop → mobile) | Other |
|---|---|---|---|---|
| `title-1` (hero display) | **Robuck Rounded** | 400 | `14.0625rem` → `4.3125rem` | `text-transform:uppercase`, `line-height:80%`, `margin-bottom:-.1em`, `letter-spacing:0` |
| `title-2` | **Robuck Rounded** | 400 | `6.25rem` → `2.75rem` | same uppercase/80%/-0.1em |
| `title-3` | **Robuck Rounded** | 400 | `4.0625rem` → unchanged on small | same |
| `nav-item` | **Robuck Rounded** | 400 | `4.0625rem` → `2.5rem` | same |
| `curtain-title` (page transition overlay) | **Robuck Rounded** | 400 | `14.0625rem` → `4.0625rem` | `color: var(--color-red)` |
| `body` / `.text-body` | **ABC Diatype Rounded Plus** | 500 | `1.25rem` → `1.0625rem` | `letter-spacing:-.02em`, `line-height:120%` |
| `.text-small` | ABC Diatype Rounded Plus | 500 | `1rem` → `.875rem` | |
| `.text-body-small` | ABC Diatype Rounded Plus | 500 | `1.1rem` | |
| `curtain-desc` | ABC Diatype Rounded Plus | 700 | `1.375rem` → `1.25rem` | `color: var(--color-blue)` |
| `text-big` (oversize display) | ABC Diatype Rounded | 900 | `37.75rem` → `9.375rem` | `color: var(--color-blue)` |
| Mono details | ABC Diatype Rounded Mono | 500 | | |

**Font files (from `@font-face` in `root-*.css`):**
- `/assets/fonts/RobuckRounded.woff2` — weight 400
- `/assets/fonts/Robuck Regular.woff2` — weight 400
- `/assets/fonts/ABCDiatypeRoundedVariable-Trial.woff2` — variable 300–900
- `/assets/fonts/ABCDiatypeRoundedPlusVariable-Trial.woff2` — variable 300–900
- `/assets/fonts/ABCDiatypeRoundedMono-Medium-Trial.woff2` — weight 500

> **Trial fonts.** The ABC Diatype Rounded files are the `-Trial` variants (Dinamo's licensing). Production licensing is required.

### Border Radius (`corners-*` tokens)

| Token | Value |
|---|---|
| `.corners-extra-small` | `0.3125rem` (5px) |
| `.corners-small` | `0.625rem` (10px) |
| `.corners-medium` | `0.9375rem` (15px) |
| `.corners-big` | `2.1875rem` (35px) |
| `.btn`, `.btn-round` | `3.125rem` (50px — pill) |

### Spacing

Tailwind v4 base: `--spacing: .25rem`. All `p-5`, `gap-5`, `py-30` etc. multiply that. In addition, most section paddings are **hardcoded in `rem`** (e.g. `lg:pt-[17.1875rem]`, `lg:pb-[71.3125rem]`, `lg:pr-[19rem]`) — this site uses very large, deliberately art-directed spacing at desktop.

### Responsive Approach

- Breakpoints: `1024px` (`lg`), `1280px` (`xl`). Media queries are on **max-width: 1280px** for the mobile/touch branch (custom cursors flip to 70%-scale variants below this).
- `isMobile = window.innerWidth <= 1024` in JS (`BounceButton` hook).
- No container queries observed.

### Signature Motion Tokens

- `--ease-expo-out: cubic-bezier(.16, 1, .3, 1)` — outgoing transitions.
- `elastic.out(1.2, 0.8)` — GSAP ease for text reveal (SplitScale).
- `elastic.out(2, 0.6)` — GSAP ease for button hover scale.
- `expo.out` — GSAP ease for leave-back (scroll up).

## Effects Breakdown

| Effect | Implementation | Complexity | Cloneable? |
|---|---|---|---|
| Scroll-reveal headings (words pop up + stretch) | GSAP SplitText → per-word `scaleY 0→1` + `y 200%→0`, `elastic.out(1.2, 0.8)`, stagger 0.1. Triggered by ScrollTrigger `top bottom`. | Med | **Yes** |
| Bouncy hover on buttons/cards | `gsap.to(el, {scale: 1.1, ease:"elastic.out(2, 0.6)", duration: 1})` on mouseenter; same to scale 1 on mouseleave. Touch-aware (uses touchstart/end on touch devices). | Low | **Yes** |
| Curtain page transition | Full-bleed overlay with huge red `curtain-title` (Robuck Rounded 14rem) over a colored background per route. Two "fan" colors swept across. Driven by React context `CurtainProvider` + `isCurtainAnim90Complete` flag gating other reveals. | High | Partially |
| Cloud-drift backgrounds | CSS-only: `.cloud-accross-animation{animation:20s linear infinite cloud-accross-keyframes}` with 4 speeds (20/25/35/45s) × forward/reverse. Translates clouds across the viewport infinitely. | Low | **Yes** |
| Custom branded cursor | `body { cursor: url(/assets/svg/cursor-default.svg) 3 3, auto }` + hover/grab/grabbing variants swapped via CSS. 70%-scale variants under 1280px. | Low | **Yes** |
| Footer parallax on scroll | `useFooterParallax` hook — scroll-linked transform of footer children. | Med | Yes |
| Lottie pattern decor | `LottiePatternAnimation` component wraps looping Lottie JSONs as ambient background shapes. | Low | Yes |
| Draggable carousels (`carousel-program1`) | GSAP Draggable with velocity → snap; `.cursor-grab` → `.cursor-grabbing` state. | Med | Yes |
| Matter.js physics element | Imported `matter-*.js` chunk — likely a bounce-around/settling pile somewhere in the page (not observed in home chunk; probably on `/areas` or `/careers`). | High | Partially |
| Section color theming | `LogoColorContext` + per-route palette from `colors-*.js` shifts the logo, CTA, and curtain palette as you navigate. | Med | Yes |

## Implementation Details

### SplitScale — the signature text reveal
The pattern you see under every heading on the site: each word starts squashed and below, then springs up and stretches to full height on scroll.

```js
// confirmed from SplitScale-*.js
const split = SplitText.create(el, { type: "lines, words", aria: "none" });

gsap.set(split.words, { transformOrigin: "bottom center", scaleY: 0 });

ScrollTrigger.create({
  trigger: containerEl,
  start: "top bottom",
  onEnter: () => {
    split.lines.forEach((line, lineIdx) => {
      const divs = line.querySelectorAll("div");
      gsap.to(divs, {
        scaleY: 1,
        ease: "elastic.out(1.2, 0.8)",
        duration: 1,
        stagger: 0.1,
        delay: lineIdx * 0.1,
      });
      gsap.fromTo(divs,
        { y: "200%" },
        { y: 0, ease: "elastic.out(1.2, 0.8)", duration: 1, stagger: 0.1, delay: lineIdx * 0.1 }
      );
    });
  },
  onLeaveBack: () => {
    // scaleY back to 0 with expo.out when scrolling back above
  },
});
```
**Reveal:** the "stretch + bounce" feel is almost entirely `transformOrigin: bottom center` + `scaleY` on an `elastic.out` ease. No masks, no clip-paths. The text even appears to rubber-band — that's the elastic ease overshoot.

### BounceButton — everything hoverable bounces
Every button, card CTA, and many icons are wrapped in `<BounceButton>`, which adds two event listeners and animates a single transform.

```js
// confirmed from BounceButton-CtaazYoI.js
gsap.set(el, { transformOrigin: "center center" });

el.addEventListener("mouseenter", () =>
  gsap.to(el, { scale: 1.1, duration: 1, ease: "elastic.out(2, 0.6)" })
);
el.addEventListener("mouseleave", () =>
  gsap.to(el, { scale: 1, ease: "elastic.out(2, 0.6)" })
);

// On touch devices, swap mouseenter/leave for touchstart/touchend.
```
**Reveal:** 1.1x scale feels *much* more alive than 1.05x because of the `elastic.out(2, 0.6)` — strength 2, period 0.6. Copy those numbers.

### Cloud drift (pure CSS)
```css
@keyframes cloud-accross-keyframes { /* horizontal translate loop */ }

.cloud-accross-animation       { animation: 20s linear infinite cloud-accross-keyframes; }
.cloud-accross-animation-25    { animation: 25s linear infinite cloud-accross-keyframes; }
.cloud-accross-animation-35    { animation: 35s linear infinite cloud-accross-keyframes; }
.cloud-accross-animation-45    { animation: 45s linear infinite cloud-accross-keyframes; }
/* plus `-reverse` variants */
```
**Reveal:** ambient drifting pattern is a handful of absolutely-positioned clouds at 4 different speeds, no JS, some running backwards. Mix speed + direction = parallax feel for free.

### Curtain page transition
A provider-based, centrally orchestrated route change:

- `CurtainProvider` holds `{pathToReach, isCurtainAnimComplete, isCurtainAnim90Complete}`.
- Link clicks set `pathToReach`; overlay pulls in from the edge (`curtainBg` color from `colors-*.js` for the target route), showing oversized red `curtain-title` (Robuck Rounded 14rem) + blue `curtain-desc`.
- At "90% complete" the new route mounts; SplitScale reveals are *gated* on `isCurtainAnim90Complete` so nothing plays until the curtain clears.
- Fan shapes (`curtainFan1`, `curtainFan2`) are two additional colored blobs swept across during the transition.

### Custom cursors (map)

| State | Desktop SVG (hotspot) | ≤1280px SVG (hotspot) |
|---|---|---|
| default | `cursor-default.svg` (3, 3) | `cursor-default-70.svg` (2.1, 2.1) |
| pointer (hover on a/button) | `cursor-pointer.svg` (18, 0) | `cursor-pointer-70.svg` (12.6, 0) |
| grab | `cursor-grab.svg` (22, 25) | `cursor-grab-70.svg` (15.4, 17.5) |
| grabbing | `cursor-grabbing.svg` (21, 22) | `cursor-grabbing-70.svg` (14.7, 15.4) |

## Assets Needed to Recreate

1. **Robuck Rounded** (display) — commercial font, purchase from the foundry.
2. **ABC Diatype Rounded / Plus / Mono** (body) — Dinamo, commercial.
3. **4 custom cursor SVGs** (+ 70% variants) — small doodle pointer, hand grab/grabbing, pointer finger.
4. **Cloud SVGs** — 3–5 simple soft-curve cloud silhouettes in palette colors.
5. **Lottie pattern JSONs** — simple looping vector patterns (stars, shapes) used as decorative layers.
6. **Program illustrations** — each age bracket has bespoke character illustrations (Midjourney prompt: *"friendly flat vector illustration, soft pastel palette matching #2668FD / #FD4401 / #FDCB40 / #F780D4, rounded shapes, no outlines, editorial children's book style"*).
7. **Share image** `/share.png` — flat illustration + wordmark.

## Build Plan

### Recommended Stack
- **Framework:** Remix / React Router v7 (what they use). Next.js App Router is an equally valid clone target — routing maps 1:1.
- **Styling:** **Tailwind v4** with a `@theme` block declaring the full `--color-*`, `--corners-*`, `--text-*` token set. Custom props are the source of truth; tokens don't live in `tailwind.config` anymore in v4.
- **Animation:** **GSAP** + SplitText + ScrollTrigger + Draggable (all their paid plugins — `@gsap/business` bundle).
- **Physics:** Matter.js only where you need it (one or two set-pieces).
- **Patterns:** `lottie-web` (or `@lottiefiles/react-lottie-player`).
- **Cookie banner:** `vanilla-cookieconsent` by Orest Bida.

### NPM Packages
```bash
npm install gsap                            # incl. SplitText/ScrollTrigger/Draggable (paid GSAP)
npm install matter-js
npm install lottie-web
npm install vanilla-cookieconsent
# Tailwind v4:
npm install tailwindcss@next @tailwindcss/vite
```

### Section-by-Section Build Order (home / program route)

1. **Root shell**
   - `<CurtainProvider>` + `<LogoColorContext>` at the top of the tree.
   - Global CSS: `@theme` token block, `@font-face` declarations, cursor rules on `body`/`a:hover`/`button:hover`.
2. **Navigation**
   - Robuck Rounded nav items (`nav-item`, 4.0625rem). Wrap each in `<BounceButton>`.
3. **Hero**
   - `title-1` headline in Robuck Rounded, wrapped in `<SplitScale>`.
   - Body paragraph in ABC Diatype Rounded Plus, also `<SplitScale type="lines">`.
   - Background: 4 drifting clouds at 20/25/35/45s speeds, alternating forward/reverse.
4. **CTA row**
   - Pill buttons (`btn-round`, 3.125rem radius) in the route's `main` color. `<BounceButton>` wrapper.
5. **Program / feature grid**
   - 12-col grid (`grid-cols-12`), cards with `corners-big` (35px) in pastel surfaces.
   - Each card = `<BounceButton>` + SplitScale heading.
6. **Draggable carousel**
   - `.carousel-program1` horizontal GSAP Draggable; `.cursor-grab` → `.cursor-grabbing`.
7. **Lottie pattern block**
   - Full-bleed section with a looping Lottie as decorative background.
8. **Footer**
   - Uses `useFooterParallax` — children translate on scroll.
   - Massive `text-big` (37.75rem Diatype Rounded 900) wordmark in blue; clips below the fold.
9. **Route change**
   - On link click: set `pathToReach`, animate curtain overlay (curtainBg + 2 fan colors from `colors-*.js` for the destination route). At 90% complete, mount new route and flip `isCurtainAnim90Complete` so SplitScale components run.

## Notes

- **Licensing:** Robuck Rounded + ABC Diatype (even the Trial files on this site) are commercial. Budget for fonts before shipping.
- **Accessibility:** SplitText uses `aria: "none"` so screen readers still see the underlying heading text — keep that behavior when cloning.
- **Don't ship Tweakpane in prod.** They left it in the bundle; omit it when cloning.
- **Mobile cursor swap is cosmetic** — the 70% variants exist but `coarse pointer` devices won't show CSS cursors. Still nice for touchscreen laptops.
- **The "WOW" is 90% `elastic.out`.** Two eases (`elastic.out(1.2, 0.8)` for text, `elastic.out(2, 0.6)` for hover) + one transform (`scaleY` from bottom-center) carry the entire feel. Start there.
- **Color theming per route is a context swap**, not a CSS variable swap at `:root`. The palette JSON lives in `colors-*.js` and is injected into React context; child components consume it. For a calendar app you could do the same keyed by family member instead of route.
