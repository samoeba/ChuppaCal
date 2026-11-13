import type { ChoreRecurrence, MealSlot } from "@/lib/types";

export function requireId(value: unknown, label = "ID"): string {
  if (typeof value !== "string" || !/^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(value)) {
    throw new Error(`Invalid ${label}`);
  }
  return value;
}

export function requireText(value: unknown, label: string, max = 200): string {
  if (typeof value !== "string" || !value.trim() || value.trim().length > max) {
    throw new Error(`${label} must contain 1–${max} characters`);
  }
  return value.trim();
}

export function isDateString(value: unknown): value is string {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T12:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

export function requireDate(value: unknown): string {
  if (!isDateString(value)) throw new Error("Invalid date");
  return value;
}

export function requireBoolean(value: unknown): boolean {
  if (typeof value !== "boolean") throw new Error("Expected true or false");
  return value;
}

export function requireInteger(value: unknown, min: number, max: number): number {
  if (typeof value !== "number" || !Number.isInteger(value) || value < min || value > max) {
    throw new Error(`Expected a whole number from ${min} to ${max}`);
  }
  return value;
}

export function requireColor(value: unknown): string {
  if (typeof value !== "string" || !/^#[0-9a-f]{6}$/i.test(value)) throw new Error("Invalid color");
  return value;
}

export function requireMealSlot(value: unknown): MealSlot {
  if (value !== "breakfast" && value !== "lunch" && value !== "dinner" && value !== "snack") {
    throw new Error("Invalid meal slot");
  }
  return value;
}

export function requireRecurrence(value: ChoreRecurrence): ChoreRecurrence {
  if (!value || !["daily", "weekdays", "custom"].includes(value.type)) throw new Error("Invalid recurrence");
  if (value.type !== "custom") return { type: value.type };
  if (!Array.isArray(value.days) || !value.days.length) throw new Error("Choose at least one day");
  return { type: "custom", days: [...new Set(value.days.map((day) => requireInteger(day, 0, 6)))] };
}
