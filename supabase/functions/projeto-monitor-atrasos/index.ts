import { createClient } from "npm:@supabase/supabase-js@2";
import { getCorsHeaders, handleCors } from "../_shared/cors.ts";


Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: getCorsHeaders(req) });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get all non-completed tasks with deadlines
    const { data: tarefas, error } = await supabase
      .from("projeto_tarefas")
      .select("id, titulo, projeto_id, responsavel_id, criador_id, data_prazo, dias_alerta_antes, status")
      .neq("status", "concluida")
      .not("data_prazo", "is", null);

    if (error) throw error;

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const notifications: { user_id: string; titulo: string; mensagem: string; tipo: string; referencia_id: string; referencia_tipo: string }[] = [];

    for (const tarefa of tarefas || []) {
      const deadline = new Date(tarefa.data_prazo);
      deadline.setHours(0, 0, 0, 0);
      const daysRemaining = Math.floor((deadline.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
      const alertDays = tarefa.dias_alerta_antes ?? 2;

      const recipients = new Set<string>();
      if (tarefa.responsavel_id) recipients.add(tarefa.responsavel_id);
      if (tarefa.criador_id) recipients.add(tarefa.criador_id);

      if (daysRemaining < 0) {
        // Overdue
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
        // At risk
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
        console.error("Error inserting notifications:", notifError.message);
      }
    }

    return new Response(
      JSON.stringify({ processed: tarefas?.length || 0, notifications_sent: notifications.length }),
      { headers: { ...getCorsHeaders(req), "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("Error:", err);
    return new Response(
      JSON.stringify({ error: err.message }),
      { status: 500, headers: { ...getCorsHeaders(req), "Content-Type": "application/json" } }
    );
  }
});
