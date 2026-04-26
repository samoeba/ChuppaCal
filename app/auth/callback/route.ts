import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/";

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);

    if (!error) {
      // Check if user belongs to a family
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (user) {
        const { data: member } = await supabase
          .from("family_members")
          .select("id, family_id")
          .eq("user_id", user.id)
          .single();

        if (!member) {
          // New user — check for invite token
          const invite = searchParams.get("invite");
          if (invite) {
            return NextResponse.redirect(`${origin}/onboarding?invite=${invite}`);
          }
          // No family yet → onboarding
          return NextResponse.redirect(`${origin}/onboarding`);
        }
      }

      // Existing family member → go to calendar
      return NextResponse.redirect(`${origin}${next}`);
    }
  }

  // Auth error → back to login
  return NextResponse.redirect(`${origin}/login?error=auth_failed`);
}
