// app/(main)/lists/page.tsx
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import ListsBoard from "@/components/lists/lists-board";
import { seedDefaultsIfEmpty } from "@/app/actions/lists";
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

  let { data: lists } = await supabase
    .from("lists")
    .select("*")
    .eq("family_id", familyId)
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: true });

  // One-time backfill for pre-Phase-7 family.
  if (!lists || lists.length === 0) {
    await seedDefaultsIfEmpty();
    const refetch = await supabase
      .from("lists")
      .select("*")
      .eq("family_id", familyId)
      .order("sort_order", { ascending: true })
      .order("created_at", { ascending: true });
    lists = refetch.data ?? [];
  }

  const listIds = lists.map((l) => l.id);
  const { data: items } = listIds.length
    ? await supabase
        .from("list_items")
        .select("*")
        .in("list_id", listIds)
        .order("checked", { ascending: true })
        .order("sort_order", { ascending: true })
        .order("created_at", { ascending: true })
    : { data: [] };

  return (
    <ListsBoard
      lists={(lists ?? []) as List[]}
      items={(items ?? []) as ListItem[]}
      familyId={familyId}
    />
  );
}
