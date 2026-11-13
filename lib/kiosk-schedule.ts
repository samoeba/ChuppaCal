/** HH:mm compares lexically. Equal endpoints disable the schedule. */
export function isSleepTime(time: string, start: string, end: string): boolean {
  if (!/^\d{2}:\d{2}$/.test(time) || start === end) return false;
  return start < end ? time >= start && time < end : time >= start || time < end;
}
