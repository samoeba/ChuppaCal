// components/lists/list-column.tsx
"use client";

import { useState, useTransition } from "react";
import type { List, ListItem } from "@/lib/types";
import ListItemRow from "./list-item-row";
import AddItemBar from "./add-item-bar";
import { clearCompleted } from "@/app/actions/lists";

interface Props {
  list: List;
  items: ListItem[];
  familyId: string;
  onItemsChange: (updater: (prev: ListItem[]) => ListItem[]) => void;
}

function compareItems(a: ListItem, b: ListItem) {
  if (a.checked !== b.checked) return a.checked ? 1 : -1;
  if (a.sort_order !== b.sort_order) return a.sort_order - b.sort_order;
  return a.created_at.localeCompare(b.created_at);
}

export default function ListColumn({ list, items, familyId, onItemsChange }: Props) {
  const [error, setError] = useState<string | null>(null);
  const [, startTransition] = useTransition();
  const sorted = [...items].sort(compareItems);
  const uncheckedCount = items.filter((i) => !i.checked).length;
  const checkedCount = items.length - uncheckedCount;

  async function handleClearCompleted() {
    if (checkedCount === 0) return;
    if (!confirm(`Clear ${checkedCount} completed item${checkedCount === 1 ? "" : "s"} from "${list.name}"?`)) return;
    onItemsChange((prev) => prev.filter((i) => !(i.list_id === list.id && i.checked)));
    startTransition(async () => {
      try {
        await clearCompleted(list.id);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to clear");
      }
    });
  }

  return (
    <section
      className="flex flex-col bg-white rounded-2xl shadow-sm border border-slate-100 w-80 max-w-[85vw] flex-shrink-0"
      style={{ borderTop: `4px solid ${list.color}` }}
    >
      <header className="px-4 pt-4 pb-2">
        <div className="flex items-baseline gap-2">
          <span className="text-2xl">{list.emoji}</span>
          <h2 className="text-lg font-semibold text-slate-900 flex-1">{list.name}</h2>
          <span className="text-sm text-slate-400">{uncheckedCount}</span>
        </div>
      </header>

      <div className="flex-1 overflow-y-auto px-2 pb-2">
        {sorted.length === 0 ? (
          <p className="text-slate-400 text-sm px-2 py-4 text-center">No items yet</p>
        ) : (
          <ul className="space-y-1">
            {sorted.map((item) => (
              <ListItemRow
                key={item.id}
                item={item}
                accentColor={list.color}
                onItemsChange={onItemsChange}
                onError={setError}
              />
            ))}
          </ul>
        )}
      </div>

      {error && <p className="text-red-500 text-xs px-4 pb-2">{error}</p>}

      {checkedCount > 0 && (
        <button
          onClick={handleClearCompleted}
          className="text-xs text-slate-400 hover:text-rose-500 px-4 py-2 text-left touch-manipulation"
        >
          Clear completed ({checkedCount})
        </button>
      )}

      <AddItemBar
        listId={list.id}
        familyId={familyId}
        accentColor={list.color}
        onItemsChange={onItemsChange}
        onError={setError}
      />
    </section>
  );
}
