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
  const [exiting, setExiting] = useState(false);
  const blurTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const exitTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const wasDesired = useRef(false);
  const desired = kiosk && !!focused;
  // Derived: render the keyboard while it's wanted OR still animating out.
  const shown = desired || exiting;

  useEffect(() => {
    // When kiosk is off, attach no listeners. The render below is also
    // gated on `kiosk && focused`, so any stale `focused` ref is invisible
    // until kiosk flips back on.
    if (!kiosk) return;

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

  // Drive the show/exit lifecycle so the keyboard can animate out before
  // unmounting. Re-focusing during exit cancels the exit timer cleanly.
  // setState calls here are deliberate transitions tied to the timer
  // side effect — disabling the cascading-render lint for this effect.
  // NOTE: no cleanup function — clearing the timer on every re-render
  // would wipe out the timer we just scheduled (since setExiting triggers
  // a re-render). Unmount cleanup lives in its own effect below.
  useEffect(() => {
    const previouslyDesired = wasDesired.current;
    wasDesired.current = desired;
    if (desired) {
      if (exitTimer.current) {
        clearTimeout(exitTimer.current);
        exitTimer.current = null;
      }
      // eslint-disable-next-line react-hooks/set-state-in-effect
      if (exiting) setExiting(false);
      return;
    }
    if (previouslyDesired) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setExiting(true);
      exitTimer.current = setTimeout(() => {
        setExiting(false);
        exitTimer.current = null;
      }, 320);
    }
  }, [desired, exiting]);

  // Unmount-only cleanup — clears any in-flight exit timer when the
  // provider itself goes away.
  useEffect(() => {
    return () => {
      if (exitTimer.current) {
        clearTimeout(exitTimer.current);
        exitTimer.current = null;
      }
    };
  }, []);

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
    try {
      el.setSelectionRange(newCaret, newCaret);
    } catch {
      // number/email/etc. inputs don't support selection APIs — ignore
    }
  }

  return (
    <>
      {children}
      {shown && (
        <>
          <div
            onMouseDown={(e) => {
              // Invisible click-catcher — tap outside the keyboard panel
              // dismisses; preventDefault keeps focus on input momentarily
              // so blur fires cleanly. No background dim per design intent.
              e.preventDefault();
              focused?.blur();
            }}
            onTouchStart={(e) => {
              e.preventDefault();
              focused?.blur();
            }}
            className="fixed inset-0 z-[55]"
            aria-hidden="true"
          />
          <TouchKeyboard onKey={handleKey} exiting={exiting} />
        </>
      )}
    </>
  );
}
