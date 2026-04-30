# On-Screen Keyboard Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a touchscreen-friendly QWERTY keyboard that pops up over `<input>` and `<textarea>` fields when the app is in kiosk mode, so the wall-mounted Pi+touchscreen can support text entry without a hardware keyboard. Phones using the same Vercel URL keep their OS keyboard.

**Architecture:** Single global `<TouchKeyboardProvider>` mounted in the root layout. It watches `focusin`/`focusout` events at the document level, identifies registered inputs (text/number/textarea, not opted out), and renders a `react-simple-keyboard`-powered overlay only when the kiosk-mode flag is set in `localStorage`. Key presses dispatch synthetic `input` events using React's native value-setter trick so existing controlled inputs work without modification.

**Tech Stack:** React 19, Next.js 16 (App Router), TypeScript, Tailwind CSS v4, `react-simple-keyboard` (new dependency).

**Spec:** `docs/superpowers/specs/2026-04-30-on-screen-keyboard-design.md`

**Testing note:** This codebase has no test framework (no jest/vitest/playwright), and existing components have zero tests by design. Verification is `npm run build` plus the manual checks in spec §10. Do **not** introduce a test framework as part of this plan.

**Files this plan touches:**

| Path | Action | Responsibility |
|------|--------|----------------|
| `package.json` | Modify | Add `react-simple-keyboard` dependency |
| `lib/keyboard/set-input-value.ts` | Create | Programmatic value setter that fires React's controlled-input change handlers |
| `components/keyboard/use-kiosk-mode.ts` | Create | Hook reading `?kiosk=1` and `localStorage.chuppacal_kiosk` |
| `components/keyboard/touch-keyboard.tsx` | Create | Thin themed wrapper around `react-simple-keyboard` |
| `components/keyboard/touch-keyboard-provider.tsx` | Create | Focus tracking + event bridging + conditional render |
| `app/globals.css` | Modify | CSS overrides to theme `react-simple-keyboard` |
| `app/layout.tsx` | Modify | Wrap children in `<TouchKeyboardProvider>` |
| `components/settings/kiosk-mode-section.tsx` | Create | PIN-gated toggle for the kiosk flag |
| `app/(main)/settings/page.tsx` | Modify | Mount `<KioskModeSection>` |

---

### Task 1: Install `react-simple-keyboard`

**Files:**
- Modify: `package.json` (and `package-lock.json` regenerated)

- [ ] **Step 1: Install the package**

Run from `/Users/samcasey/Local-Sites/not-skylight-calendar`:

```bash
npm install react-simple-keyboard@3.7.117
```

(Pin to a known-good patch version. As of writing the latest 3.x is 3.7.x; if `3.7.117` is unavailable take the highest 3.7.x patch with `npm view react-simple-keyboard versions --json | tail -20` and adjust.)

- [ ] **Step 2: Verify install**

Run: `npm ls react-simple-keyboard`
Expected: shows `react-simple-keyboard@3.x.x` as a top-level dependency.

- [ ] **Step 3: Type-check**

