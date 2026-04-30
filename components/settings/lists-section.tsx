"use client";

import { useState, useTransition } from "react";
import type { List } from "@/lib/types";
import ListEditModal from "./list-edit-modal";
import { deleteList } from "@/app/actions/lists";

interface Props {
  initialLists: List[];
}

export default function ListsSection({ initialLists }: Props) {
  const [lists, setLists] = useState<List[]>(initialLists);
  const [editing, setEditing] = useState<List | null>(null);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  function handleSaved(saved: List | null) {
    if (!saved) return;
    setLists((prev) => {
      const idx = prev.findIndex((l) => l.id === saved.id);
      if (idx >= 0) {
        const next = [...prev];
        next[idx] = saved;
        return next;
      }
      return [...prev, saved].sort((a, b) => a.sort_order - b.sort_order);
    });
    setEditing(null);
    setCreating(false);
  }

  function handleDelete(list: List) {
    if (!confirm(`Delete "${list.name}" and all its items? This cannot be undone.`)) return;
    setLists((prev) => prev.filter((l) => l.id !== list.id));
    startTransition(async () => {
      try {
        await deleteList(list.id);
      } catch (e) {
        setLists((prev) => [...prev, list].sort((a, b) => a.sort_order - b.sort_order));
        setError(e instanceof Error ? e.message : "Failed to delete");
      }
    });
  }

  return (
    <section className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100 mb-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-slate-900">Lists</h2>
        <button
          onClick={() => setCreating(true)}
          className="bg-rose-500 text-white px-4 py-2 rounded-xl text-sm font-semibold active:bg-rose-600 transition-colors touch-manipulation"
        >
          + New List
        </button>
      </div>

      {error && <p className="text-red-500 text-sm mb-3">{error}</p>}

      <div className="space-y-3">
        {lists.length === 0 && (
          <p className="text-sm text-slate-400">No lists yet.</p>
        )}
        {lists.map((list) => (
          <div
            key={list.id}
            className="flex items-center gap-3 p-3 rounded-xl border border-slate-100 hover:bg-slate-50"
          >
            <div className="text-2xl">{list.emoji}</div>
            <div className="flex-1 font-semibold text-slate-900">{list.name}</div>
            <div
              className="w-6 h-6 rounded-full flex-shrink-0"
              style={{ backgroundColor: list.color }}
            />
            <button
              onClick={() => setEditing(list)}
              className="text-slate-400 hover:text-slate-600 p-2 touch-manipulation"
              aria-label={`Edit ${list.name}`}
            >
              ✏️
            </button>
            <button
              onClick={() => handleDelete(list)}
              className="text-slate-400 hover:text-rose-500 p-2 touch-manipulation"
              aria-label={`Delete ${list.name}`}
            >
              🗑️
            </button>
          </div>
        ))}
      </div>

      {(creating || editing) && (
        <ListEditModal
          list={editing ?? undefined}
          onSaved={handleSaved}
          onClose={() => {
            setCreating(false);
            setEditing(null);
          }}
        />
      )}
    </section>
  );
}
