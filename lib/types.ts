// Database types matching Supabase schema

export type Role = "parent" | "child";
export type CalendarProvider = "google" | "caldav";
export type MealSlot = "breakfast" | "lunch" | "dinner" | "snack";
export type RecurrenceType = "daily" | "weekdays" | "custom";

export interface FamilySettings {
  sleep_start: string; // "HH:mm"
  sleep_end: string; // "HH:mm"
  weather_location: string;
  screensaver_timeout_minutes: number;
  meal_slots: Record<MealSlot, boolean>;
  pin_hash: string | null;
}

export interface Family {
  id: string;
  name: string;
  settings: FamilySettings;
  created_at: string;
}

export interface FamilyMember {
  id: string;
  family_id: string;
  user_id: string | null;
  name: string;
  color: string;
  avatar_emoji: string;
  avatar_url: string | null;
  role: Role;
  chores_enabled: boolean;
  created_at: string;
}

export interface CalendarConnection {
  id: string;
  family_id: string;
  member_id: string;
  provider: CalendarProvider;
  credentials: Record<string, unknown>;
  calendar_external_id: string | null;
  calendar_name: string | null;
  last_synced_at: string | null;
  created_at: string;
}

export interface CalendarEvent {
  id: string;
  family_id: string;
  connection_id: string | null;
  member_id: string | null;
  external_id: string | null;
  title: string;
  start_time: string;
  end_time: string;
  location: string | null;
  all_day: boolean;
  synced_at: string;
}

export interface ChoreRecurrence {
  type: RecurrenceType;
  days?: number[]; // 0=Sunday, 1=Monday, etc.
}

export interface ChoreTemplate {
  id: string;
  family_id: string;
  name: string;
  emoji: string;
  star_value: number;
  recurrence: ChoreRecurrence;
  active: boolean;
  created_at: string;
}

export interface ChoreCompletion {
  id: string;
  family_id: string;
  template_id: string;
  member_id: string;
  date: string; // YYYY-MM-DD
  stars_earned: number;
  completed_at: string;
}

export interface ChoreTemplateMember {
  template_id: string;
  member_id: string;
}

export interface StarReward {
  id: string;
  family_id: string;
  name: string;
  star_cost: number;
  emoji: string | null;
  created_at: string;
}

export interface StarRedemption {
  id: string;
  reward_id: string;
  member_id: string;
  family_id: string;
  redeemed_at: string;
  stars_spent: number;
}

export interface MealPlan {
  id: string;
  family_id: string;
  date: string;
  slot: MealSlot;
  name: string;
  emoji: string | null;
  created_at: string;
}

export interface List {
  id: string;
  family_id: string;
  name: string;
  emoji: string;
  color: string;
  sort_order: number;
  created_at: string;
}

export interface ListItem {
  id: string;
  list_id: string;
  family_id: string;
  text: string;
  checked: boolean;
  sort_order: number;
  created_at: string;
}

export interface Photo {
  id: string;
  family_id: string;
  storage_path: string;
  uploaded_by: string | null;
  uploaded_at: string;
}
