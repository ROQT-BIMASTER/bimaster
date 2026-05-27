// projeto-copilot-aplicar — Fase 2
// Recebe { acao_id, password }, valida senha do usuário (reauth), executa
// via RPC SECURITY DEFINER e atualiza status da ação. Anti-bruteforce.
import { createClient } from "npm:@supabase/supabase-js@2";
import { z } from "https://esm.sh/zod@3.23.8";
import { secureHandler } from "../_shared/secure-handler.ts";
import { getCorsHeaders } from "../_shared/cors.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;

const Body = z.object({
  acao_id: z.string().uuid(),
  password: z.string().min(1).max(200),
}).strict();

Deno.serve(secureHandler(
  { auth: "jwt", rateLimit: 20, rateLimitPrefix: "projeto-copilot-aplicar" },
  async (req, ctx) => {
    const corsHeaders = getCorsHeaders(req);
    const parsed = Body.safeParse(await req.json());
    if (!parsed.success) {
      return new Response(JSON.stringify({ error: parsed.error.flatten() }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const { acao_id, password } = parsed.data;
    const userId = ctx.userId!;
    const email = ctx.email!;
    if (!email) {
      return new Response(JSON.stringify({ error: "Email do usuário não disponível para reautenticação." }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const admin = createClient(SUPABASE_URL, SERVICE_KEY);

    // Carrega ação + thread (ownership)
    const { data: acao, error: acaoErr } = await admin
      .from("projeto_copilot_acoes")
      .select("id, thread_id, tipo, payload, status, projeto_copilot_threads!inner(user_id, projeto_id)")
      .eq("id", acao_id)
      .maybeSingle();
    if (acaoErr || !acao) {
      return new Response(JSON.stringify({ error: "Ação não encontrada." }), {
        status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const thread = (acao as any).projeto_copilot_threads;
    if (thread.user_id !== userId) {
      return new Response(JSON.stringify({ error: "Sem permissão para esta ação." }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (acao.status !== "proposta") {
      return new Response(JSON.stringify({ error: `Ação já foi ${acao.status}.` }), {
        status: 409, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Reautenticação por senha — usa cliente isolado (anon) p/ não impactar sessão
    const tmp = createClient(SUPABASE_URL, ANON_KEY, { auth: { persistSession: false } });
    const { data: signin, error: signErr } = await tmp.auth.signInWithPassword({ email, password });

    const success = !signErr && !!signin?.user && signin.user.id === userId;
    const { data: gate } = await admin.rpc("register_copilot_password_attempt", {
      _user_id: userId, _success: success,
    });
    if (gate && (gate as any).blocked) {
      return new Response(JSON.stringify({
        error: "Muitas tentativas de senha. Acesso bloqueado por 30 minutos.",
        bloqueado_ate: (gate as any).bloqueado_ate,
      }), { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    if (!success) {
      return new Response(JSON.stringify({ error: "Senha inválida." }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Executa via RPC controlada
    const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null;
    const ua = req.headers.get("user-agent") ?? null;

    const { data: result, error: execErr } = await admin.rpc("copilot_executar_acao", {
      _user_id: userId,
      _projeto_id: thread.projeto_id,
      _tipo: acao.tipo,
      _payload: acao.payload,
    });

    if (execErr) {
      await admin.from("projeto_copilot_acoes")
        .update({
          status: "falhou",
          aplicada_por: userId,
          aplicada_em: new Date().toISOString(),
          resultado: { erro: execErr.message },
          ip, user_agent: ua,
        }).eq("id", acao_id);
      return new Response(JSON.stringify({ error: execErr.message }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    await admin.from("projeto_copilot_acoes")
      .update({
        status: "aplicada",
        aplicada_por: userId,
        aplicada_em: new Date().toISOString(),
        resultado: result ?? {},
        ip, user_agent: ua,
      }).eq("id", acao_id);

    return new Response(JSON.stringify({ ok: true, resultado: result }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
));
