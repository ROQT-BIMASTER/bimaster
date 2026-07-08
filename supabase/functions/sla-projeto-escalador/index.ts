// Camada 2 do SLA: varre tarefas de Meus Projetos e escala violações/riscos
// para a Central de Suporte via RPC `abrir_ticket_sla_tarefa`.
// Executado por cron (pg_cron -> pg_net) a cada 5 minutos.
import { createClient } from "npm:@supabase/supabase-js@2";
import { secureHandler } from "../_shared/secure-handler.ts";
import { getCorsHeaders } from "../_shared/cors.ts";

// Janela em que a tarefa entra em "em_risco" antes do vencimento (minutos).
const RISK_WINDOW_MIN = 15;
const BATCH_SIZE = 500;

Deno.serve(
  secureHandler(
    { auth: "any", rateLimit: 60, rateLimitPrefix: "sla-projeto-escalador" },
    async (req) => {
      const cors = getCorsHeaders(req);
      const sb = createClient(
        Deno.env.get("SUPABASE_URL")!,
        Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      );

      const now = new Date();
      const riskCutoffIso = new Date(now.getTime() + RISK_WINDOW_MIN * 60_000).toISOString();

      // Busca tarefas com prazo ainda em aberto (ou já vencidas) que ainda
      // não têm ticket associado OU já têm mas precisam ter status atualizado.
      const { data: tarefas, error } = await sb
        .from("projeto_tarefas")
        .select("id, data_prazo, data_conclusao, status, sla_ticket_id, sla_status")
        .is("data_conclusao", null)
        .not("data_prazo", "is", null)
        .not("status", "in", "(concluida,cancelada,arquivada)")
        .lte("data_prazo", riskCutoffIso)
        .limit(BATCH_SIZE);

      if (error) {
        return new Response(JSON.stringify({ error: error.message }), {
          status: 500,
          headers: { ...cors, "Content-Type": "application/json" },
        });
      }

      let violados = 0;
      let em_risco = 0;
      let ignorados = 0;

      for (const t of tarefas ?? []) {
        const prazo = new Date(t.data_prazo as string);
        const isViolado = now.getTime() > prazo.getTime();
        const targetStatus = isViolado ? "violado" : "em_risco";

        // Não repete chamada se o status já está no estado desejado
        if (t.sla_status === targetStatus && t.sla_ticket_id) {
          ignorados += 1;
          continue;
        }

        const { error: rpcErr } = await sb.rpc("abrir_ticket_sla_tarefa", {
          _tarefa_id: t.id,
          _sla_status: targetStatus,
        });
        if (rpcErr) {
          ignorados += 1;
          continue;
        }
        if (isViolado) violados += 1; else em_risco += 1;
      }

      return new Response(
        JSON.stringify({
          processadas: tarefas?.length ?? 0,
          violados,
          em_risco,
          ignorados,
        }),
        { headers: { ...cors, "Content-Type": "application/json" } },
      );
    },
  ),
);
