import type { MealPlan } from "@/lib/types";

interface Props {
  meal?: MealPlan;
  isToday: boolean;
  onTap: () => void;
}

export default function MealCell({ meal, isToday, onTap }: Props) {
  return (
    <button
      onClick={onTap}
      className={`
        w-full min-h-[56px] rounded-xl p-1.5
        flex flex-col items-center justify-center gap-0.5
        touch-manipulation transition-opacity active:opacity-60
        ${isToday ? "bg-[var(--sky)]/10" : "bg-[var(--cc-cream)]"}
      `}
    >
      {meal ? (
        <>
          {meal.emoji && (
            <span className="text-base leading-none">{meal.emoji}</span>
          )}
          <span className="text-[10px] font-medium text-[var(--cc-ink)] leading-tight line-clamp-2 text-center px-0.5">
            {meal.name}
          </span>
        </>
      ) : (
        <span className="text-[var(--cc-ink)]/20 text-xl font-light leading-none">+</span>
      )}
    </button>
  );
}
