import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// Simple in-memory rate limiting (resets on cold start)
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT = 10; // max requests per window
const RATE_WINDOW_MS = 60_000; // 1 minute

function isRateLimited(ip: string): boolean {
  const now = Date.now();
  const entry = rateLimitMap.get(ip);
  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(ip, { count: 1, resetAt: now + RATE_WINDOW_MS });
    return false;
  }
  entry.count++;
  return entry.count > RATE_LIMIT;
}

function isValidCPF(cpf: string): boolean {
  const cleaned = cpf.replace(/\D/g, "");
  if (cleaned.length !== 11) return false;
  if (/^(\d)\1{10}$/.test(cleaned)) return false;

  let sum = 0;
  for (let i = 0; i < 9; i++) sum += parseInt(cleaned[i]) * (10 - i);
  let rest = (sum * 10) % 11;
  if (rest === 10) rest = 0;
  if (rest !== parseInt(cleaned[9])) return false;

  sum = 0;
  for (let i = 0; i < 10; i++) sum += parseInt(cleaned[i]) * (11 - i);
  rest = (sum * 10) % 11;
  if (rest === 10) rest = 0;
  if (rest !== parseInt(cleaned[10])) return false;

  return true;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Rate limiting
    const clientIP =
      req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      req.headers.get("cf-connecting-ip") ||
      "unknown";

    if (isRateLimited(clientIP)) {
      return new Response(
        JSON.stringify({ error: "Muitas tentativas. Aguarde um momento." }),
        { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (req.method !== "POST") {
      return new Response(
        JSON.stringify({ error: "Método não permitido" }),
        { status: 405, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const body = await req.json();
    const { token, ...formData } = body;

    // Validate token presence
    if (!token || typeof token !== "string" || token.trim().length === 0) {
      return new Response(
        JSON.stringify({ error: "Código de acesso é obrigatório" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Validate required fields
    const { nome_completo, cpf, whatsapp, tamanho_camiseta } = formData;
    if (!nome_completo || nome_completo.trim().length < 3) {
      return new Response(
        JSON.stringify({ error: "Nome completo deve ter pelo menos 3 caracteres" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!cpf || !isValidCPF(cpf)) {
      return new Response(
        JSON.stringify({ error: "CPF inválido" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!whatsapp) {
      return new Response(
        JSON.stringify({ error: "WhatsApp é obrigatório" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const validSizes = ["P", "M", "G", "GG", "XGG"];
    if (!tamanho_camiseta || !validSizes.includes(tamanho_camiseta)) {
      return new Response(
        JSON.stringify({ error: "Tamanho de camiseta inválido" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Create service role client
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Hash the token (simple SHA-256)
    const encoder = new TextEncoder();
    const data = encoder.encode(token.trim().toUpperCase());
    const hashBuffer = await crypto.subtle.digest("SHA-256", data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const tokenHash = hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");

    // Validate token
    const { data: tokenRecord, error: tokenError } = await supabaseAdmin
      .from("team_form_tokens")
      .select("*")
      .eq("token_hash", tokenHash)
      .eq("status", "active")
      .single();

    if (tokenError || !tokenRecord) {
      return new Response(
        JSON.stringify({ error: "Código de acesso inválido ou expirado" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check expiration
    if (new Date(tokenRecord.expires_at) < new Date()) {
      // Mark as expired
      await supabaseAdmin
        .from("team_form_tokens")
        .update({ status: "expired" })
        .eq("id", tokenRecord.id);

      return new Response(
        JSON.stringify({ error: "Código de acesso expirado" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check max uses
    if (tokenRecord.max_uses && tokenRecord.use_count >= tokenRecord.max_uses) {
      return new Response(
        JSON.stringify({ error: "Código de acesso atingiu o limite de usos" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Clean CPF for storage
    const cleanedCPF = cpf.replace(/\D/g, "");

    // Upsert submission by CPF
    const submissionData = {
      token_id: tokenRecord.id,
      nome_completo: nome_completo.trim(),
      cpf: cleanedCPF,
      rg: formData.rg?.trim() || null,
      data_nascimento: formData.data_nascimento || null,
      email_pessoal: formData.email_pessoal?.trim() || null,
      whatsapp: whatsapp.replace(/\D/g, ""),
      tamanho_camiseta,
      equipe_comercial: formData.equipe_comercial?.trim() || tokenRecord.equipe_comercial || null,
      supervisor_nome: formData.supervisor_nome?.trim() || tokenRecord.supervisor_nome || null,
      observacoes: formData.observacoes?.trim() || null,
    };

    const { error: upsertError } = await supabaseAdmin
      .from("team_form_submissions")
      .upsert(submissionData, { onConflict: "cpf" });

    if (upsertError) {
      console.error("Upsert error:", upsertError);
      return new Response(
        JSON.stringify({ error: "Erro ao salvar dados. Tente novamente." }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Increment use_count
    await supabaseAdmin
      .from("team_form_tokens")
      .update({ use_count: tokenRecord.use_count + 1 })
      .eq("id", tokenRecord.id);

    return new Response(
      JSON.stringify({ success: true, message: "Dados enviados com sucesso!" }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("Unexpected error:", err);
    return new Response(
      JSON.stringify({ error: "Erro interno do servidor" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
