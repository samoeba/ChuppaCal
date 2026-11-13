"use client";

import { useEffect, useRef } from "react";

const dialogs: HTMLElement[] = [];
let previousOverflow = "";
const FOCUSABLE = 'button:not(:disabled),a[href],input:not(:disabled),select:not(:disabled),textarea:not(:disabled),[tabindex]:not([tabindex="-1"])';

/** Shared focus, Escape, scroll-lock and focus-return behavior; supports nested dialogs. */
export function useDialog(open: boolean, onClose?: () => void) {
  const ref = useRef<HTMLDivElement>(null);
  const close = useRef(onClose);
  useEffect(() => { close.current = onClose; }, [onClose]);
  useEffect(() => {
    const element = ref.current;
    if (!open || !element) return;
    const trigger = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    if (!dialogs.length) {
      previousOverflow = document.body.style.overflow;
      document.body.style.overflow = "hidden";
    }
    dialogs.push(element);
    const focusables = () => Array.from(element.querySelectorAll<HTMLElement>(FOCUSABLE)).filter((node) => !node.hidden && node.getAttribute("aria-hidden") !== "true");
    const frame = requestAnimationFrame(() => {
      if (!element.contains(document.activeElement)) (focusables()[0] ?? element).focus();
    });
    const handleKey = (event: KeyboardEvent) => {
      if (dialogs.at(-1) !== element) return;
      if (event.key === "Escape" && close.current) {
        event.preventDefault();
        event.stopPropagation();
        close.current();
      }
      if (event.key !== "Tab") return;
      const nodes = focusables();
      const first = nodes[0] ?? element;
      const last = nodes.at(-1) ?? element;
      if (!element.contains(document.activeElement) || (event.shiftKey && document.activeElement === first) || (!event.shiftKey && document.activeElement === last) || !nodes.length) {
        event.preventDefault();
        (event.shiftKey ? last : first).focus();
      }
    };
    document.addEventListener("keydown", handleKey);
    return () => {
      cancelAnimationFrame(frame);
      document.removeEventListener("keydown", handleKey);
      const index = dialogs.indexOf(element);
      if (index !== -1) dialogs.splice(index, 1);
      if (!dialogs.length) document.body.style.overflow = previousOverflow;
      if (trigger?.isConnected) trigger.focus();
    };
  }, [open]);
  return ref;
}
