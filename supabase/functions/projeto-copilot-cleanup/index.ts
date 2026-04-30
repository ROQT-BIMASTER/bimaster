// projeto-copilot-cleanup — Limpa conversas e relatórios não-salvos > 30 dias
// Disparado por pg_cron diariamente. Sem auth (apenas chave shared opcional).
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const CLEANUP_SECRET = Deno.env.get("COPILOT_CLEANUP_SECRET") ?? "";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-cleanup-secret",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  // Proteção opcional via secret no header
  if (CLEANUP_SECRET) {
    const got = req.headers.get("x-cleanup-secret") ?? "";
    if (got !== CLEANUP_SECRET) {
      return new Response(JSON.stringify({ error: "forbidden" }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
  }

  const admin = createClient(SUPABASE_URL, SERVICE_KEY);
  const summary: Record<string, number> = { threads_apagadas: 0, relatorios_apagados: 0, arquivos_removidos: 0 };

  try {
    // Relatórios expirados não-salvos: pegar storage_path para apagar do bucket
    const { data: relsExp } = await admin.from("projeto_copilot_relatorios")
      .select("id, storage_path")
      .eq("salvo", false)
      .lt("expires_at", new Date().toISOString())
      .limit(500);

    if (relsExp && relsExp.length > 0) {
      const paths = relsExp.map((r: any) => r.storage_path).filter(Boolean);
      if (paths.length) {
        const { error: rmErr } = await admin.storage.from("projeto-relatorios").remove(paths);
        if (!rmErr) summary.arquivos_removidos = paths.length;
      }
      const ids = relsExp.map((r: any) => r.id);
      const { count } = await admin.from("projeto_copilot_relatorios")
        .delete({ count: "exact" }).in("id", ids);
      summary.relatorios_apagados = count ?? 0;
    }

    // Threads expiradas não-salvas (cascata em mensagens/ações)
    const { count: thCount } = await admin.from("projeto_copilot_threads")
      .delete({ count: "exact" })
      .eq("salvo", false)
      .lt("expires_at", new Date().toISOString());
    summary.threads_apagadas = thCount ?? 0;

    return new Response(JSON.stringify({ ok: true, ...summary }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e?.message ?? "cleanup falhou" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
