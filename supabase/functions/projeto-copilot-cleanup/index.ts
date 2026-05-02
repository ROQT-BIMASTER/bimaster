// projeto-copilot-cleanup — Limpa conversas e relatórios não-salvos > 30 dias
// para o copiloto do PROJETO e da CENTRAL DE TRABALHO.
// Disparado por pg_cron diariamente. Sem auth (apenas chave shared opcional).
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const CLEANUP_SECRET = Deno.env.get("COPILOT_CLEANUP_SECRET") ?? "";


async function cleanupScope(
  admin: ReturnType<typeof createClient>,
  table_threads: string,
  table_relatorios: string,
  bucket: string,
) {
  const summary = { threads_apagadas: 0, relatorios_apagados: 0, arquivos_removidos: 0 };

  const { data: relsExp } = await admin.from(table_relatorios)
    .select("id, storage_path")
    .eq("salvo", false)
    .lt("expires_at", new Date().toISOString())
    .limit(500);

  if (relsExp && relsExp.length > 0) {
    const paths = (relsExp as any[]).map((r) => r.storage_path).filter(Boolean);
    if (paths.length) {
      const { error: rmErr } = await admin.storage.from(bucket).remove(paths);
      if (!rmErr) summary.arquivos_removidos = paths.length;
    }
    const ids = (relsExp as any[]).map((r) => r.id);
    const { count } = await admin.from(table_relatorios).delete({ count: "exact" }).in("id", ids);
    summary.relatorios_apagados = count ?? 0;
  }

  const { count: thCount } = await admin.from(table_threads)
    .delete({ count: "exact" })
    .eq("salvo", false)
    .lt("expires_at", new Date().toISOString());
  summary.threads_apagadas = thCount ?? 0;
  return summary;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: getCorsHeaders(req) });
  if (CLEANUP_SECRET) {
    const got = req.headers.get("x-cleanup-secret") ?? "";
    if (got !== CLEANUP_SECRET) {
      return new Response(JSON.stringify({ error: "forbidden" }), {
        status: 403, headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
      });
    }
  }
  const admin = createClient(SUPABASE_URL, SERVICE_KEY);
  try {
    const projeto = await cleanupScope(admin, "projeto_copilot_threads", "projeto_copilot_relatorios", "projeto-relatorios");
    const central = await cleanupScope(admin, "central_copilot_threads", "central_copilot_relatorios", "projeto-relatorios");
    return new Response(JSON.stringify({ ok: true, projeto, central }), {
      headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
    });
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e?.message ?? "cleanup falhou" }), {
      status: 500, headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
    });
  }
});
