import { requireFamilyContext } from "@/lib/family-context";
import { SCREENSAVER_BUCKET, SCREENSAVER_PHOTO_TYPES } from "@/lib/screensaver-photos";

export async function GET(_request: Request, { params }: { params: Promise<{ name: string }> }) {
  const { name } = await params;
  if (!/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(name)) return new Response(null, { status: 404 });

  const context = await requireFamilyContext().catch(() => null);
  if (!context) return new Response(null, { status: 401 });
  const { supabase, familyId } = context;
  const { data, error } = await supabase.storage.from(SCREENSAVER_BUCKET).download(`${familyId}/${name}`);
  if (error || !data || !SCREENSAVER_PHOTO_TYPES.includes(data.type)) {
    return new Response(null, { status: 404 });
  }
  return new Response(data.stream(), {
    headers: { "Content-Type": data.type, "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff" },
  });
}
