# On-Screen Keyboard — Design

**Status:** Approved 2026-04-30
**Parent project:** ChuppaCal family calendar
**Phase:** Auxiliary (between Phase 7 Lists and Phase 8 Pi kiosk setup)

## 1. Goal

Add a touchscreen-friendly on-screen keyboard so the wall-mounted Acer + Raspberry Pi 4 kiosk can support text entry without a hardware keyboard. Existing inputs across Onboarding, Settings, Meals, and Lists must work unchanged. Phones using the same Vercel URL must continue to use their native OS keyboard with no double-keyboard.

## 2. Scope

### In scope (this PR)
- `react-simple-keyboard` integration as a global, focus-aware overlay.
- Single QWERTY layout with number row, basic punctuation (`'`, `-`, `,`, `.`), shift, backspace, space, enter, and a "Done" key.
- Auto-show on focus of any text/number/search `<input>` or `<textarea>` when kiosk mode is active.
- Dismissal via backdrop tap, Done key, or Enter key.
- Kiosk-mode flag persisted in `localStorage`, set via `?kiosk=1` query param OR a PIN-gated toggle in `/settings`.
- Auto scroll-into-view for the focused input so it isn't hidden by the keyboard.
- Theming with the project's design tokens (`cc-cream`, `cc-ink`, accent `cc-coral`, Robuck Rounded for key labels).
- Theming via the library's CSS class hooks plus a small global stylesheet.

### Deferred (future PRs)
- Symbol panel (`?123` toggle for `@`, `:`, `/`, …) — no current input needs it.
- Dedicated numeric-only layout — number row in the QWERTY layout is sufficient for the only `type="number"` input (star cost).
- Caps-lock toggle (only single-shot shift in v1).
- Drag-to-reposition or split keyboard.
- Multiple-language layouts.
- Autocomplete / word suggestions.

## 3. Architecture

A single `<TouchKeyboardProvider>` mounts in the root layout (`app/layout.tsx`). All routes — `(main)/*`, `onboarding`, `login`, `auth/*` — share this layout, so one mount covers everything. Existing input components are not modified.

### Files

| Path | Action | Responsibility |
|------|--------|----------------|
| `components/keyboard/touch-keyboard-provider.tsx` | Create | Mounts keyboard, runs focus tracking, dispatches synthetic events to focused input |
| `components/keyboard/touch-keyboard.tsx` | Create | Thin wrapper around `react-simple-keyboard` with theming and key bindings |
| `components/keyboard/use-kiosk-mode.ts` | Create | Hook: reads `?kiosk=1` and `localStorage`, returns boolean |
| `lib/keyboard/set-input-value.ts` | Create | Native React value-setter helper to make controlled-input handlers fire on programmatic value writes |
| `app/layout.tsx` | Modify | Wrap children in `<TouchKeyboardProvider>` |
| `components/settings/kiosk-mode-section.tsx` | Create | PIN-gated toggle for kiosk mode in `/settings` |
| `app/(main)/settings/page.tsx` | Modify | Mount `<KioskModeSection>` |
| `app/globals.css` | Modify | Theme overrides for `react-simple-keyboard` |
| `package.json` | Modify | Add `react-simple-keyboard` dependency |

### Dependency

`react-simple-keyboard` (~30 KB gzipped, MIT-licensed). Pinned to a specific version in `package.json`.

## 4. Kiosk-Mode Detection

`use-kiosk-mode.ts` returns `true` when:

1. URL has `?kiosk=1` — also writes `localStorage.chuppacal_kiosk = "1"` so the flag persists across reloads (Pi reboots, route changes, etc.).
2. OR `localStorage.chuppacal_kiosk === "1"` is already set.

The flag can be cleared by:
- Visiting any URL with `?kiosk=0` — clears the localStorage entry.
- Toggling off the "Kiosk Mode" switch in `/settings` (PIN-gated).

The hook subscribes to a `storage` event so cross-tab toggles propagate (mostly for completeness — kiosk has one tab open).

The hook returns `false` during SSR (no `window`); the provider uses this to render `null` until hydration to avoid SSR/CSR mismatch.

## 5. Provider and Focus Tracking

`<TouchKeyboardProvider>` (Client Component) wraps `{children}` and renders `<TouchKeyboard>` as a sibling when conditions are met.

