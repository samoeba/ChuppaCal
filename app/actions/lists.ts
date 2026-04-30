"use server";

import { revalidatePath } from "next/cache";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import type { List, ListItem } from "@/lib/types";

const DEFAULT_LISTS = [
  { name: "Grocery", emoji: "🛒", color: "#22c55e", sort_order: 0 },
  { name: "To-Do", emoji: "✏️", color: "#6366f1", sort_order: 1 },
  { name: "Shopping", emoji: "🛍️", color: "#f59e0b", sort_order: 2 },
];

async function getFamilyId(): Promise<string> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");
  const { data: member, error } = await supabase
    .from("family_members")
    .select("family_id")
    .eq("user_id", user.id)
    .single();
  if (error || !member) throw new Error("No family for user");
  return member.family_id;
}

// One-time backfill for the pre-Phase-7 family.
// Idempotent: re-checks emptiness on the server before inserting.
export async function seedDefaultsIfEmpty(): Promise<void> {
  const familyId = await getFamilyId();
  const admin = createServiceClient();
  const { count, error: countError } = await admin
    .from("lists")
    .select("id", { count: "exact", head: true })
    .eq("family_id", familyId);
  if (countError) throw new Error(countError.message);
  if ((count ?? 0) > 0) return;
  const rows = DEFAULT_LISTS.map((d) => ({ family_id: familyId, ...d }));
  const { error } = await admin.from("lists").insert(rows);
  if (error) throw new Error(error.message);
  revalidatePath("/lists");
}

export async function addItem(listId: string, text: string): Promise<ListItem> {
  const trimmed = text.trim();
  if (!trimmed) throw new Error("text is required");
  const familyId = await getFamilyId();
  const supabase = await createClient();
  const { data: maxRow } = await supabase
    .from("list_items")
    .select("sort_order")
    .eq("list_id", listId)
    .order("sort_order", { ascending: false })
    .limit(1)
    .maybeSingle();
  const nextOrder = (maxRow?.sort_order ?? -1) + 1;
  const { data, error } = await supabase
    .from("list_items")
    .insert({
      list_id: listId,
      family_id: familyId,
      text: trimmed,
      checked: false,
      sort_order: nextOrder,
    })
    .select()
    .single();
  if (error || !data) throw new Error(error?.message ?? "insert failed");
  revalidatePath("/lists");
  return data as ListItem;
}

export async function toggleItem(itemId: string, checked: boolean): Promise<void> {
  const supabase = await createClient();
  const { error } = await supabase
    .from("list_items")
    .update({ checked })
    .eq("id", itemId);
  if (error) throw new Error(error.message);
  revalidatePath("/lists");
}

export async function editItem(itemId: string, text: string): Promise<void> {
  const trimmed = text.trim();
  if (!trimmed) throw new Error("text is required");
  const supabase = await createClient();
  const { error } = await supabase
    .from("list_items")
    .update({ text: trimmed })
    .eq("id", itemId);
  if (error) throw new Error(error.message);
  revalidatePath("/lists");
}

export async function deleteItem(itemId: string): Promise<void> {
  const supabase = await createClient();
  const { error } = await supabase.from("list_items").delete().eq("id", itemId);
  if (error) throw new Error(error.message);
  revalidatePath("/lists");
}

export async function clearCompleted(listId: string): Promise<void> {
  const supabase = await createClient();
  const { error } = await supabase
    .from("list_items")
    .delete()
    .eq("list_id", listId)
    .eq("checked", true);
  if (error) throw new Error(error.message);
  revalidatePath("/lists");
}

export async function createList(
  name: string,
  emoji: string,
  color: string
): Promise<List> {
  const trimmed = name.trim();
  if (!trimmed) throw new Error("name is required");
  const familyId = await getFamilyId();
  const supabase = await createClient();
  const { data: maxRow } = await supabase
    .from("lists")
    .select("sort_order")
    .eq("family_id", familyId)
    .order("sort_order", { ascending: false })
    .limit(1)
    .maybeSingle();
  const nextOrder = (maxRow?.sort_order ?? -1) + 1;
  const { data, error } = await supabase
    .from("lists")
    .insert({
      family_id: familyId,
      name: trimmed,
      emoji,
      color,
      sort_order: nextOrder,
    })
    .select()
    .single();
  if (error || !data) throw new Error(error?.message ?? "insert failed");
  revalidatePath("/lists");
  revalidatePath("/settings");
  return data as List;
}

export async function renameList(listId: string, name: string): Promise<void> {
  const trimmed = name.trim();
  if (!trimmed) throw new Error("name is required");
  const supabase = await createClient();
  const { error } = await supabase
    .from("lists")
    .update({ name: trimmed })
    .eq("id", listId);
  if (error) throw new Error(error.message);
  revalidatePath("/lists");
  revalidatePath("/settings");
}

export async function updateListAppearance(
  listId: string,
  emoji: string,
  color: string
): Promise<void> {
  const supabase = await createClient();
  const { error } = await supabase
    .from("lists")
    .update({ emoji, color })
    .eq("id", listId);
  if (error) throw new Error(error.message);
  revalidatePath("/lists");
  revalidatePath("/settings");
}

export async function deleteList(listId: string): Promise<void> {
  const supabase = await createClient();
  const { error } = await supabase.from("lists").delete().eq("id", listId);
  if (error) throw new Error(error.message);
  revalidatePath("/lists");
  revalidatePath("/settings");
}
