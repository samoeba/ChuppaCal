// app/(main)/lists/page.tsx
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import ListsBoard from "@/components/lists/lists-board";
import { readAllRows } from "@/lib/pagination";
import type { List, ListItem } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function ListsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: selfMember } = await supabase
    .from("family_members")
    .select("family_id")
    .eq("user_id", user.id)
    .single();
  if (!selfMember) redirect("/onboarding");

  const familyId = selfMember.family_id;

  const lists = await readAllRows<List>((from, to) => supabase
    .from("lists")
    .select("*")
    .eq("family_id", familyId)
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: true }).order("id").range(from, to));

  const listIds = lists.map((l) => l.id);
  const items = listIds.length
    ? await readAllRows<ListItem>((from, to) => supabase
        .from("list_items")
        .select("*")
        .in("list_id", listIds)
        .order("checked", { ascending: true })
        .order("sort_order", { ascending: true })
        .order("created_at", { ascending: true }).order("id").range(from, to))
    : [];

  return (
    <ListsBoard
      lists={(lists ?? []) as List[]}
      items={(items ?? []) as ListItem[]}
      familyId={familyId}
    />
  );
}
