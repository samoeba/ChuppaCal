# Pi Kiosk Auto-Launch — Runbook

How the wall-mounted Raspberry Pi boots straight into ChuppaCal full-screen. This is the
"Pi kiosk auto-launch" slice of Phase 8. Optional in-app scheduled sleep and idle
clock are implemented locally but are **not deployed or device-tested** yet (see below).

## What it does

On every boot the Pi:

1. Auto-logs into the desktop (Raspberry Pi OS default).
2. Starts the `labwc` Wayland compositor, which runs `~/.config/labwc/autostart`.
3. That script launches **Chromium full-screen (`--kiosk`)** pointed at the calendar,
   wrapped in a loop so it **relaunches if Chromium ever crashes or is closed**.
4. The Chromium profile persists the Supabase/Google session, so reboots go straight to
   the calendar with **no re-login**.

OS screen blanking is disabled. The new app has an optional full-screen sleep overlay,
but it defaults off and does not power down the monitor/backlight.

## Environment (as built)

| Thing | Value |
|-------|-------|
| Device | Raspberry Pi 4 (4GB) |
| OS | Raspberry Pi OS **Desktop**, Debian 13 (**Trixie**) |
| Display stack | **Wayland**, `labwc` compositor (default on Trixie for Pi 4) |
| Browser | `chromium` (binary at `/usr/bin/chromium` — note: **not** `chromium-browser`) |
| Target URL | `https://chuppa-cal.vercel.app/calendar?kiosk=1` |

The `?kiosk=1` flag is read by the app (`components/keyboard/use-kiosk-mode.ts`), persisted
to `localStorage.chuppacal_kiosk`, and turns on the on-screen touch keyboard. It only needs
to be in the URL once; it sticks per-device.

## The autostart file

`~/.config/labwc/autostart`:

```sh
#!/bin/sh
URL="https://chuppa-cal.vercel.app/calendar?kiosk=1"
while :; do
  chromium --kiosk --disable-session-crash-bubble "$URL"
  sleep 5
done &
```

- The `while :; do … done &` loop relaunches Chromium 5s after it exits (crash, close, or
  manual kill) and is backgrounded with `&` so labwc's startup completes.
- `--disable-session-crash-bubble` suppresses the "Chromium didn't shut down correctly"
  prompt. See "Optional hardening" for the stronger power-loss fix.

## Setup from scratch (after a reflash)

Open a terminal on the Pi (taskbar icon or **Ctrl+Alt+T**) and:

1. **Disable screen blanking:** `sudo raspi-config` → `Display Options` → `Screen Blanking`
   → **No** → `Finish`.
2. **Create the launcher:**
   ```sh
   mkdir -p ~/.config/labwc
   nano ~/.config/labwc/autostart
   ```
   Type the 6 lines from "The autostart file" above, then **Ctrl+O, Enter** to save and
   **Ctrl+X** to exit.
3. **Verify, then reboot:** `cat ~/.config/labwc/autostart` to eyeball it, then `sudo reboot`.
4. **First boot only:** if it lands on the login page, sign in with Google as the family
   owner’s existing account — verify the expected OAuth application before continuing through any consent warning
   via Advanced. The session then persists across reboots.

## Maintenance / recovery

The kiosk owns the whole screen and relaunches on close, so to get back to the desktop:

- **Drop to a text console:** **Ctrl+Alt+F2** → log in (username, then password).
- **Temporarily disable the kiosk:**
  ```sh
  mv ~/.config/labwc/autostart ~/.config/labwc/autostart.off
  sudo reboot
  ```
  Boots to the normal desktop. Move it back (`mv … autostart.off … autostart`) to re-enable.
- **Edit live:** `nano ~/.config/labwc/autostart`, then `sudo reboot` to apply (autostart
  only runs at session start).
- Return from the text console to the graphical session with **Ctrl+Alt+F1** (or F7).

## Optional hardening (not yet applied)

These are nice-to-haves we deliberately left out of the first working version:

- **Power-loss restore prompt.** A kitchen kiosk will lose power. On unclean shutdown
  Chromium may show a "Restore pages" prompt that blocks the screen. The robust fix is to
  reset the profile's exit state before each launch — add this line just inside the loop,
  before the `chromium` line:
  ```sh
  sed -i 's/"exit_type":"[^"]*"/"exit_type":"Normal"/' "$HOME/.config/chromium/Default/Preferences" 2>/dev/null
  ```
- **Hide the mouse cursor** (cosmetic; touch-only doesn't really need it). No clean
  one-liner on labwc/Wayland — revisit if it bugs you.
- **Force Wayland explicitly:** add `--ozone-platform=wayland` to the `chromium` line.
  Omitted because Chromium auto-detected Wayland correctly; add only if fullscreen/touch
  misbehaves after an OS update.

## Optional display modes in the pending app release

After the schema/app release in `docs/release-2026-09-27.md`, use Settings → Display
to enable either mode **on the kiosk**. These preferences are family-wide, but the overlay
appears only on devices with kiosk mode enabled (`?kiosk=1`). Both start disabled.

- **Scheduled sleep:** an in-app dark overlay follows the family's IANA timezone and
  `sleep_start`/`sleep_end`. A tap/key wakes it for 10 minutes. It does not send a monitor
  power command; the backlight may remain on. Test overnight energy and burn-in behavior
  on the physical Acer before relying on it.
- **Idle clock:** after the configured idle minutes, shows a large clock and cycles the
  family member profile photos already stored in the app. A tap/key returns to the app.
  This is **not** a separate family photo gallery. Existing photos are currently public
  URLs (approval item 3 remains on hold), so do not add sensitive images.

Test keyboard/touch wake, editing suppression, kiosk restart, midnight and power loss
on the actual Pi. Desktop/jsdom checks are not hardware acceptance.
