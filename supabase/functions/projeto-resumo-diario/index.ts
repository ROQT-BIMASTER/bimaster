// Posta resumo automático no chat de cada projeto ativo.
// Disparado por pg_cron (19h BRT = 22h UTC) ou manualmente pelo usuário.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { secureHandler } from "../_shared/secure-handler.ts";
import { logger } from "../_shared/logger.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

interface ResumoLinha {
  user_id: string;
  user_nome: string;
  tarefas_concluidas: number;
  horas: number;
  custo: number;
}

function fmtBRL(v: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v || 0);
}

function buildMarkdown(data: string, linhas: ResumoLinha[], custoTec: number) {
  if (linhas.length === 0 && custoTec === 0) {
    return `**Resumo de ${data}**\n\nSem atividade registrada hoje.`;
  }
  const lines: string[] = [`**Resumo de ${data}**`, ""];
  let totalHoras = 0;
  let totalCusto = 0;
  for (const l of linhas) {
    const partes: string[] = [];
    if (l.tarefas_concluidas > 0) partes.push(`${l.tarefas_concluidas} tarefa${l.tarefas_concluidas > 1 ? "s" : ""}`);
    if (l.horas > 0) partes.push(`${Number(l.horas).toFixed(1)}h`);
    if (l.custo > 0) partes.push(fmtBRL(Number(l.custo)));
    lines.push(`- **${l.user_nome}**: ${partes.join(" — ")}`);
    totalHoras += Number(l.horas);
    totalCusto += Number(l.custo);
  }
  lines.push("");
  if (custoTec > 0) lines.push(`Tecnologia (rateado): ${fmtBRL(custoTec)}`);
  lines.push(`**Total do dia: ${fmtBRL(totalCusto + custoTec)} (${totalHoras.toFixed(1)}h)**`);
  return lines.join("\n");
}

export default secureHandler(
  { auth: "any", rateLimit: 30, rateLimitPrefix: "projeto-resumo-diario" },
  async (req) => {
    const admin = createClient(SUPABASE_URL, SERVICE_KEY);
    let body: { projeto_id?: string; data?: string } = {};
    try { body = await req.json(); } catch { /* cron sem body */ }

    const dataAlvo = body.data ?? new Date(Date.now() - 86400000).toISOString().slice(0, 10);

    // Lista projetos a processar
    const { data: projetos, error: projErr } = body.projeto_id
      ? await admin.from("projetos").select("id, nome").eq("id", body.projeto_id)
      : await admin.from("projetos").select("id, nome").eq("status", "ativo");
    if (projErr) {
      return new Response(JSON.stringify({ error: projErr.message }), { status: 500 });
    }

    // Custo de tecnologia rateado por projeto neste mês
    const mesIso = `${dataAlvo.slice(0, 7)}-01`;
    const { data: rateios } = await admin
      .from("vw_projeto_rateio_tecnologia")
      .select("projeto_id, custo_tecnologia_rateado")
      .eq("mes", mesIso);
    const custoTecMap = new Map<string, number>();
    for (const r of rateios ?? []) custoTecMap.set(r.projeto_id, Number(r.custo_tecnologia_rateado) || 0);

    const resultado: { projeto_id: string; postado: boolean }[] = [];

    for (const p of projetos ?? []) {
      const { data: linhas, error: rErr } = await admin.rpc("projeto_resumo_dia", {
        _projeto_id: p.id,
        _data: dataAlvo,
      });
      if (rErr) {
        logger.error("resumo_dia err", p.id, rErr);
        continue;
      }
      const ls = (linhas ?? []) as ResumoLinha[];
      const custoTec = custoTecMap.get(p.id) ?? 0;

      // pular se nada aconteceu
      if (ls.length === 0 && custoTec === 0) {
        resultado.push({ projeto_id: p.id, postado: false });
        continue;
      }

      const conteudo = buildMarkdown(
        new Date(dataAlvo + "T12:00:00").toLocaleDateString("pt-BR"),
        ls,
        custoTec,
      );

      // evita duplicar resumo do mesmo dia
      const { data: existente } = await admin
        .from("projeto_chat_messages")
        .select("id")
        .eq("projeto_id", p.id)
        .eq("tipo", "resumo_diario")
        .gte("created_at", `${dataAlvo}T00:00:00`)
        .lte("created_at", `${dataAlvo}T23:59:59`)
        .maybeSingle();

      if (existente) {
        await admin
          .from("projeto_chat_messages")
          .update({ conteudo, metadata: { data: dataAlvo, regenerado: true } })
          .eq("id", existente.id);
      } else {
        await admin.from("projeto_chat_messages").insert({
          projeto_id: p.id,
          user_id: null,
          conteudo,
          tipo: "resumo_diario",
          metadata: { data: dataAlvo },
        });
      }
      resultado.push({ projeto_id: p.id, postado: true });
    }

    return new Response(JSON.stringify({ ok: true, data: dataAlvo, projetos: resultado }), {
      headers: { "Content-Type": "application/json" },
    });
  },
);
