import { createClient } from "npm:@supabase/supabase-js@2";

Deno.serve(async (req) => {
  const auth = req.headers.get("x-cron-secret");
  if (auth !== Deno.env.get("CRON_SECRET")) {
    return new Response("forbidden", { status: 403 });
  }
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );
  const { error } = await supabase.auth.admin.updateUserById(
    "8503e184-3c98-4cb8-9cf0-e32ae6bc0096",
    { password: "Claudia@China2026" },
  );
  return new Response(JSON.stringify({ ok: !error, error: error?.message }), {
    headers: { "Content-Type": "application/json" },
  });
});
