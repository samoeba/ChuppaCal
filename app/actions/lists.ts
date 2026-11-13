"use server";

import { revalidatePath } from "next/cache";
import { requireFamilyContext, requireFamilyRecord } from "@/lib/family-context";
import { requireBoolean, requireColor, requireId, requireText } from "@/lib/validation";
import type { List, ListItem } from "@/lib/types";

// The database serializes this backfill with onboarding and other seed requests.
export async function seedDefaultsIfEmpty(): Promise<void> {
  const { supabase } = await requireFamilyContext();
  const { error } = await supabase.rpc("cc_seed_lists");
  if (error) throw new Error(error.message);
  revalidatePath("/lists");
}

export async function addItem(listId: string, text: string): Promise<ListItem> {
  const trimmed = requireText(text, "Item text", 500);
  const context = await requireFamilyContext();
  const { supabase, familyId } = context;
  await requireFamilyRecord(context, "lists", listId);
  const { data: maxRow, error: maxError } = await supabase
    .from("list_items")
    .select("sort_order")
    .eq("list_id", listId)
    .order("sort_order", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (maxError) throw new Error(maxError.message);
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
  const { supabase, familyId } = await requireFamilyContext();
  const { error } = await supabase
    .from("list_items")
    .update({ checked: requireBoolean(checked) })
    .eq("id", requireId(itemId)).eq("family_id", familyId);
  if (error) throw new Error(error.message);
  revalidatePath("/lists");
}

export async function editItem(itemId: string, text: string): Promise<void> {
  const trimmed = requireText(text, "Item text", 500);
  const { supabase, familyId } = await requireFamilyContext();
  const { error } = await supabase
    .from("list_items")
    .update({ text: trimmed })
    .eq("id", requireId(itemId)).eq("family_id", familyId);
  if (error) throw new Error(error.message);
  revalidatePath("/lists");
}

export async function deleteItem(itemId: string): Promise<void> {
  const { supabase, familyId } = await requireFamilyContext();
  const { error } = await supabase.from("list_items").delete().eq("id", requireId(itemId)).eq("family_id", familyId);
  if (error) throw new Error(error.message);
  revalidatePath("/lists");
}

export async function clearCompleted(listId: string): Promise<void> {
  const { supabase, familyId } = await requireFamilyContext();
  const { error } = await supabase
    .from("list_items")
    .delete()
    .eq("list_id", requireId(listId)).eq("family_id", familyId)
    .eq("checked", true);
  if (error) throw new Error(error.message);
  revalidatePath("/lists");
}

export async function createList(
  name: string,
  emoji: string,
  color: string
): Promise<List> {
  const trimmed = requireText(name, "List name");
  requireColor(color);
  requireText(emoji, "Emoji", 32);
  const { supabase, familyId } = await requireFamilyContext();
  const { data: maxRow, error: maxError } = await supabase
    .from("lists")
    .select("sort_order")
    .eq("family_id", familyId)
    .order("sort_order", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (maxError) throw new Error(maxError.message);
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
  const trimmed = requireText(name, "List name");
  const { supabase, familyId } = await requireFamilyContext();
  const { error } = await supabase
    .from("lists")
    .update({ name: trimmed })
    .eq("id", requireId(listId)).eq("family_id", familyId);
  if (error) throw new Error(error.message);
  revalidatePath("/lists");
  revalidatePath("/settings");
}

export async function updateListAppearance(
  listId: string,
  emoji: string,
  color: string
): Promise<void> {
  const { supabase, familyId } = await requireFamilyContext();
  const { error } = await supabase
    .from("lists")
    .update({ emoji: requireText(emoji, "Emoji", 32), color: requireColor(color) })
    .eq("id", requireId(listId)).eq("family_id", familyId);
  if (error) throw new Error(error.message);
  revalidatePath("/lists");
  revalidatePath("/settings");
}

export async function deleteList(listId: string): Promise<void> {
  const { supabase, familyId } = await requireFamilyContext();
  const { error } = await supabase.from("lists").delete().eq("id", requireId(listId)).eq("family_id", familyId);
  if (error) throw new Error(error.message);
  revalidatePath("/lists");
  revalidatePath("/settings");
}