```tsx
const kiosk = useKioskMode();
const [focused, setFocused] = useState<HTMLInputElement | HTMLTextAreaElement | null>(null);

useEffect(() => {
  if (!kiosk) return;
  const onFocusIn = (e: FocusEvent) => { /* test target, setFocused */ };
  const onFocusOut = (e: FocusEvent) => { /* debounced clear */ };
  document.addEventListener("focusin", onFocusIn);
  document.addEventListener("focusout", onFocusOut);
  return () => { /* cleanup */ };
}, [kiosk]);
```

### Target predicate

An element is a keyboard target if all of these are true:
- It is `<input type="text" | "number" | "search" | "email" | "tel" | "url">` or `<textarea>`.
- It is not marked with `data-no-keyboard`.
- It is not `disabled` or `readOnly`.

(The PIN-gate's keypad uses `<button>` elements, so it's never a target.)

### `focusout` debounce

A short (~50 ms) debounce so that:
- Focus moving from one registered input to another keeps the keyboard up (target swaps).
- Focus moving to a non-registered element hides the keyboard.
- Tapping a key on the keyboard does not blur the input. (`react-simple-keyboard`'s own buttons live inside our component tree but we explicitly call `e.preventDefault()` on the keyboard container's `mousedown`/`touchstart` to keep focus on the input.)

## 6. Event Bridging

When a key is pressed in `react-simple-keyboard`, the wrapper:

1. Reads `focused.value` and `focused.selectionStart`/`selectionEnd`.
2. Computes the new value depending on the key:
   - Printable char (e.g., `a`, `'`, `7`): insert at caret, replacing any selection.
   - `{bksp}` / Backspace: delete char before caret, or delete selection.
   - `{space}`: insert space.
   - `{shift}`: toggle a one-shot `shifted` mode in component state. Next printable key is uppercased; `shifted` flips back to off after that key (iOS-style).
   - `{enter}`: dispatch a `KeyboardEvent('keydown', { key: 'Enter', bubbles: true })` to the focused input, *then* dispatch `keyup`. Existing `onKeyDown` handlers fire (e.g., meal modal save-on-Enter, list-edit modal save-on-Enter). After dispatch, blur the input.
   - `{done}`: blur the focused input. The `focusout` debounce hides the keyboard.
3. For all value-changing keys, use `lib/keyboard/set-input-value.ts`:
   ```typescript
   const proto = focused instanceof HTMLTextAreaElement
     ? HTMLTextAreaElement.prototype
     : HTMLInputElement.prototype;
   const setter = Object.getOwnPropertyDescriptor(proto, "value")!.set!;
   setter.call(focused, newValue);
   focused.dispatchEvent(new Event("input", { bubbles: true }));
   ```
   This makes React's controlled-input `onChange` handlers fire. Without this, React ignores direct `.value =` assignments because it tracks "last known" values internally.
4. Restore the caret using `focused.setSelectionRange(newCaret, newCaret)`.

## 7. Layout, Theming, Dismissal

### Layout

```
1 2 3 4 5 6 7 8 9 0
Q W E R T Y U I O P
A S D F G H J K L
⇧ Z X C V B N M ' -
[Done]   [SPACE]   ⏎
```

Implemented as `react-simple-keyboard` layout strings. Default layout is `default`; `shift` toggles to a parallel `shifted` layout that uppercases the alpha rows.

### Container styling

- Position: `fixed bottom-0 left-0 right-0`.
- Height: `40vh` (with a min-height of `260px` for very-tall viewports — the wall display is 1080p portrait orientation).
- Background: `cc-cream` with subtle top border.
- z-index: keyboard panel `60`, backdrop `55`. Modals at `50` sit beneath the backdrop.
- Backdrop: `fixed inset-0 bottom-[40vh] bg-black/20 z-55` — taps land on the backdrop and dismiss the keyboard rather than interacting with elements behind it.

### Key styling

- Background: `bg-white` with subtle shadow.
- Active state: `bg-cc-coral text-white` for ⏎ and Done; `bg-slate-100` for shift in shifted state.
- Font: `Robuck Rounded`.
- Tap target size: minimum 48×48 px (touch-optimized).

### Dismissal triggers

- Tap on backdrop → `focused.blur()` → debounce → keyboard hides.
- Tap "Done" key → same.
- Tap ⏎ key → dispatches Enter, then blurs. Existing Enter handlers may close their own modals; the keyboard hides afterward regardless.
- Focus moves to a non-input element → keyboard hides.

### Scroll-into-view

