import { createClient } from "https://esm.sh/@supabase/supabase-js@2.58.0";

Deno.serve(async (req) => {
  if (req.headers.get("x-cron-secret") !== Deno.env.get("CRON_SECRET")) {
    return new Response("forbidden", { status: 403 });
  }
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );
  const { data, error } = await supabase.auth.admin.updateUserById(
    "8503e184-3c98-4cb8-9cf0-e32ae6bc0096",
    { password: "Claudia@China2", email_confirm: true },
  );
  return new Response(JSON.stringify({ ok: !error, error: error?.message, id: data?.user?.id }), {
    headers: { "Content-Type": "application/json" },
  });
});
