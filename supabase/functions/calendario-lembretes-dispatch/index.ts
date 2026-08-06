import { createClient } from "npm:@supabase/supabase-js@2";
import { getCorsHeaders } from "../_shared/cors.ts";
import { secureHandler } from "../_shared/secure-handler.ts";
import { logger } from "../_shared/logger.ts";

/**
 * Dispara lembretes de eventos do calendário.
 *
 * Roda a cada 15 minutos via pg_cron. Para cada lembrete ativo, calcula o
 * instante alvo (data de início do evento, 08:00 America/Sao_Paulo, menos a
 * antecedência configurada). Quando o alvo já passou e o lembrete ainda não
 * foi enviado para aquela data, envia e-mail e/ou notificação in-app.
 *
 * Idempotência: `ultimo_envio_para` guarda a data do evento já notificada.
 */

const TZ_OFFSET_MIN = -180; // America/Sao_Paulo (BRT, sem horário de verão)
const HORA_EVENTO_LOCAL = 8; // referência de início do dia útil

function instanteEvento(dataISO: string): Date {
  // dataISO = "YYYY-MM-DD" → 08:00 BRT convertido para UTC
  const [y, m, d] = dataISO.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d, HORA_EVENTO_LOCAL - TZ_OFFSET_MIN / 60, 0, 0));
}

function formatarDataBR(dataISO: string | null): string | undefined {
  if (!dataISO) return undefined;
  const [y, m, d] = dataISO.split("-");
  return `${d}/${m}/${y}`;
}

function rotuloAntecedencia(minutos: number): string {
  if (minutos % 1440 === 0) {
    const dias = minutos / 1440;
    return dias === 1 ? "1 dia antes" : `${dias} dias antes`;
  }
  if (minutos % 60 === 0) {
    const horas = minutos / 60;
    return horas === 1 ? "1 hora antes" : `${horas} horas antes`;
  }
  return `${minutos} minutos antes`;
}

Deno.serve(secureHandler(
  { auth: "none", rateLimit: 12, rateLimitPrefix: "calendario-lembretes" },
  async (req) => {
    const cors = getCorsHeaders(req);
    if (req.method === "OPTIONS") return new Response(null, { headers: cors });

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const agora = new Date();
    let enviados = 0;
    let falhas = 0;

    try {
      const { data: lembretes, error } = await supabase
        .from("calendario_lembretes")
        .select("id, tarefa_id, projeto_id, user_id, antecedencia_minutos, canal_email, canal_notificacao, ultimo_envio_para")
        .eq("ativo", true)
        .limit(500);

      if (error) throw error;

      for (const lem of lembretes ?? []) {
        try {
          const { data: tarefa } = await supabase
            .from("projeto_tarefas")
            .select("id, titulo, status, data_inicio_planejada, data_prazo, projeto_id")
            .eq("id", lem.tarefa_id)
            .maybeSingle();

          if (!tarefa) continue;
          if (tarefa.status === "concluida") continue;

          const dataEvento = tarefa.data_inicio_planejada || tarefa.data_prazo;
          if (!dataEvento) continue;
          if (lem.ultimo_envio_para === dataEvento) continue;

          const alvo = new Date(
            instanteEvento(dataEvento).getTime() - lem.antecedencia_minutos * 60_000,
          );
          if (alvo > agora) continue;
          // Não reenviar eventos muito antigos (janela de 2 dias).
          if (agora.getTime() - alvo.getTime() > 2 * 24 * 60 * 60_000) continue;

          const { data: perfil } = await supabase
            .from("profiles")
            .select("nome, email")
            .eq("id", lem.user_id)
            .maybeSingle();

          const { data: projeto } = await supabase
            .from("projetos")
            .select("nome")
            .eq("id", tarefa.projeto_id)
            .maybeSingle();

          if (lem.canal_notificacao) {
            await supabase.from("notifications").insert({
              user_id: lem.user_id,
              type: "calendario_lembrete",
              title: `Lembrete: ${tarefa.titulo}`,
              message: `${rotuloAntecedencia(lem.antecedencia_minutos)} — ${formatarDataBR(dataEvento)}`,
              action_url: `/dashboard/projetos/${tarefa.projeto_id}?tarefa=${tarefa.id}`,
            });
          }

          if (lem.canal_email && perfil?.email) {
            await supabase.functions.invoke("send-transactional-email", {
              body: {
                templateName: "calendario-lembrete",
                recipientEmail: perfil.email,
                idempotencyKey: `cal-lembrete-${lem.id}-${dataEvento}`,
                templateData: {
                  destinatarioNome: perfil.nome,
                  eventoTitulo: tarefa.titulo,
                  projetoNome: projeto?.nome,
                  dataInicio: formatarDataBR(tarefa.data_inicio_planejada),
                  dataPrazo: formatarDataBR(tarefa.data_prazo),
                  antecedencia: rotuloAntecedencia(lem.antecedencia_minutos),
                },
              },
            });
          }

          await supabase
            .from("calendario_lembretes")
            .update({ ultimo_envio_para: dataEvento, updated_at: new Date().toISOString() })
            .eq("id", lem.id);

          enviados++;
        } catch (e) {
          falhas++;
          logger.error("Falha ao processar lembrete", { lembreteId: lem.id, error: String(e) });
        }
      }

      return new Response(JSON.stringify({ ok: true, enviados, falhas }), {
        headers: { ...cors, "Content-Type": "application/json" },
      });
    } catch (e) {
      logger.error("Erro geral no disparo de lembretes", { error: String(e) });
      return new Response(JSON.stringify({ error: "Falha ao processar lembretes" }), {
        status: 500,
        headers: { ...cors, "Content-Type": "application/json" },
      });
    }
  },
));
