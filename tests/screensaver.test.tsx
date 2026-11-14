// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import KioskDisplay from "@/components/kiosk-display";

vi.mock("@/components/keyboard/use-kiosk-mode", () => ({ useKioskMode: () => true }));

const settings = {
  sleep_start: "22:00",
  sleep_end: "06:00",
  screensaver_enabled: true,
  screensaver_timeout_minutes: 5,
};
const photos = ["/family-one", "/family-two"];
const advance = (ms: number) => act(() => vi.advanceTimersByTime(ms));
const overlay = () => screen.queryByRole("dialog", { name: "Family photo screensaver" });

beforeEach(() => vi.useFakeTimers());
afterEach(() => { cleanup(); vi.useRealTimers(); });

it("opens after five minutes despite background refreshes and rotates the album", () => {
  const { rerender, container } = render(<KioskDisplay settings={settings} photos={photos} />);
  for (let minute = 0; minute < 4; minute++) {
    advance(60_000);
    rerender(<KioskDisplay settings={{ ...settings }} photos={[...photos]} />);
  }
  advance(59_999);
  expect(overlay()).toBeNull();
  advance(1);
  expect(overlay()).not.toBeNull();
  expect(container.querySelector("img")?.getAttribute("src")).toBe(photos[0]);
  advance(15_000);
  expect(container.querySelector("img")?.getAttribute("src")).toBe(photos[1]);

  fireEvent.click(screen.getByRole("button", { name: "Tap or press any key to return" }));
  expect(overlay()).toBeNull();
  advance(299_999);
  expect(overlay()).toBeNull();
  advance(1);
  expect(overlay()).not.toBeNull();
});

it("counts mouse movement as activity and stays out of an open editor", () => {
  const { rerender } = render(<KioskDisplay settings={settings} photos={[]} />);
  advance(240_000);
  fireEvent.pointerMove(document.body);
  advance(60_000);
  expect(overlay()).toBeNull();
  rerender(<><KioskDisplay settings={settings} photos={[]} /><div role="dialog" aria-label="Editor" /></>);
  advance(240_000);
  expect(overlay()).toBeNull();
  rerender(<><KioskDisplay settings={settings} photos={[]} /></>);
  advance(1_000);
  const display = screen.getByRole("dialog", { name: "Family photo screensaver" });
  expect(display.querySelector("img")).toBeNull();
  fireEvent.keyDown(display, { key: "Escape" });
  expect(overlay()).toBeNull();
});
