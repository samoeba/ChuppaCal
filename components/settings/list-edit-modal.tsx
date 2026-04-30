"use client";

import { useState, useTransition } from "react";
import type { List } from "@/lib/types";
import { createList, renameList, updateListAppearance } from "@/app/actions/lists";

const LIST_EMOJIS = [
  "🛒", "✏️", "🛍️", "📝", "🍳", "🧺", "🚗", "🎁",
  "📚", "🧸", "🎨", "🏠", "🏥", "✈️", "🎯", "💊",
];

const LIST_COLORS = [
  "#22c55e", "#6366f1", "#f59e0b", "#ec4899",
  "#3b82f6", "#a78bfa", "#ff6b6b", "#4ecdc4",
];

interface Props {
  list?: List;
  onSaved: (list: List | null) => void;
  onClose: () => void;
}

export default function ListEditModal({ list, onSaved, onClose }: Props) {
  const [name, setName] = useState(list?.name ?? "");
  const [emoji, setEmoji] = useState(list?.emoji ?? LIST_EMOJIS[0]);
  const [color, setColor] = useState(list?.color ?? LIST_COLORS[0]);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function handleSave() {
    const trimmed = name.trim();
    if (!trimmed) return;
    setError(null);
    startTransition(async () => {
      try {
        if (list) {
          const tasks: Promise<void>[] = [];
          if (trimmed !== list.name) tasks.push(renameList(list.id, trimmed));
          if (emoji !== list.emoji || color !== list.color) {
            tasks.push(updateListAppearance(list.id, emoji, color));
          }
          await Promise.all(tasks);
          onSaved({ ...list, name: trimmed, emoji, color });
        } else {
          const created = await createList(trimmed, emoji, color);
          onSaved(created);
        }
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to save");
      }
    });
  }

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 bg-black/50 flex items-end sm:items-center justify-center z-50 p-4"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="bg-white rounded-2xl p-6 w-full max-w-sm"
      >
        <h3 className="text-lg font-semibold text-slate-900 mb-4">
          {list ? "Edit List" : "New List"}
        </h3>

        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleSave()}
          placeholder="List name"
          autoFocus
          className="w-full border border-slate-200 rounded-xl px-4 py-3 text-lg mb-4 focus:outline-none focus:ring-2 focus:ring-rose-500"
        />

        <p className="text-sm text-slate-400 mb-2">Emoji</p>
        <div className="flex flex-wrap gap-2 mb-4">
          {LIST_EMOJIS.map((e) => (
            <button
              key={e}
              onClick={() => setEmoji(e)}
              className={`w-10 h-10 rounded-lg text-xl flex items-center justify-center touch-manipulation ${
                emoji === e ? "bg-slate-200 ring-2 ring-rose-500" : "bg-slate-50 active:bg-slate-100"
              }`}
            >
              {e}
            </button>
          ))}
        </div>

        <p className="text-sm text-slate-400 mb-2">Color</p>
        <div className="flex gap-2 mb-6 flex-wrap">
          {LIST_COLORS.map((c) => (
            <button
              key={c}
              onClick={() => setColor(c)}
              className={`w-9 h-9 rounded-full touch-manipulation ${
                color === c ? "ring-2 ring-slate-900 ring-offset-2 scale-110" : ""
              }`}
              style={{ backgroundColor: c }}
            />
          ))}
        </div>

        {error && <p className="text-red-500 text-sm mb-3">{error}</p>}

        <div className="flex gap-2">
          <button
            onClick={onClose}
            disabled={pending}
            className="flex-1 bg-slate-100 text-slate-700 py-3 rounded-xl font-semibold touch-manipulation"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={!name.trim() || pending}
            className="flex-1 bg-rose-500 text-white py-3 rounded-xl font-semibold touch-manipulation disabled:opacity-50"
          >
            {pending ? "Saving…" : list ? "Save" : "Add"}
          </button>
        </div>
      </div>
    </div>
  );
}
