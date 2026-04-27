import type { MealPlan, MealSlot } from "@/lib/types";
import MealCell from "./meal-cell";

const SLOT_LABELS: Record<MealSlot, string> = {
  breakfast: "Breakfast",
  lunch: "Lunch",
  dinner: "Dinner",
  snack: "Snack",
};

const ALL_SLOTS: MealSlot[] = ["breakfast", "lunch", "dinner", "snack"];

const DAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

interface Props {
  meals: MealPlan[];
  mealSlots: Record<MealSlot, boolean>;
  weekDays: string[];
  todayStr: string;
  onCellTap: (date: string, slot: MealSlot, meal?: MealPlan) => void;
}

export default function MealGrid({ meals, mealSlots, weekDays, todayStr, onCellTap }: Props) {
  const enabledSlots = ALL_SLOTS.filter((s) => mealSlots[s]);

  const mealIndex = new Map<string, MealPlan>();
  for (const meal of meals) {
    mealIndex.set(`${meal.date}|${meal.slot}`, meal);
  }

  if (enabledSlots.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center text-cc-ink/40 text-sm">
        No meal slots enabled. Turn them on in Settings.
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-auto px-2 pb-4">
      <div
        className="grid gap-1 mb-1"
        style={{ gridTemplateColumns: `72px repeat(7, 1fr)` }}
      >
        <div />
        {weekDays.map((date, i) => (
          <div
            key={date}
            className={`text-center text-xs font-semibold py-2 rounded-lg ${
              date === todayStr
                ? "bg-sky/20 text-sky"
                : "text-cc-ink/50"
            }`}
          >
            {DAY_LABELS[i]}
            <br />
            <span className="text-[10px] font-normal">
              {new Date(date + "T00:00:00").getDate()}
            </span>
          </div>
        ))}
      </div>

      {enabledSlots.map((slot) => (
        <div
          key={slot}
          className="grid gap-1 mb-1"
          style={{ gridTemplateColumns: `72px repeat(7, 1fr)` }}
        >
          <div className="text-[10px] font-semibold text-cc-ink/40 flex items-center uppercase tracking-wide px-1">
            {SLOT_LABELS[slot]}
          </div>
          {weekDays.map((date) => {
            const meal = mealIndex.get(`${date}|${slot}`);
            return (
              <MealCell
                key={date}
                meal={meal}
                isToday={date === todayStr}
                onTap={() => onCellTap(date, slot, meal)}
              />
            );
          })}
        </div>
      ))}
    </div>
  );
}
