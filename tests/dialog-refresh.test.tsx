// @vitest-environment jsdom
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { useState } from "react";
import { useDialog } from "@/lib/use-dialog";
import RefreshData from "@/components/refresh-data";
import { setKioskMode, useKioskMode } from "@/components/keyboard/use-kiosk-mode";

const routing = vi.hoisted(() => ({ router: { refresh: vi.fn() }, pathname: "/calendar" }));
vi.mock("next/navigation", () => ({ useRouter: () => routing.router, usePathname: () => routing.pathname }));
beforeEach(() => { vi.clearAllMocks(); routing.pathname = "/calendar"; });
afterEach(() => { cleanup(); vi.useRealTimers(); vi.restoreAllMocks(); });

function Dialog({ onClose, children }: { onClose: () => void; children?: React.ReactNode }) {
  const dialog = useDialog(true, onClose);
  return <div ref={dialog} role="dialog" tabIndex={-1}><button>First</button><button onClick={onClose}>Close</button>{children}</div>;
}
it("traps focus, closes with Escape, unlocks scrolling and restores focus", async () => {
  function Harness() {
    const [open, setOpen] = useState(false);
    return <><button onClick={() => setOpen(true)}>Open</button>{open && <Dialog onClose={() => setOpen(false)} />}</>;
  }
  render(<Harness />);
  const trigger = screen.getByText("Open");
  trigger.focus();
  fireEvent.click(trigger);
  await waitFor(() => expect(document.activeElement).toBe(screen.getByText("First")));
  expect(document.body.style.overflow).toBe("hidden");
  fireEvent.keyDown(document, { key: "Tab", shiftKey: true });
  expect(document.activeElement).toBe(screen.getByText("Close"));
  fireEvent.keyDown(document, { key: "Tab" });
  expect(document.activeElement).toBe(screen.getByText("First"));
  fireEvent.keyDown(document, { key: "Escape" });
  expect(screen.queryByRole("dialog")).toBeNull();
  expect(document.activeElement).toBe(trigger);
  expect(document.body.style.overflow).toBe("");
});
it("only dismisses the topmost nested dialog", () => {
  const parentClose = vi.fn();
  const childClose = vi.fn();
  // Sibling overlays mount in the same order as the app's PIN and editor overlays.
  render(<><Dialog onClose={parentClose} /><Dialog onClose={childClose} /></>);
  fireEvent.keyDown(document, { key: "Escape" });
  expect(childClose).toHaveBeenCalledOnce();
  expect(parentClose).not.toHaveBeenCalled();
});
it("refreshes idle pages but not while editing, showing a modal, or saving", () => {
  vi.useFakeTimers();
  vi.spyOn(document, "visibilityState", "get").mockReturnValue("visible");
  const { rerender } = render(<RefreshData />);
  act(() => vi.advanceTimersByTime(60_000));
  expect(routing.router.refresh).toHaveBeenCalledOnce();
  rerender(<><RefreshData /><input aria-label="Editing" /></>);
  screen.getByRole("textbox").focus();
  act(() => vi.advanceTimersByTime(60_000));
  expect(routing.router.refresh).toHaveBeenCalledOnce();
  rerender(<><RefreshData /><div role="dialog" /></>);
  act(() => vi.advanceTimersByTime(60_000));
  expect(routing.router.refresh).toHaveBeenCalledOnce();
  rerender(<><RefreshData /><div aria-busy="true" /></>);
  act(() => vi.advanceTimersByTime(60_000));
  expect(routing.router.refresh).toHaveBeenCalledOnce();
  rerender(<RefreshData />);
  act(() => vi.advanceTimersByTime(60_000));
  expect(routing.router.refresh).toHaveBeenCalledTimes(2);
});
it("does not poll the independently loaded Settings page", () => {
  vi.useFakeTimers();
  routing.pathname = "/settings";
  render(<RefreshData />);
  act(() => vi.advanceTimersByTime(120_000));
  expect(routing.router.refresh).not.toHaveBeenCalled();
});
it("keeps kiosk controls functional when localStorage is unavailable", async () => {
  vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => { throw new Error("disabled"); });
  vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => { throw new Error("disabled"); });
  vi.spyOn(Storage.prototype, "removeItem").mockImplementation(() => { throw new Error("disabled"); });
  function Kiosk() { return <output>{useKioskMode() ? "On" : "Off"}</output>; }
  render(<Kiosk />);
  act(() => setKioskMode(true));
  await waitFor(() => expect(screen.getByText("On")).toBeTruthy());
  act(() => setKioskMode(false));
  expect(screen.getByText("Off")).toBeTruthy();
});
