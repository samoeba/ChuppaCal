// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
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

it("opens after five minutes, rotates both photo layers, and dismisses without a prompt", () => {
  const { rerender } = render(<KioskDisplay settings={settings} photos={photos} />);
  for (let minute = 0; minute < 4; minute++) {
    advance(60_000);
    rerender(<KioskDisplay settings={{ ...settings }} photos={[...photos]} />);
  }
  advance(59_999);
  expect(overlay()).toBeNull();
  advance(1);
  const display = screen.getByRole("dialog", { name: "Family photo screensaver" });
  expect(within(display).queryByRole("button")).toBeNull();
  const photoSources = () => Array.from(display.querySelectorAll("img"), (image) => image.getAttribute("src"));
  expect(photoSources()).toEqual([photos[0], photos[0]]);
  advance(15_000);
  expect(photoSources()).toEqual([photos[1], photos[1]]);

  fireEvent.click(display);
  expect(overlay()).toBeNull();
  advance(299_999);
  expect(overlay()).toBeNull();
  advance(1);
  const reopened = screen.getByRole("dialog", { name: "Family photo screensaver" });
  advance(32);
  expect(document.activeElement).toBe(reopened);
  fireEvent.keyDown(document.activeElement!, { key: "a" });
  expect(overlay()).toBeNull();
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
