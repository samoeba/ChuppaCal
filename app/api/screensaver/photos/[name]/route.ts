import { requireFamilyContext } from "@/lib/family-context";
import { SCREENSAVER_BUCKET } from "@/lib/screensaver-photos";

export async function GET(_request: Request, { params }: { params: Promise<{ name: string }> }) {
  const { name } = await params;
  if (!/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(name)) return new Response(null, { status: 404 });

  const context = await requireFamilyContext().catch(() => null);
  if (!context) return new Response(null, { status: 401 });
  const { supabase, familyId } = context;
  // Keep the stable image URL: each new request gets a fresh storage link,
  // so an always-on slideshow never retains an expired signed URL.
  const { data, error } = await supabase.storage.from(SCREENSAVER_BUCKET)
    .createSignedUrl(`${familyId}/${name}`, 3600);
  if (error || !data?.signedUrl) {
    return new Response(null, { status: 404 });
  }
  // Only this small redirect passes through Vercel; Supabase serves the bytes.
  // Do not cache the redirect: membership is verified again on every request.
  return new Response(null, {
    status: 307,
    headers: { Location: data.signedUrl, "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff" },
  });
}
