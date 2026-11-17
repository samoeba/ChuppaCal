import { requireFamilyContext } from "@/lib/family-context";
import { requireId } from "@/lib/validation";

export async function GET(_request: Request, { params }: { params: Promise<{ source: string; id: string }> }) {
  const { source, id } = await params;
  if (!["recipe", "meal"].includes(source)) return new Response(null, { status: 404 });
  try { requireId(id); } catch { return new Response(null, { status: 404 }); }
  const context = await requireFamilyContext().catch(() => null);
  if (!context) return new Response(null, { status: 401 });
  const { supabase, familyId } = context;
  const { data, error } = await supabase.from(source === "recipe" ? "meal_recipes" : "meal_plans")
    .select("instructions_html").eq("id", id).eq("family_id", familyId).single();
  if (error || !data?.instructions_html) return new Response(null, { status: 404 });
  return Response.json({ html: data.instructions_html }, {
    headers: { "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff" },
  });
}
