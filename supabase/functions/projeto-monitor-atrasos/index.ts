import { createClient } from "npm:@supabase/supabase-js@2";
import { secureHandler } from "../_shared/secure-handler.ts";
import { logger } from "../_shared/logger.ts";
import { getCorsHeaders, handleCors } from "../_shared/cors.ts";


// Auth: none — invocado apenas pelo cron `monitor-atrasos-diario` (pg_cron +
// pg_net). O cron não carrega usuário nem chave de ERP; usar apikey/jwt aqui
// quebrava a execução (histórico em cron.job_run_details).
Deno.serve(secureHandler({ auth: "none", rateLimit: 0, rateLimitPrefix: "projeto-monitor-atrasos" }, async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: getCorsHeaders(req) });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Todas as tarefas não concluídas que tenham prazo OU início planejado.
    // A regra `dias_alerta_antes` (default 2) passa a valer para ambos:
    //   • antecedência do vencimento (`data_prazo`) — alerta_prazo
    //   • antecedência da data programada de arranque (`data_inicio_planejada`) — alerta_inicio
    // e também dispara "atrasado" quando a data já passou e nada aconteceu
    // (para início: status ainda `pendente`; para prazo: status != concluída).
    const { data: tarefas, error } = await supabase
      .from("projeto_tarefas")
      .select("id, titulo, projeto_id, responsavel_id, criador_id, data_prazo, data_inicio_planejada, dias_alerta_antes, status")
      .neq("status", "concluida")
      .or("data_prazo.not.is.null,data_inicio_planejada.not.is.null");

    if (error) throw error;

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const notifications: { user_id: string; titulo: string; mensagem: string; tipo: string; referencia_id: string; referencia_tipo: string }[] = [];

    const diffDays = (target: string): number => {
      const d = new Date(target);
      d.setHours(0, 0, 0, 0);
      return Math.floor((d.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
    };

    for (const tarefa of tarefas || []) {
      const alertDays = tarefa.dias_alerta_antes ?? 2;
      const recipients = new Set<string>();
      if (tarefa.responsavel_id) recipients.add(tarefa.responsavel_id);
      if (tarefa.criador_id) recipients.add(tarefa.criador_id);
      if (recipients.size === 0) continue;

      // ── Prazo ────────────────────────────────────────────────────────────
      if (tarefa.data_prazo) {
        const daysRemaining = diffDays(tarefa.data_prazo);
        if (daysRemaining < 0) {
          for (const userId of recipients) {
            notifications.push({
              user_id: userId,
              titulo: `⚠️ Tarefa atrasada: ${tarefa.titulo}`,
              mensagem: `A tarefa "${tarefa.titulo}" está ${Math.abs(daysRemaining)} dia(s) atrasada.`,
              tipo: "atraso_tarefa",
              referencia_id: tarefa.id,
              referencia_tipo: "projeto_tarefa",
            });
          }
        } else if (daysRemaining <= alertDays) {
          for (const userId of recipients) {
            notifications.push({
              user_id: userId,
              titulo: `🕐 Prazo próximo: ${tarefa.titulo}`,
              mensagem: daysRemaining === 0
                ? `A tarefa "${tarefa.titulo}" vence hoje.`
                : `A tarefa "${tarefa.titulo}" vence em ${daysRemaining} dia(s).`,
              tipo: "alerta_prazo",
              referencia_id: tarefa.id,
              referencia_tipo: "projeto_tarefa",
            });
          }
        }
      }

      // ── Início planejado ────────────────────────────────────────────────
      // Mesma antecedência (`dias_alerta_antes`). Só alertamos quando a tarefa
      // ainda não começou — status `pendente`. Se já está em andamento/em
      // aprovação/agendada, não faz sentido lembrar o arranque.
      if (tarefa.data_inicio_planejada && tarefa.status === "pendente") {
        const daysToStart = diffDays(tarefa.data_inicio_planejada);
        if (daysToStart < 0) {
          for (const userId of recipients) {
            notifications.push({
              user_id: userId,
              titulo: `⚠️ Início atrasado: ${tarefa.titulo}`,
              mensagem: `O início planejado da tarefa "${tarefa.titulo}" está ${Math.abs(daysToStart)} dia(s) atrasado.`,
              tipo: "atraso_inicio_tarefa",
              referencia_id: tarefa.id,
              referencia_tipo: "projeto_tarefa",
            });
          }
        } else if (daysToStart <= alertDays) {
          for (const userId of recipients) {
            notifications.push({
              user_id: userId,
              titulo: `🚦 Início próximo: ${tarefa.titulo}`,
              mensagem: daysToStart === 0
                ? `A tarefa "${tarefa.titulo}" deve iniciar hoje.`
                : `A tarefa "${tarefa.titulo}" deve iniciar em ${daysToStart} dia(s).`,
              tipo: "alerta_inicio",
              referencia_id: tarefa.id,
              referencia_tipo: "projeto_tarefa",
            });
          }
        }
      }
    }

    // Check overdue metas
    const { data: metas } = await supabase
      .from("projeto_tarefa_metas")
      .select("id, descricao, data_meta, tarefa_id")
      .eq("concluida", false)
      .not("data_meta", "is", null)
      .lt("data_meta", today.toISOString().split("T")[0]);

    if (metas && metas.length > 0) {
      const tarefaIds = [...new Set(metas.map(m => m.tarefa_id))];
      const { data: parentTarefas } = await supabase
        .from("projeto_tarefas")
        .select("id, titulo, responsavel_id, criador_id")
        .in("id", tarefaIds);

      const tarefaMap = Object.fromEntries((parentTarefas || []).map(t => [t.id, t]));

      for (const meta of metas) {
        const parent = tarefaMap[meta.tarefa_id];
        if (!parent) continue;
        const recipients = new Set<string>();
        if (parent.responsavel_id) recipients.add(parent.responsavel_id);
        if (parent.criador_id) recipients.add(parent.criador_id);

        for (const userId of recipients) {
          notifications.push({
            user_id: userId,
            titulo: `📌 Marco atrasado: ${meta.descricao}`,
            mensagem: `O marco "${meta.descricao}" da tarefa "${parent.titulo}" está vencido.`,
            tipo: "meta_atrasada",
            referencia_id: meta.tarefa_id,
            referencia_tipo: "projeto_tarefa",
          });
        }
      }
    }

    // Insert notifications (if table exists)
    if (notifications.length > 0) {
      const { error: notifError } = await supabase
        .from("notificacoes")
        .insert(notifications.map(n => ({
          ...n,
          lida: false,
          created_at: new Date().toISOString(),
        })));

      if (notifError) {
        logger.error("Error inserting notifications:", notifError.message);
      }
    }

    return new Response(
      JSON.stringify({ processed: tarefas?.length || 0, notifications_sent: notifications.length }),
      { headers: { ...getCorsHeaders(req), "Content-Type": "application/json" } }
    );
  } catch (err) {
    logger.error("Error:", err);
    return new Response(
      JSON.stringify({ error: (err as Error).message }),
      { status: 500, headers: { ...getCorsHeaders(req), "Content-Type": "application/json" } }
    );
  }
}));
