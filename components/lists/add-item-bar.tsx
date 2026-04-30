// components/lists/add-item-bar.tsx
"use client";

import { useRef, useState, useTransition } from "react";
import type { ListItem } from "@/lib/types";
import { addItem } from "@/app/actions/lists";

interface Props {
  listId: string;
  familyId: string;
  accentColor: string;
  onItemsChange: (updater: (prev: ListItem[]) => ListItem[]) => void;
  onError: (msg: string | null) => void;
}

export default function AddItemBar({ listId, familyId, accentColor, onItemsChange, onError }: Props) {
  const [draft, setDraft] = useState("");
  const [, startTransition] = useTransition();
  const inputRef = useRef<HTMLInputElement>(null);

  function submit() {
    const trimmed = draft.trim();
    if (!trimmed) return;

    const tempId = `temp-${crypto.randomUUID()}`;
    const optimistic: ListItem = {
      id: tempId,
      list_id: listId,
      family_id: familyId,
      text: trimmed,
      checked: false,
      sort_order: Number.MAX_SAFE_INTEGER,
      created_at: new Date().toISOString(),
    };
    onItemsChange((prev) => [...prev, optimistic]);
    setDraft("");
    inputRef.current?.focus();

    startTransition(async () => {
      try {
        const saved = await addItem(listId, trimmed);
        onItemsChange((prev) => prev.map((i) => (i.id === tempId ? saved : i)));
      } catch (e) {
        onItemsChange((prev) => prev.filter((i) => i.id !== tempId));
        onError(e instanceof Error ? e.message : "Failed to add");
      }
    });
  }

  return (
    <div className="border-t border-slate-100 p-3 flex gap-2">
      <input
        ref={inputRef}
        type="text"
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => e.key === "Enter" && submit()}
        placeholder="+ Add item"
        className="flex-1 bg-slate-50 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2"
        style={{ ['--tw-ring-color' as string]: accentColor }}
      />
      <button
        onClick={submit}
        disabled={!draft.trim()}
        className="text-white px-3 py-2 rounded-xl text-sm font-semibold touch-manipulation disabled:opacity-40"
        style={{ backgroundColor: accentColor }}
      >
        Add
      </button>
    </div>
  );
}
