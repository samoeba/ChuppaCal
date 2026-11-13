// components/lists/list-item-row.tsx
"use client";

import { useState, useTransition } from "react";
import type { ListItem } from "@/lib/types";
import { toggleItem, editItem, deleteItem } from "@/app/actions/lists";

interface Props {
  item: ListItem;
  accentColor: string;
  onItemsChange: (updater: (prev: ListItem[]) => ListItem[]) => void;
  onError: (msg: string | null) => void;
}

export default function ListItemRow({ item, accentColor, onItemsChange, onError }: Props) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(item.text);
  const [pending, startTransition] = useTransition();
  const unavailable = pending || item.id.startsWith("temp-");

  function handleToggle() {
    if (unavailable) return;
    onError(null);
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

  function handleDelete() {
    if (!confirm(`Delete "${item.text}"?`)) return;
    onError(null);
    onItemsChange((prev) => prev.filter((i) => i.id !== item.id));
    startTransition(async () => {
      try {
        await deleteItem(item.id);
      } catch (e) {
        onItemsChange((prev) => prev.some((current) => current.id === item.id) ? prev : [...prev, item]);
        onError(e instanceof Error ? e.message : "Failed to delete");
      }
    });
  }

  return (
    <li aria-busy={pending} className="flex items-center gap-2 px-2 py-2 rounded-xl transition-all">
      <button
        onClick={handleToggle}
        disabled={unavailable}
        aria-label={`${item.checked ? "Uncheck" : "Check"} ${item.text}`}
        aria-pressed={item.checked}
        className={`w-11 h-11 rounded-md border-2 flex items-center justify-center flex-shrink-0 touch-manipulation transition-colors ${
          item.checked ? "border-transparent text-white" : "border-slate-300 bg-white"
        }`}
        style={item.checked ? { backgroundColor: accentColor } : undefined}
      >
        {item.checked && <span className="text-xs leading-none">✓</span>}
      </button>

      {editing ? (
        <input
          type="text"
          aria-label="Item text"
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
        <button
          type="button"
          onClick={startEdit}
          disabled={unavailable || item.checked}
          aria-label={`Edit ${item.text}`}
          className={`flex-1 min-w-0 min-h-11 text-left break-words cursor-text ${
            item.checked ? "line-through text-slate-400" : "text-slate-800"
          }`}
        >
          {item.text}
        </button>
      )}
      <button type="button" onClick={handleDelete} disabled={unavailable} aria-label={`Delete ${item.text}`} className="w-11 h-11 shrink-0 rounded-lg text-slate-400 hover:text-rose-600 text-xl">×</button>
    </li>
  );
}