Run: `npm run build`
Expected: build succeeds (the package adds nothing to the bundle yet — we haven't imported it).

- [ ] **Step 4: Commit**

```bash
git add package.json package-lock.json
git commit -m "feat(keyboard): add react-simple-keyboard dependency"
```

---

### Task 2: Native Input Value Setter Helper

**Files:**
- Create: `lib/keyboard/set-input-value.ts`

This module isolates the React private-API trick that's needed to make programmatic value writes fire `onChange` handlers on controlled inputs. Used only by the keyboard provider.

- [ ] **Step 1: Create the file**

```typescript
// lib/keyboard/set-input-value.ts
/**
 * Programmatically set an input or textarea value AND make React's
 * controlled-input onChange handlers fire.
 *
 * React tracks "last known value" internally to detect changes. Direct
 * `el.value = x` assignments bypass that tracking, so React's onChange
 * handler does NOT run. The fix is to use the native HTMLInputElement
 * (or HTMLTextAreaElement) value setter, which React's tracking does
 * notice. This is the same technique used by Cypress and React Testing
 * Library.
 *
 * After setting the value, dispatch a bubbling "input" event so that
 * listeners (including React's synthetic onChange) fire.
 */
export function setInputValue(
  el: HTMLInputElement | HTMLTextAreaElement,
  value: string
): void {
  const proto =
    el instanceof HTMLTextAreaElement
      ? HTMLTextAreaElement.prototype
      : HTMLInputElement.prototype;
  const setter = Object.getOwnPropertyDescriptor(proto, "value")?.set;
  if (!setter) {
    el.value = value;
  } else {
    setter.call(el, value);
  }
  el.dispatchEvent(new Event("input", { bubbles: true }));
}
```

- [ ] **Step 2: Type-check**

Run: `npm run build`
Expected: build succeeds.

- [ ] **Step 3: Commit**

```bash
git add lib/keyboard/set-input-value.ts
git commit -m "feat(keyboard): add native input value setter helper"
```

---

### Task 3: Kiosk-Mode Hook

**Files:**
- Create: `components/keyboard/use-kiosk-mode.ts`

- [ ] **Step 1: Create the file**

```typescript
// components/keyboard/use-kiosk-mode.ts
"use client";

import { useEffect, useState } from "react";

const STORAGE_KEY = "chuppacal_kiosk";

function readFlag(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return window.localStorage.getItem(STORAGE_KEY) === "1";
  } catch {
    return false;
  }
}

function writeFlag(on: boolean): void {
  try {
    if (on) window.localStorage.setItem(STORAGE_KEY, "1");
    else window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    // localStorage unavailable (private mode, etc) — silently ignore
  }
}

/**
 * Returns true when kiosk mode is active.
 *
 * Activation rules (in order):
 * 1. URL has `?kiosk=1` -> set flag and return true (kiosk URL is master switch).
 * 2. URL has `?kiosk=0` -> clear flag and return false (recovery URL).
 * 3. Otherwise read `localStorage.chuppacal_kiosk`.
 *
 * Returns false during SSR. Also subscribes to the `storage` event so
 * cross-tab toggles propagate, plus a custom event for same-tab toggles
 * triggered by the settings switch.
 */
export function useKioskMode(): boolean {
  const [active, setActive] = useState<boolean>(false);

  useEffect(() => {
    const url = new URL(window.location.href);
    const param = url.searchParams.get("kiosk");
    if (param === "1") {
      writeFlag(true);
      setActive(true);
    } else if (param === "0") {
      writeFlag(false);
      setActive(false);
    } else {
      setActive(readFlag());
    }

    const onStorage = (e: StorageEvent) => {
      if (e.key === STORAGE_KEY) setActive(readFlag());
    };
    const onCustom = () => setActive(readFlag());

    window.addEventListener("storage", onStorage);
    window.addEventListener("chuppacal-kiosk-changed", onCustom);
    return () => {
      window.removeEventListener("storage", onStorage);
      window.removeEventListener("chuppacal-kiosk-changed", onCustom);
    };
  }, []);

  return active;
}

/**
 * Imperative setter used by the settings toggle.
 * Writes localStorage AND fires a custom event so other tabs / providers
 * pick up the change without waiting for a re-mount.
 */
export function setKioskMode(on: boolean): void {
  writeFlag(on);
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event("chuppacal-kiosk-changed"));
  }
}
```

- [ ] **Step 2: Type-check**

Run: `npm run build`
Expected: build succeeds.

- [ ] **Step 3: Commit**

```bash
git add components/keyboard/use-kiosk-mode.ts
git commit -m "feat(keyboard): add kiosk-mode hook with localStorage + URL flag"
```

---

### Task 4: TouchKeyboard Component (themed wrapper)

**Files:**
- Create: `components/keyboard/touch-keyboard.tsx`

This is the visible keyboard panel. It owns the layout, shift state, and emits keystrokes via callback. It does NOT touch any DOM input directly — that's the provider's job.

- [ ] **Step 1: Create the file**

```tsx
// components/keyboard/touch-keyboard.tsx
"use client";

import { useState } from "react";
import Keyboard from "react-simple-keyboard";
import "react-simple-keyboard/build/css/index.css";

export type KeyEvent =
  | { kind: "char"; char: string }
  | { kind: "backspace" }
  | { kind: "enter" }
  | { kind: "done" };

interface Props {
  onKey: (e: KeyEvent) => void;
}

const LAYOUT_DEFAULT = [
  "1 2 3 4 5 6 7 8 9 0",
  "q w e r t y u i o p",
  "a s d f g h j k l",
  "{shift} z x c v b n m ' -",
  "{done} {space} {enter}",
];

const LAYOUT_SHIFTED = [
  "1 2 3 4 5 6 7 8 9 0",
  "Q W E R T Y U I O P",
  "A S D F G H J K L",
  "{shift} Z X C V B N M ' -",
  "{done} {space} {enter}",
];

const DISPLAY: Record<string, string> = {
  "{shift}": "⇧",
  "{space}": " ",
  "{enter}": "⏎",
  "{done}": "✓ Done",
  "{bksp}": "⌫",
};

const BUTTON_THEME = [
  { class: "tk-key-action", buttons: "{shift} {enter} {done}" },
  { class: "tk-key-space", buttons: "{space}" },
];

export default function TouchKeyboard({ onKey }: Props) {
  const [shifted, setShifted] = useState(false);

  function handleKeyPress(button: string) {
    if (button === "{shift}") {
      setShifted((s) => !s);
      return;
    }
    if (button === "{space}") {
      onKey({ kind: "char", char: " " });
      if (shifted) setShifted(false);
      return;
    }
    if (button === "{bksp}") {
      onKey({ kind: "backspace" });
      return;
    }
    if (button === "{enter}") {
      onKey({ kind: "enter" });
      return;
    }
    if (button === "{done}") {
      onKey({ kind: "done" });
      return;
    }
    // Printable char
    onKey({ kind: "char", char: button });
    if (shifted) setShifted(false);
  }

  return (
    <Keyboard
      layoutName={shifted ? "shifted" : "default"}
      layout={{
        default: LAYOUT_DEFAULT,
        shifted: LAYOUT_SHIFTED,
      }}
      display={DISPLAY}
      buttonTheme={BUTTON_THEME}
      onKeyPress={handleKeyPress}
      preventMouseDownDefault={true}
      stopMouseDownPropagation={true}
    />
  );
}
```

The `preventMouseDownDefault` and `stopMouseDownPropagation` props prevent the keyboard's own buttons from stealing focus from the input being typed into.

- [ ] **Step 2: Type-check**

Run: `npm run build`
Expected: build succeeds. The keyboard CSS file from the package is imported but won't have visible effect until the provider mounts an instance.

- [ ] **Step 3: Commit**

```bash
git add components/keyboard/touch-keyboard.tsx
git commit -m "feat(keyboard): add themed TouchKeyboard wrapper"
```

---

### Task 5: TouchKeyboardProvider (focus tracking + event bridging)

**Files:**
- Create: `components/keyboard/touch-keyboard-provider.tsx`

This is the brain. Watches focus events, tracks the active input, computes new values on each keystroke, and uses `setInputValue` to write back.

- [ ] **Step 1: Create the file**

```tsx
// components/keyboard/touch-keyboard-provider.tsx
"use client";

import { useEffect, useRef, useState } from "react";
import { setInputValue } from "@/lib/keyboard/set-input-value";
import { useKioskMode } from "./use-kiosk-mode";
import TouchKeyboard, { type KeyEvent } from "./touch-keyboard";

type FocusableInput = HTMLInputElement | HTMLTextAreaElement;

const SUPPORTED_INPUT_TYPES = new Set([
  "text",
  "number",
  "search",
  "email",
  "tel",
  "url",
]);

function isKeyboardTarget(el: EventTarget | null): el is FocusableInput {
  if (!(el instanceof HTMLInputElement) && !(el instanceof HTMLTextAreaElement)) {
    return false;
  }
  if (el.disabled || el.readOnly) return false;
  if (el.dataset.noKeyboard !== undefined) return false;
  if (el instanceof HTMLInputElement) {
    const type = el.type || "text";
    if (!SUPPORTED_INPUT_TYPES.has(type)) return false;
  }
  return true;
}

export default function TouchKeyboardProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const kiosk = useKioskMode();
  const [focused, setFocused] = useState<FocusableInput | null>(null);
  const blurTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!kiosk) {
      setFocused(null);
      return;
    }

    function onFocusIn(e: FocusEvent) {
      if (blurTimer.current) {
        clearTimeout(blurTimer.current);
        blurTimer.current = null;
      }
      if (isKeyboardTarget(e.target)) {
        setFocused(e.target);
      } else {
        setFocused(null);
      }
    }

    function onFocusOut() {
      // Debounce so that focus moving to another registered input keeps
      // the keyboard up; only clear if focus settles on a non-target.
      if (blurTimer.current) clearTimeout(blurTimer.current);
      blurTimer.current = setTimeout(() => {
        const active = document.activeElement;
        if (!isKeyboardTarget(active)) setFocused(null);
      }, 50);
    }

    document.addEventListener("focusin", onFocusIn);
    document.addEventListener("focusout", onFocusOut);
    return () => {
      document.removeEventListener("focusin", onFocusIn);
      document.removeEventListener("focusout", onFocusOut);
      if (blurTimer.current) clearTimeout(blurTimer.current);
    };
  }, [kiosk]);

  // Scroll the focused input into view when keyboard appears
  useEffect(() => {
    if (focused) {
      focused.scrollIntoView({ block: "center", behavior: "smooth" });
    }
  }, [focused]);

  function handleKey(ev: KeyEvent) {
    const el = focused;
    if (!el) return;

    if (ev.kind === "done") {
      el.blur();
      return;
    }

    if (ev.kind === "enter") {
      // Dispatch an Enter keydown so existing onKeyDown handlers fire
      // (e.g., meal modal save-on-Enter, list-item save-on-Enter).
      el.dispatchEvent(
        new KeyboardEvent("keydown", {
          key: "Enter",
          code: "Enter",
          bubbles: true,
        })
      );
      el.dispatchEvent(
        new KeyboardEvent("keyup", {
          key: "Enter",
          code: "Enter",
          bubbles: true,
        })
      );
      // Hint dismissal — but don't blur, because the Enter handler may
      // have moved focus elsewhere already (e.g., add-item-bar refocuses
      // its own input). Let focusout debounce decide.
      return;
    }

    const start = el.selectionStart ?? el.value.length;
    const end = el.selectionEnd ?? el.value.length;

    let newValue: string;
    let newCaret: number;

    if (ev.kind === "char") {
      newValue = el.value.slice(0, start) + ev.char + el.value.slice(end);
      newCaret = start + ev.char.length;
    } else if (ev.kind === "backspace") {
      if (start === end && start > 0) {
        newValue = el.value.slice(0, start - 1) + el.value.slice(end);
        newCaret = start - 1;
      } else if (start !== end) {
        newValue = el.value.slice(0, start) + el.value.slice(end);
        newCaret = start;
      } else {
        return; // Caret at 0 with no selection — nothing to delete
      }
    } else {
      return;
    }

    setInputValue(el, newValue);
    el.setSelectionRange(newCaret, newCaret);
  }

  return (
    <>
      {children}
      {kiosk && focused && (
        <>
          <div
            onMouseDown={(e) => {
              // Tap on backdrop dismisses; preventDefault keeps focus on input
              // momentarily so blur fires cleanly.
              e.preventDefault();
              focused.blur();
            }}
            onTouchStart={(e) => {
              e.preventDefault();
              focused.blur();
            }}
            className="fixed inset-x-0 top-0 bottom-[40vh] bg-black/20 z-[55]"
            aria-hidden="true"
          />
          <div
            onMouseDown={(e) => e.preventDefault()}
            onTouchStart={(e) => e.preventDefault()}
            className="fixed inset-x-0 bottom-0 z-[60] bg-cc-cream border-t border-slate-200 shadow-2xl"
            style={{ height: "40vh", minHeight: "260px" }}
          >
            <TouchKeyboard onKey={handleKey} />
          </div>
        </>
      )}
    </>
  );
}
```

- [ ] **Step 2: Type-check**

Run: `npm run build`
Expected: build succeeds. Component is created but not yet mounted in any layout — that's the next task.

- [ ] **Step 3: Commit**

```bash
git add components/keyboard/touch-keyboard-provider.tsx
git commit -m "feat(keyboard): add TouchKeyboardProvider with focus tracking and event bridging"
```

---

### Task 6: Theme Overrides in `globals.css`

**Files:**
- Modify: `app/globals.css`

Override `react-simple-keyboard`'s default styles so it matches the design system.

- [ ] **Step 1: Append theme block to `globals.css`**

Open `app/globals.css` and append this block at the end of the file (do not modify any existing rules):

```css
/* On-screen keyboard theme overrides for react-simple-keyboard.
   Targets the library's BEM-ish class names. */
.simple-keyboard {
  background: transparent;
  font-family: var(--font-display, var(--font-national-park));
  padding: 0.75rem 0.5rem;
  height: 100%;
}
.simple-keyboard .hg-rows {
  height: 100%;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}
.simple-keyboard .hg-row {
  display: flex;
  gap: 0.5rem;
  flex: 1;
}
.simple-keyboard .hg-button {
  background: white;
  color: var(--color-cc-ink);
  border: 1px solid rgba(28, 26, 20, 0.1);
  border-radius: 0.75rem;
  font-size: 1.25rem;
  font-weight: 600;
  flex: 1;
  min-height: 48px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  user-select: none;
  -webkit-tap-highlight-color: transparent;
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.04);
  transition: background-color 0.05s, transform 0.05s;
}
.simple-keyboard .hg-button:active,
.simple-keyboard .hg-activeButton {
  background: #f1f5f9; /* slate-100 */
  transform: scale(0.97);
}
.simple-keyboard .hg-button.tk-key-action {
  background: #fb7185; /* rose-400 — close to cc-coral; tune later */
  color: white;
  border-color: transparent;
}
.simple-keyboard .hg-button.tk-key-action:active {
  background: #f43f5e; /* rose-500 */
}
.simple-keyboard .hg-button.tk-key-space {
  flex: 4;
}
.simple-keyboard .hg-button[data-skbtn="{done}"],
.simple-keyboard .hg-button[data-skbtn="{enter}"] {
  flex: 1.5;
}
```

- [ ] **Step 2: Type-check**

Run: `npm run build`
Expected: build succeeds. CSS is purely visual; no functional change.

- [ ] **Step 3: Commit**

```bash
git add app/globals.css
git commit -m "feat(keyboard): theme react-simple-keyboard to match design system"
```

---

### Task 7: Mount Provider in Root Layout

**Files:**
- Modify: `app/layout.tsx`

- [ ] **Step 1: Add the import and wrap children**

Replace the contents of `app/layout.tsx` with:

```tsx
import type { Metadata } from "next";
import { National_Park, Geist_Mono } from "next/font/google";
import "./globals.css";
import TouchKeyboardProvider from "@/components/keyboard/touch-keyboard-provider";

const nationalPark = National_Park({
  variable: "--font-national-park",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "ChuppaCal",
  description: "DIY family calendar — your kitchen command center",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${nationalPark.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-cc-beige text-cc-ink">
        <TouchKeyboardProvider>{children}</TouchKeyboardProvider>
      </body>
    </html>
  );
}
```

The `<TouchKeyboardProvider>` is a Client Component, but it can wrap Server Components as children — Next.js handles this. The children are still server-rendered; only the provider's own JS runs on the client.

- [ ] **Step 2: Type-check**

Run: `npm run build`
Expected: build succeeds.

- [ ] **Step 3: Visual smoke test (skip if no dev environment)**

Run: `npm run dev`
Open: `http://localhost:3000/?kiosk=1` — wait for any page to render.
Reload `http://localhost:3000/login` (no query param) — focus is irrelevant on this page; just confirm no crashes.
Stop dev server.

(The keyboard won't appear yet because `/login` likely doesn't have a registered text input. The next manual end-to-end check happens in Task 9.)

- [ ] **Step 4: Commit**

```bash
git add app/layout.tsx
git commit -m "feat(keyboard): mount TouchKeyboardProvider in root layout"
```

---

### Task 8: KioskModeSection in Settings

**Files:**
- Create: `components/settings/kiosk-mode-section.tsx`
- Modify: `app/(main)/settings/page.tsx`

- [ ] **Step 1: Create the component**

```tsx
// components/settings/kiosk-mode-section.tsx
"use client";

import { useEffect, useState } from "react";
import { setKioskMode } from "@/components/keyboard/use-kiosk-mode";

export default function KioskModeSection() {
  // Initialize from current localStorage state on mount
  const [enabled, setEnabled] = useState<boolean>(false);

  useEffect(() => {
    try {
      setEnabled(window.localStorage.getItem("chuppacal_kiosk") === "1");
    } catch {
      setEnabled(false);
    }
  }, []);

  function handleToggle() {
    const next = !enabled;
    setEnabled(next);
    setKioskMode(next);
  }

  return (
    <section className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100 mb-6">
      <h2 className="text-lg font-semibold text-slate-900 mb-1">Kiosk Mode</h2>
      <p className="text-sm text-slate-400 mb-4">
        Enables the on-screen keyboard for touchscreen-only devices like the wall display.
        Phones using the same URL keep their native keyboard.
      </p>
      <div className="flex items-center justify-between">
        <span className="font-medium text-slate-700">On-screen keyboard</span>
        <button
          role="switch"
          aria-checked={enabled}
          onClick={handleToggle}
          className={`relative w-12 h-6 rounded-full transition-colors touch-manipulation ${
            enabled ? "bg-clover" : "bg-slate-200"
          }`}
        >
          <span
            className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${
              enabled ? "translate-x-6" : "translate-x-0"
            }`}
          />
        </button>
      </div>
    </section>
  );
}
```

The toggle styling matches the existing `<MealSlotsSection>` switch pattern.

- [ ] **Step 2: Mount it in the Settings page**

Open `app/(main)/settings/page.tsx`. Find the imports near the top and add (alongside the other component imports):

```typescript
import KioskModeSection from "@/components/settings/kiosk-mode-section";
```

Find the `<ListsSection initialLists={lists} />` element (it was added in Phase 7, around line 401). Immediately after it, add:

```tsx
<KioskModeSection />
```

- [ ] **Step 3: Type-check**

Run: `npm run build`
Expected: build succeeds.

- [ ] **Step 4: Commit**

```bash
git add components/settings/kiosk-mode-section.tsx app/\(main\)/settings/page.tsx
git commit -m "feat(keyboard): add Kiosk Mode toggle to settings"
```

---

### Task 9: End-to-end Verification + CLAUDE.md Update

**Files:**
- Modify: `CLAUDE.md`

- [ ] **Step 1: Run the verification checklist**

Per spec §10. Start `npm run dev`, then:

1. ✅ Visit `http://localhost:3000/?kiosk=1`. In DevTools → Application → LocalStorage, confirm `chuppacal_kiosk = "1"`.
2. ✅ Reload `http://localhost:3000/lists` (no query param) — keyboard available because the flag persists.
3. ✅ Navigate to `/meals`, click an empty cell → meal modal opens, name input auto-focuses → keyboard slides up from bottom; the modal's input is centered above the keyboard via `scrollIntoView`.
4. ✅ Tap "t", "a", "c", "o", "s" on the on-screen keyboard → input shows "tacos" character by character.
5. ✅ Tap shift, then "T" → "T" inserted; shift releases automatically. Now type a lowercase letter to confirm shift is off.
6. ✅ Tap backspace → last char deleted.
7. ✅ Tap ⏎ → meal modal saves and closes (existing Enter handler), keyboard hides.
8. ✅ Go to `/lists`, focus the Add bar of a list, type "milk", tap ⏎ → item added; the input refocuses (per existing add-item-bar behavior); keyboard remains visible because focus stayed in a registered input.
9. ✅ On `/lists`, tap an existing item's text to enter edit mode, edit it via on-screen keyboard, tap ⏎ → text saved.
10. ✅ Settings → enter PIN → "Kiosk Mode" section appears with toggle ON. Toggle it OFF → keyboard immediately stops appearing on subsequent input focuses.
11. ✅ Toggle Kiosk Mode back ON → keyboard reappears on the next focus.
12. ✅ Visit `http://localhost:3000/?kiosk=0` to clear the flag, then go to `/lists` and focus an input → no app keyboard. (Simulates phone behavior.)
13. ✅ With kiosk OFF, visit `http://localhost:3000/?kiosk=1` again to re-enable — confirms the round-trip.
14. ✅ Settings page → focus the PIN entry on the lock screen → only the existing 4-digit keypad shows (the on-screen keyboard does NOT appear because PIN inputs are buttons, not text inputs).
15. ✅ Resize the browser to phone width (~375px), turn kiosk mode ON, focus an input → keyboard renders above the bottom-tabs nav and is usable.
16. ✅ `npm run build` clean.

