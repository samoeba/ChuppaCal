// components/lists/list-item-row.tsx
"use client";

import { useRef, useState, useTransition } from "react";
import type { ListItem } from "@/lib/types";
import { toggleItem, editItem, deleteItem } from "@/app/actions/lists";

interface Props {
  item: ListItem;
  accentColor: string;
  onItemsChange: (updater: (prev: ListItem[]) => ListItem[]) => void;
  onError: (msg: string | null) => void;
}

const LONG_PRESS_MS = 500;

export default function ListItemRow({ item, accentColor, onItemsChange, onError }: Props) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(item.text);
  const [, startTransition] = useTransition();
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const longPressFired = useRef(false);

  function handleToggle() {
    const nextChecked = !item.checked;
    onItemsChange((prev) =>
      prev.map((i) => (i.id === item.id ? { ...i, checked: nextChecked } : i))
    );
    startTransition(async () => {
      try {
        await toggleItem(item.id, nextChecked);
      } catch (e) {
        onItemsChange((prev) =>
          prev.map((i) => (i.id === item.id ? { ...i, checked: !nextChecked } : i))
        );
        onError(e instanceof Error ? e.message : "Failed to toggle");
      }
    });
  }

  function startEdit() {
    if (item.checked) return;
    setDraft(item.text);
    setEditing(true);
  }

  function cancelEdit() {
    setEditing(false);
    setDraft(item.text);
  }

  function saveEdit() {
    const trimmed = draft.trim();
    setEditing(false);
    if (!trimmed || trimmed === item.text) {
      setDraft(item.text);
      return;
    }
    onItemsChange((prev) =>
      prev.map((i) => (i.id === item.id ? { ...i, text: trimmed } : i))
    );
    startTransition(async () => {
      try {
        await editItem(item.id, trimmed);
      } catch (e) {
        onItemsChange((prev) =>
          prev.map((i) => (i.id === item.id ? { ...i, text: item.text } : i))
        );
        onError(e instanceof Error ? e.message : "Failed to edit");
      }
    });
  }

  function pressStart() {
    longPressFired.current = false;
    longPressTimer.current = setTimeout(() => {
      longPressFired.current = true;
      handleLongPress();
    }, LONG_PRESS_MS);
  }

  function pressEnd() {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
  }

  function handleLongPress() {
    if (!confirm(`Delete "${item.text}"?`)) return;
    onItemsChange((prev) => prev.filter((i) => i.id !== item.id));
    startTransition(async () => {
      try {
        await deleteItem(item.id);
      } catch (e) {
        onError(e instanceof Error ? e.message : "Failed to delete");
      }
    });
  }

  return (
    <li className="flex items-center gap-3 px-2 py-2 rounded-xl transition-all">
      <button
        onClick={handleToggle}
        aria-label={item.checked ? "Uncheck" : "Check"}
        className={`w-6 h-6 rounded-md border-2 flex items-center justify-center flex-shrink-0 touch-manipulation transition-colors ${
          item.checked ? "border-transparent text-white" : "border-slate-300 bg-white"
        }`}
        style={item.checked ? { backgroundColor: accentColor } : undefined}
      >
        {item.checked && <span className="text-xs leading-none">✓</span>}
      </button>

      {editing ? (
        <input
          type="text"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={saveEdit}
          onKeyDown={(e) => {
            if (e.key === "Enter") saveEdit();
            if (e.key === "Escape") cancelEdit();
          }}
          autoFocus
          className="flex-1 bg-transparent border-b border-slate-300 focus:border-slate-600 focus:outline-none py-1"
        />
      ) : (
        <span
          onClick={() => {
            if (!longPressFired.current) startEdit();
          }}
          onMouseDown={pressStart}
          onMouseUp={pressEnd}
          onMouseLeave={pressEnd}
          onTouchStart={pressStart}
          onTouchEnd={pressEnd}
          onTouchCancel={pressEnd}
          className={`flex-1 select-none cursor-text ${
            item.checked ? "line-through text-slate-400" : "text-slate-800"
          }`}
        >
          {item.text}
        </span>
      )}
    </li>
  );
}
