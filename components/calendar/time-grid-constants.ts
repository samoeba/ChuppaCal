// Visible time range for the week-view time grid.
export const START_MIN = 7 * 60 + 30; // 7:30 AM
export const END_MIN = 20 * 60; // 8:00 PM

export const HOUR_HEIGHT = 104;
export const MIN_PX = HOUR_HEIGHT / 60;

export const TOTAL_MIN = END_MIN - START_MIN;
export const TOTAL_HEIGHT = TOTAL_MIN * MIN_PX;

// On initial load, only this many hours are visible — user can scroll to see more.
export const VIEWPORT_HOURS = 6;
export const VIEWPORT_HEIGHT = VIEWPORT_HOURS * HOUR_HEIGHT;

export const TIME_RAIL_REM = 3.5;

// Whole-hour marks rendered in the time rail (gridlines + labels).
// First mark is the lowest whole hour at or above START_MIN.
export const HOUR_MARKS: { hour: number; offsetMin: number }[] = (() => {
  const marks: { hour: number; offsetMin: number }[] = [];
  const firstHour = Math.ceil(START_MIN / 60);
  const lastHour = Math.floor(END_MIN / 60);
  for (let h = firstHour; h <= lastHour; h++) {
    marks.push({ hour: h, offsetMin: h * 60 - START_MIN });
  }
  return marks;
})();
