// supabase/functions/meu-perfil-reveal/index.ts
// Step-up de revelação de CPF/RG/Email do próprio usuário.
// - Exige JWT do usuário autenticado.
// - Reautentica com email do perfil + senha enviada.
// - Aplica rate limit (5 falhas em 10 min -> bloqueio de 15 min).
// - Em sucesso, cria registro em profile_reveal_grants (TTL 30s) e retorna o valor.
// - Toda tentativa (sucesso/falha) é registrada em profile_reveal_attempts.
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const ALLOWED_FIELDS = ["cpf", "rg", "email"] as const;
type Field = (typeof ALLOWED_FIELDS)[number];

const TTL_SECONDS = 30;
const RATE_WINDOW_MIN = 10;
const MAX_FAILURES = 5;
const LOCK_MINUTES = 15;

function jsonResponse(body: unknown, status = 200, extra: Record<string, string> = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json", ...extra },
  });
}

function clientIp(req: Request): string | null {
  const xff = req.headers.get("x-forwarded-for");
  if (xff) return xff.split(",")[0].trim();
  return req.headers.get("cf-connecting-ip") || req.headers.get("x-real-ip");
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return jsonResponse({ error: "Method not allowed" }, 405);

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
  const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;

  // ----- 1) JWT do usuário ---------------------------------------------------
  const authHeader = req.headers.get("Authorization") || "";
  const jwt = authHeader.replace(/^Bearer\s+/i, "").trim();
  if (!jwt) return jsonResponse({ error: "Unauthorized" }, 401);

  const supabaseUserClient = createClient(SUPABASE_URL, ANON_KEY, {
    global: { headers: { Authorization: `Bearer ${jwt}` } },
  });
  const { data: userData, error: userErr } = await supabaseUserClient.auth.getUser();
  if (userErr || !userData?.user) return jsonResponse({ error: "Unauthorized" }, 401);
  const userId = userData.user.id;

  // ----- 2) Body validation --------------------------------------------------
  let body: { field?: string; password?: string };
  try {
    body = await req.json();
  } catch {
    return jsonResponse({ error: "Invalid JSON" }, 400);
  }
  const field = String(body.field || "").toLowerCase() as Field;
  const password = typeof body.password === "string" ? body.password : "";
  if (!ALLOWED_FIELDS.includes(field)) {
    return jsonResponse({ error: "Campo inválido" }, 400);
  }
  if (!password || password.length < 1 || password.length > 200) {
    return jsonResponse({ error: "Senha inválida" }, 400);
  }

  const admin = createClient(SUPABASE_URL, SERVICE_ROLE);
  const ip = clientIp(req);
  const userAgent = req.headers.get("user-agent") || null;

  // ----- 3) Rate limit / lockout --------------------------------------------
  const windowStart = new Date(Date.now() - RATE_WINDOW_MIN * 60_000).toISOString();
  const { data: recent, error: rlErr } = await admin
    .from("profile_reveal_attempts")
    .select("success, attempted_at")
    .eq("user_id", userId)
    .gte("attempted_at", windowStart)
    .order("attempted_at", { ascending: false })
    .limit(20);
  if (rlErr) {
    return jsonResponse({ error: "Falha de auditoria" }, 500);
  }

  const failures = (recent || []).filter((r) => !r.success);
  if (failures.length >= MAX_FAILURES) {
    const lastFailureAt = new Date(failures[0].attempted_at).getTime();
    const lockUntil = lastFailureAt + LOCK_MINUTES * 60_000;
    if (Date.now() < lockUntil) {
      const retryAfterSec = Math.ceil((lockUntil - Date.now()) / 1000);
      return jsonResponse(
        {
          error: "rate_limited",
          message: `Muitas tentativas. Tente novamente em ${Math.ceil(retryAfterSec / 60)} min.`,
          retry_after_seconds: retryAfterSec,
        },
        429,
        { "Retry-After": String(retryAfterSec) },
      );
    }
  }

  // ----- 4) Pega email do perfil para reautenticação ------------------------
  const { data: profile, error: profErr } = await admin
    .from("profiles")
    .select("email, cpf, rg")
    .eq("id", userId)
    .maybeSingle();
  if (profErr || !profile?.email) {
    return jsonResponse({ error: "Perfil não encontrado" }, 404);
  }

  // ----- 5) Reautenticação com senha ----------------------------------------
  const reauthClient = createClient(SUPABASE_URL, ANON_KEY);
  const { error: signErr } = await reauthClient.auth.signInWithPassword({
    email: profile.email,
    password,
  });
  if (signErr) {
    await admin.from("profile_reveal_attempts").insert({
      user_id: userId,
      success: false,
      ip,
    });
    return jsonResponse({ error: "Senha incorreta" }, 401);
  }

  // ----- 6) Sucesso: registra tentativa positiva, grant e retorna valor -----
  await admin.from("profile_reveal_attempts").insert({
    user_id: userId,
    success: true,
    ip,
  });

  const expiresAt = new Date(Date.now() + TTL_SECONDS * 1000).toISOString();
  const { data: grant, error: grantErr } = await admin
    .from("profile_reveal_grants")
    .insert({
      user_id: userId,
      field,
      expires_at: expiresAt,
      ip,
      user_agent: userAgent,
    })
    .select("id, granted_at, expires_at")
    .single();
  if (grantErr || !grant) {
    return jsonResponse({ error: "Falha ao registrar concessão" }, 500);
  }

  // valor a retornar
  let value: string | null = null;
  if (field === "cpf") value = profile.cpf ?? null;
  if (field === "rg") value = profile.rg ?? null;
  if (field === "email") value = profile.email ?? null;

  return jsonResponse({
    grant_id: grant.id,
    field,
    value,
    granted_at: grant.granted_at,
    expires_at: grant.expires_at,
    ttl_seconds: TTL_SECONDS,
  });
});
