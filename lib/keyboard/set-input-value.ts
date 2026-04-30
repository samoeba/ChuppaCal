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
