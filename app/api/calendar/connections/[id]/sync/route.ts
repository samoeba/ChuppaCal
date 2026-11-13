import { NextResponse } from "next/server";
import { requireFamilyContext, requireFamilyRecord } from "@/lib/family-context";
import { createServiceClient } from "@/lib/supabase/server";
import { syncGoogleConnection } from "@/lib/google/sync";

export const maxDuration = 60;
export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const context = await requireFamilyContext();
    await requireFamilyRecord(context, "calendar_connections", id);
    const result = await syncGoogleConnection(createServiceClient(), id);
    return NextResponse.json(result, { status: result.error ? 502 : result.skipped ? 429 : 200 });
  } catch { return NextResponse.json({ error: "Could not sync this calendar. Sign in and try again." }, { status: 400 }); }
}