When the keyboard becomes visible (state transitions from null → focused element), call:
```typescript
focused.scrollIntoView({ block: "center", behavior: "smooth" });
```
This handles inputs near the bottom of the viewport that would otherwise be obscured.

## 8. Settings Toggle

`<KioskModeSection>` mounts inside `/settings` (PIN-gated like the rest of the page). Single switch labeled "Kiosk Mode (on-screen keyboard)" bound to the localStorage flag. Toggling it writes/clears `localStorage.chuppacal_kiosk` and triggers the kiosk-mode hook to re-evaluate.

## 9. Edge Cases

- **Modal interaction (z-stacking):** modals render at z-50. The keyboard panel is z-60 and its dismiss-backdrop is z-55 (above modals, below keyboard). While the keyboard is open, taps anywhere outside the keyboard panel land on the backdrop, which dismisses the keyboard rather than interacting with the modal — once dismissed, the modal is fully interactive again. The focused input is kept centered above the keyboard via `scrollIntoView`. Tall modals with internal scroll continue to scroll within their existing scroll container.
- **Autofocus on mount:** when a modal opens with `autoFocus` on its first input, the `focusin` listener picks it up immediately and the keyboard appears on the same frame.
- **`type="number"` input** (star cost): treated identically to `type="text"`. The number row covers the only digit-entry case. The browser may still validate `value` against `type="number"` constraints, which is fine.
- **Inputs that should opt out:** mark with `data-no-keyboard`. None today, but the affordance exists for future fields (e.g., a calendar URL input that's auto-populated).
- **Non-kiosk devices:** `useKioskMode()` returns `false` → provider renders `null` → zero footprint, zero JS execution beyond the hook's mount check.
- **localStorage unavailable** (private mode, SSR): hook returns `false`, provider renders `null`. No errors thrown.
- **Hydration:** hook returns `false` during SSR. After hydration, if localStorage flag is set, the hook returns `true` and the provider mounts the keyboard. Brief delay is acceptable — kiosk mode flag is set during initial Pi setup, not user-facing.

## 10. Verification

1. Visit `http://localhost:3000/?kiosk=1`, then navigate to `/lists`. `localStorage.chuppacal_kiosk` is set.
2. Reload `http://localhost:3000/lists` (no query param) → keyboard available because localStorage persists.
3. Tap the meal-modal name input → keyboard slides up from bottom; input is scrolled to vertical center of the area above the keyboard.
4. Type "tacos" via on-screen keys → modal input value updates character by character.
5. Press shift, then `t` → "T" inserted; shift releases automatically.
6. Tap backspace → last char deleted.
7. Press ⏎ → meal modal's existing save-on-Enter handler fires (modal closes), keyboard hides.
8. Open `<AddItemBar>` on /lists, type "milk", press ⏎ → item added, focus stays in input, keyboard remains visible (because focus stayed in a registered input).
9. Settings → enter PIN → toggle "Kiosk Mode" off → keyboard immediately stops appearing on subsequent input focuses.
10. Toggle Kiosk Mode back on → keyboard reappears.
11. Visit `http://localhost:3000/lists` on a real phone (or with `?kiosk=0` to force off) → no app keyboard; OS keyboard works normally.
12. Open `/settings`, focus PIN entry → only the existing 4-digit keypad shows (our keyboard does not appear because PIN inputs are buttons, not text inputs).
13. `npm run build` clean.

## 11. Out of Scope (Future)

- Symbol panel (`?123` toggle for `@`, `:`, `/`, etc.)
- Numeric-only layout for `type="number"` / `inputmode="numeric"` fields
- Caps-lock (double-tap shift) toggle
- Word suggestions / autocomplete
- Drag-to-reposition keyboard
- Multi-language layouts
- A "long-press for accents" affordance

## 12. Risks and Mitigations

- **`react-simple-keyboard` API churn**: pinning to a specific patch version in `package.json` reduces surprise. Library is mature (10k+ stars, last released within last 12 months).
- **React's controlled-input value setter trick** is well-established (used by Cypress, Testing Library) and unlikely to break across React versions, but is technically a private API. If it ever stops working, fall back to dispatching `change` events directly. We'll catch this immediately in verification.
- **Keyboard covers a critical UI element**: the `scrollIntoView` call handles the focused input. If other UI (e.g., toast notifications) gets hidden, those are non-blocking — they'll surface again when the keyboard hides.
- **Focus thrash on mobile** if a phone user somehow flips the kiosk flag: the toggle in /settings is PIN-gated. The `?kiosk=0` URL is the recovery path.
