import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  try {
    // Verify the user is authenticated
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const body = await request.json();
    const { familyName, parentName, color, avatarEmoji, pin, invite } = body;

    // Use service role client to bypass RLS for initial setup
    const admin = createServiceClient();

    if (invite) {
      // Join existing family
      const { data: family, error: familyError } = await admin
        .from("families")
        .select("id")
        .eq("id", invite)
        .single();

      if (familyError || !family) {
        return NextResponse.json({ error: "Invalid invite link" }, { status: 400 });
      }

      const { error: memberError } = await admin
        .from("family_members")
        .insert({
          family_id: family.id,
          user_id: user.id,
          name: parentName,
          color,
          avatar_emoji: avatarEmoji,
          role: "parent",
        });

      if (memberError) {
        return NextResponse.json({ error: memberError.message }, { status: 500 });
      }

      return NextResponse.json({ familyId: family.id });
    }

    // Create new family
    const { data: family, error: familyError } = await admin
      .from("families")
      .insert({
        name: familyName,
        settings: {
          sleep_start: "22:00",
          sleep_end: "06:00",
          weather_location: "",
          screensaver_timeout_minutes: 5,
          meal_slots: {
            breakfast: true,
            lunch: true,
            dinner: true,
            snack: false,
          },
          pin_hash: pin,
        },
      })
      .select()
      .single();

    if (familyError || !family) {
      return NextResponse.json(
        { error: familyError?.message || "Failed to create family" },
        { status: 500 }
      );
    }

    // Add first parent
    const { error: memberError } = await admin
      .from("family_members")
      .insert({
        family_id: family.id,
        user_id: user.id,
        name: parentName,
        color,
        avatar_emoji: avatarEmoji,
        role: "parent",
      });

    if (memberError) {
      // Rollback: delete the family
      await admin.from("families").delete().eq("id", family.id);
      return NextResponse.json({ error: memberError.message }, { status: 500 });
    }

    // Create default lists
    await admin.from("lists").insert([
      { family_id: family.id, name: "Grocery", emoji: "🛒", color: "#22c55e", sort_order: 0 },
      { family_id: family.id, name: "To-Do", emoji: "✏️", color: "#6366f1", sort_order: 1 },
      { family_id: family.id, name: "Shopping", emoji: "🛍️", color: "#f59e0b", sort_order: 2 },
    ]);

    return NextResponse.json({ familyId: family.id });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Server error" },
      { status: 500 }
    );
  }
}
