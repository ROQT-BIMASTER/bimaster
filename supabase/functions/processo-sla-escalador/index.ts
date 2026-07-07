// Runs on cron. Scans mirror rows whose SLA is past and not yet escalated.
// For each: fetches escalonado users of the etapa and inserts them as
// co-responsáveis of the projeto_tarefa (papel = "colaborador").

import { createClient } from "npm:@supabase/supabase-js@2";
import { secureHandler } from "../_shared/secure-handler.ts";
import { getCorsHeaders } from "../_shared/cors.ts";

Deno.serve(
  secureHandler(
    { auth: "any", rateLimit: 60, rateLimitPrefix: "processo-sla-escalador" },
    async (req) => {
      const cors = getCorsHeaders(req);
      const sb = createClient(
        Deno.env.get("SUPABASE_URL")!,
        Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      );

      const nowIso = new Date().toISOString();
      const { data: pendentes, error } = await sb
        .from("processo_tarefa_espelho")
        .select("id, etapa_id, projeto_tarefa_id, sla_limite")
        .lt("sla_limite", nowIso)
        .is("escalonado_em", null)
        .is("concluida_em", null)
        .limit(200);
      if (error) {
        return new Response(JSON.stringify({ error: error.message }), {
          status: 500,
          headers: { ...cors, "Content-Type": "application/json" },
        });
      }
      if (!pendentes || pendentes.length === 0) {
        return new Response(JSON.stringify({ escalados: 0 }), {
          headers: { ...cors, "Content-Type": "application/json" },
        });
      }

      const etapaIds = Array.from(new Set(pendentes.map((p) => p.etapa_id)));
      const { data: papeis } = await sb
        .from("processo_etapa_responsaveis")
        .select("etapa_id, user_id, papel")
        .eq("papel", "escalonado")
        .in("etapa_id", etapaIds);
      const byEtapa = new Map<string, string[]>();
      for (const p of papeis ?? []) {
        const arr = byEtapa.get(p.etapa_id) ?? [];
        arr.push(p.user_id);
        byEtapa.set(p.etapa_id, arr);
      }

      let count = 0;
      for (const row of pendentes) {
        const escalonados = byEtapa.get(row.etapa_id) ?? [];
        if (escalonados.length > 0 && row.projeto_tarefa_id) {
          await sb.from("projeto_tarefa_responsaveis").insert(
            escalonados.map((uid) => ({
              tarefa_id: row.projeto_tarefa_id,
              user_id: uid,
              papel: "colaborador",
            })),
          );
        }
        await sb
          .from("processo_tarefa_espelho")
          .update({ escalonado_em: nowIso })
          .eq("id", row.id);
        count += 1;
      }

      return new Response(JSON.stringify({ escalados: count }), {
        headers: { ...cors, "Content-Type": "application/json" },
      });
    },
  ),
);
