import nextEnv from "@next/env";
import { createClient } from "@supabase/supabase-js";

nextEnv.loadEnvConfig(process.cwd(), false, { info() {}, error() {} });
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) throw new Error("Set Supabase URL and service-role key in .env.local before running this read-only check.");
const supabase = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
const [templates, completions, bucket] = await Promise.all([
  supabase.from("chore_templates").select("category,is_special").limit(0),
  supabase.from("chore_completions").select("category").limit(0),
  supabase.storage.getBucket("family-photos"),
]);
// Print metadata only, never credentials, names, photos or calendar contents.
console.log(JSON.stringify({
  migration005TemplateColumns: templates.error ? `unverified (${templates.error.code || "network/request failed"})` : "present",
  migration005CompletionColumn: completions.error ? `unverified (${completions.error.code || "network/request failed"})` : "present",
  familyPhotosPublic: bucket.error ? "unverified" : bucket.data.public,
  note: "Column presence does not verify constraints, indexes, RLS or backup health. No writes performed.",
}, null, 2));
if (templates.error || completions.error || bucket.error) process.exitCode = 1;
