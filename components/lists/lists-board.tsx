// components/lists/lists-board.tsx
"use client";

import { useState } from "react";
import type { List, ListItem } from "@/lib/types";
import ListColumn from "./list-column";

interface Props {
  lists: List[];
  items: ListItem[];
  familyId: string;
}

export default function ListsBoard({ lists, items, familyId }: Props) {
  const [optItems, setOptItems] = useState<ListItem[]>(items);

  function applyChange(updater: (prev: ListItem[]) => ListItem[]) {
    setOptItems((prev) => updater(prev));
  }

  if (lists.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-center px-6">
        <p className="text-slate-400">No lists yet.</p>
        <p className="text-slate-400 text-sm mt-1">
          Add one in Settings → Lists.
        </p>
      </div>
    );
  }

  return (
    <div className="h-full overflow-x-auto">
      <div className="flex gap-4 p-4 min-w-max">
        {lists.map((list) => (
          <ListColumn
            key={list.id}
            list={list}
            items={optItems.filter((i) => i.list_id === list.id)}
            familyId={familyId}
            onItemsChange={applyChange}
          />
        ))}
      </div>
    </div>
  );
}