If any step fails, fix the underlying component, commit the fix, and re-run the affected checks.

- [ ] **Step 2: Update CLAUDE.md**

Open `CLAUDE.md`. Under the existing "✅ Completed" section (after the Phase 7 Lists block), add:

```markdown
- **Auxiliary: On-Screen Keyboard** (kiosk-mode QWERTY)
  - Global `<TouchKeyboardProvider>` mounted in `app/layout.tsx`
  - `react-simple-keyboard` powered, themed to match design tokens
  - Activated via `?kiosk=1` URL flag (persisted to `localStorage.chuppacal_kiosk`) or PIN-gated toggle in `/settings`
  - Auto-shows on focus of text/number/textarea inputs, dismisses on backdrop tap or Done key
  - Press Enter dispatches a real keydown so existing save-on-Enter handlers fire
  - Spec: `docs/superpowers/specs/2026-04-30-on-screen-keyboard-design.md`
  - Phones using the same URL keep their OS keyboard (kiosk flag is per-device)
```

- [ ] **Step 3: Commit**

```bash
git add CLAUDE.md
git commit -m "docs: note on-screen keyboard feature complete"
```

---

## Self-Review Notes

**Spec coverage check:**

| Spec section | Implemented in |
|---|---|
| §3 Architecture (file layout) | All 9 files match the table |
| §4 Kiosk-mode detection (URL + localStorage + storage event + custom event) | Task 3 (`use-kiosk-mode.ts`) |
| §5 Provider + focus tracking + target predicate + debounce | Task 5 (`touch-keyboard-provider.tsx`) |
| §6 Event bridging (insert/delete/shift/enter/done + value setter + caret restore) | Task 5 + Task 2 helper |
| §7 Layout (QWERTY + number row + shift) | Task 4 (`touch-keyboard.tsx`) |
| §7 Theming (cc-cream, cc-ink, key style, z-index) | Task 6 (`globals.css`) + Task 5 (panel/backdrop classes) |
| §7 Dismissal (backdrop, Done, Enter, blur) | Task 5 |
| §7 Scroll-into-view | Task 5 (effect on `focused` change) |
| §8 Settings toggle | Task 8 |
| §9 Edge cases (modal z-stacking, autofocus, opt-out via `data-no-keyboard`, non-kiosk no-op, localStorage unavailable, hydration safety) | Task 5 + Task 3 |
| §10 Verification | Task 9 |

**Type consistency check:**
- `KeyEvent` exported from `touch-keyboard.tsx` and consumed in `touch-keyboard-provider.tsx` — same shape. ✓
- `setInputValue` signature in `lib/keyboard/set-input-value.ts` matches usage in provider. ✓
- `useKioskMode` returns `boolean`, `setKioskMode` takes `boolean`. ✓
- `FocusableInput` type used internally in provider (`HTMLInputElement | HTMLTextAreaElement`) — consistent.

**Placeholder scan:** No TBDs/TODOs/"implement later" markers. Code blocks are complete.

**Open follow-ups (deferred per spec §11):**
- Symbol panel (`?123` toggle)
- Numeric-only layout
- Caps-lock toggle
- Word suggestions
- Drag-to-reposition
- Multi-language layouts

**Tuning that may be needed once tested on real Acer hardware:**
- Keyboard `40vh` height + `260px` minimum — may want to bump for the 1080p portrait wall display
- `cc-coral` accent — currently using `rose-400/500` as approximation; swap to actual `cc-coral` token if defined elsewhere
