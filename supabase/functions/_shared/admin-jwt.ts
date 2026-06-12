// _shared/admin-jwt.ts — JWT validation requiring 'admin' role.
// Used by endpoints previously gated only by N8N_API_KEY.
import { createClient } from "npm:@supabase/supabase-js@2";

export interface AdminAuthResult {
  ok: boolean;
  userId?: string;
  error?: string;
  status?: number;
}

export async function requireAdminJwt(req: Request): Promise<AdminAuthResult> {
  const authHeader = req.headers.get("Authorization") || req.headers.get("authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return { ok: false, error: "Missing Authorization header", status: 401 };
  }

  const token = authHeader.replace("Bearer ", "");
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  const { data: userData, error: userErr } = await supabase.auth.getUser(token);
  if (userErr || !userData?.user) {
    return { ok: false, error: "Invalid token", status: 401 };
  }

  const { data: roleRow } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", userData.user.id)
    .eq("role", "admin")
    .maybeSingle();

  if (!roleRow) {
    return { ok: false, error: "Admin role required", status: 403, userId: userData.user.id };
  }

  return { ok: true, userId: userData.user.id };
}
