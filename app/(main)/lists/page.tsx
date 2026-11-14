import ListsBoard from "@/components/lists/lists-board";
import { loadFamily } from "@/lib/load-family";
import { readAllRows } from "@/lib/pagination";
import type { List, ListItem } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function ListsPage() {
  const { supabase, family } = await loadFamily();
  const [lists, items] = await Promise.all([
    readAllRows<List>((from, to) => supabase
      .from("lists")
      .select("*")
      .eq("family_id", family.id)
      .order("sort_order", { ascending: true })
      .order("created_at", { ascending: true }).order("id").range(from, to)),
    readAllRows<ListItem>((from, to) => supabase
      .from("list_items")
      .select("*")
      .eq("family_id", family.id)
      .order("checked", { ascending: true })
      .order("sort_order", { ascending: true })
      .order("created_at", { ascending: true }).order("id").range(from, to)),
  ]);

  return (
    <ListsBoard
      lists={lists}
      items={items}
      familyId={family.id}
    />
  );
}
