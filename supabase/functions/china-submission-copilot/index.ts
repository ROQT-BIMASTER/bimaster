// china-submission-copilot — Gera relatório multilíngue (PT/EN/ZH) detalhado
// de uma submissão China: checklist (concluído/pendente/em risco), OC, OP,
// embarque, documentos, prazos e atrasos.
import { z } from "https://esm.sh/zod@3.23.8";
import { createClient } from "npm:@supabase/supabase-js@2";
import { secureHandler } from "../_shared/secure-handler.ts";
import { getCorsHeaders } from "../_shared/cors.ts";
import { callAIGateway, aiGatewayErrorResponse } from "../_shared/ai-gateway-call.ts";

const Body = z
  .object({
    submissao_id: z.string().uuid().optional(),
    codigo: z.string().min(1).max(120).optional(),
    idioma: z.enum(["pt", "en", "zh"]).default("pt"),
    profundidade: z.enum(["executivo", "completo"]).default("completo"),
  })
  .strict()
  .refine((v) => v.submissao_id || v.codigo, {
    message: "Informe submissao_id ou codigo",
  });

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

function daysBetween(a: Date, b: Date) {
  return Math.round((a.getTime() - b.getTime()) / 86400000);
}

function flattenChecklist(colunas: any[]): {
  total: number;
  concluidas: number;
  itens: Array<{
    coluna: string;
    item: string;
    concluido: boolean;
    prazo?: string | null;
    responsavel?: string | null;
    atrasado: boolean;
  }>;
} {
  const itens: any[] = [];
  let total = 0;
  let concluidas = 0;
  const hoje = new Date();
  for (const col of colunas ?? []) {
    const colNome = col?.nome ?? col?.titulo ?? col?.label ?? "Coluna";
    for (const it of col?.itens ?? col?.items ?? []) {
      const concluido = !!(it?.concluido ?? it?.done ?? it?.checked);
      const prazo = it?.prazo ?? it?.deadline ?? it?.data_prevista ?? null;
      const responsavel = it?.responsavel ?? it?.owner ?? null;
      let atrasado = false;
      if (!concluido && prazo) {
        try {
          atrasado = new Date(prazo) < hoje;
        } catch {
          /* ignore */
        }
      }
      total++;
      if (concluido) concluidas++;
      itens.push({
        coluna: colNome,
        item: it?.titulo ?? it?.nome ?? it?.label ?? "Item",
        concluido,
        prazo,
        responsavel,
        atrasado,
      });
    }
  }
  return { total, concluidas, itens };
}

const SYSTEM_PROMPTS: Record<"pt" | "en" | "zh", string> = {
  pt: `Você é um analista sênior de operações China–Brasil. Gere um relatório executivo detalhado, sofisticado e acionável sobre uma submissão de produto. Use markdown estruturado com tabelas. Estruture nas seções:
1. Sumário Executivo (1 parágrafo + 4 KPIs em bullets)
2. Status do Checklist (tabelas separadas: Concluídas, Pendentes, Em Atraso — com prazos e responsáveis)
3. Linha do Tempo (Ordem de Compra, Ordem de Produção, Embarque — etapas concluídas e ainda a realizar com datas previstas/realizadas)
4. Riscos e Atrasos Identificados (com nível: alto/médio/baixo)
5. Próximos Passos Recomendados (lista priorizada)
6. Pontos de Atenção
Marque atrasos com o símbolo ⚠. Não use emojis decorativos. Responda 100% em PORTUGUÊS BR.`,
  en: `You are a senior China–Brazil operations analyst. Produce a detailed, sophisticated and actionable executive report about a product submission. Use structured markdown with tables. Sections:
1. Executive Summary (1 paragraph + 4 KPI bullets)
2. Checklist Status (separate tables: Completed, Pending, Overdue — with deadlines and owners)
3. Timeline (Purchase Order, Production Order, Shipment — completed and pending steps with planned/actual dates)
4. Identified Risks and Delays (level: high/medium/low)
5. Recommended Next Steps (prioritized)
6. Attention Points
Flag delays with the ⚠ symbol. No decorative emojis. Respond 100% in ENGLISH.`,
  zh: `您是一位资深中国-巴西运营分析师。请生成一份详尽、专业、可执行的产品提交执行报告。使用带表格的结构化 markdown。包含以下部分:
1. 执行摘要(一段话 + 4 个 KPI 项目)
2. 清单状态(分别用表格列出:已完成、待处理、已逾期 - 包含截止日期和负责人)
3. 时间线(采购订单、生产订单、装运 - 已完成和待完成步骤及计划/实际日期)
4. 已识别的风险和延误(级别:高/中/低)
5. 建议的下一步行动(按优先级)
6. 注意事项
用 ⚠ 符号标记延误。不要使用装饰性 emoji。请100%使用简体中文回答。`,
};

Deno.serve(
  secureHandler(
    { auth: "jwt", rateLimit: 10, rateLimitPrefix: "china-copilot" },
    async (req, _ctx) => {
      const cors = getCorsHeaders(req);
      let payload: unknown;
      try {
        payload = await req.json();
      } catch {
        return new Response(JSON.stringify({ error: "Body inválido" }), {
          status: 400,
          headers: { ...cors, "Content-Type": "application/json" },
        });
      }
      const parsed = Body.safeParse(payload);
      if (!parsed.success) {
        return new Response(
          JSON.stringify({ error: parsed.error.flatten() }),
          { status: 400, headers: { ...cors, "Content-Type": "application/json" } },
        );
      }

      const { submissao_id, codigo, idioma, profundidade } = parsed.data;
      const sb = createClient(SUPABASE_URL, SERVICE_ROLE);

      // 1. Resolve submissão
      let subQ = sb.from("china_produto_submissoes").select("*").limit(1);
      if (submissao_id) subQ = subQ.eq("id", submissao_id);
      else
        subQ = subQ.or(
          `produto_codigo.eq.${codigo},numero_item.eq.${codigo},numero_ordem.eq.${codigo}`,
        );
      const { data: subs, error: subErr } = await subQ;
      if (subErr || !subs?.[0]) {
        return new Response(
          JSON.stringify({ error: "Submissão não encontrada", detail: subErr?.message }),
          { status: 404, headers: { ...cors, "Content-Type": "application/json" } },
        );
      }
      const submissao = subs[0];

      // 2. Carrega contexto em paralelo
      const [checklistRes, docsRes, ocsRes, eventosRes] = await Promise.all([
        sb.from("china_produto_checklist").select("colunas, updated_at").eq("submissao_id", submissao.id).maybeSingle(),
        sb.from("china_produto_documentos").select("tipo_documento, status, previsao_envio, oficializado, oficializado_em, nome_arquivo, created_at").eq("submissao_id", submissao.id),
        sb.from("china_ordens_compra").select("id, numero_oc, status, qty_total, qty_produzida, data_emissao, data_entrega_prevista, data_entrega_real, aprovado_em, aceita_em, recusada_em").eq("submissao_id", submissao.id),
        sb.from("china_timeline_eventos").select("kind, payload, created_at").eq("submissao_id", submissao.id).order("created_at", { ascending: false }).limit(50),
      ]);

      const ocIds = (ocsRes.data ?? []).map((o: any) => o.id);
      let embarques: any[] = [];
      let producao: any[] = [];
      if (ocIds.length > 0) {
        const [embRes, prodRes] = await Promise.all([
          sb.from("china_embarques").select("numero_embarque, status, data_embarque, data_eta, navio, porto_origem, porto_destino, ordem_compra_id").in("ordem_compra_id", ocIds),
          sb.from("china_producao_apontamentos").select("ordem_compra_id, etapa, status, data_inicio, data_fim, observacao").in("ordem_compra_id", ocIds).limit(100),
        ]);
        embarques = embRes.data ?? [];
        producao = prodRes.data ?? [];
      }

      const checklistFlat = flattenChecklist(checklistRes.data?.colunas ?? []);
      const hoje = new Date();
      const atrasos = checklistFlat.itens.filter((i) => i.atrasado);
      const proxEmbarque = embarques
        .map((e) => e.data_embarque)
        .filter(Boolean)
        .map((d) => new Date(d as string))
        .sort((a, b) => a.getTime() - b.getTime())[0];

      // Analytics agregadas (para cards/gráficos no front)
      const porColunaMap = new Map<string, { coluna: string; concluido: number; pendente: number; atrasado: number }>();
      for (const it of checklistFlat.itens) {
        const cur = porColunaMap.get(it.coluna) ?? { coluna: it.coluna, concluido: 0, pendente: 0, atrasado: 0 };
        if (it.concluido) cur.concluido++;
        else if (it.atrasado) cur.atrasado++;
        else cur.pendente++;
        porColunaMap.set(it.coluna, cur);
      }
      const docs = docsRes.data ?? [];
      const docs_resumo = {
        total: docs.length,
        oficializado: docs.filter((d: any) => d.oficializado).length,
        pendente: docs.filter((d: any) => !d.oficializado).length,
      };
      const ocsArr = ocsRes.data ?? [];
      const ocs_resumo = {
        total: ocsArr.length,
        aprovadas: ocsArr.filter((o: any) => o.aprovado_em).length,
        em_producao: ocsArr.filter((o: any) => (o.qty_produzida ?? 0) > 0 && (o.qty_produzida ?? 0) < (o.qty_total ?? 0)).length,
        concluidas: ocsArr.filter((o: any) => (o.qty_produzida ?? 0) >= (o.qty_total ?? 0) && (o.qty_total ?? 0) > 0).length,
      };
      const embarques_resumo = {
        total: embarques.length,
        em_transito: embarques.filter((e: any) => e.status && /trans|sea|on_board|in_transit/i.test(e.status)).length,
        entregues: embarques.filter((e: any) => e.status && /entregue|delivered|chegou/i.test(e.status)).length,
      };
      const marcos: Array<{ data: string | null; label: string; status: "ok" | "pending" | "late"; tipo: string }> = [];
      marcos.push({ data: submissao.created_at, label: "Submissão criada", status: "ok", tipo: "submissao" });
      if (submissao.data_envio) marcos.push({ data: submissao.data_envio, label: "Enviada ao Brasil", status: "ok", tipo: "submissao" });
      if (submissao.aprovado_em) marcos.push({ data: submissao.aprovado_em, label: "Submissão aprovada", status: "ok", tipo: "submissao" });
      for (const oc of ocsArr) {
        if (oc.data_emissao) marcos.push({ data: oc.data_emissao, label: `OC ${oc.numero_oc} emitida`, status: "ok", tipo: "oc" });
        if (oc.data_entrega_prevista) {
          const late = !oc.data_entrega_real && new Date(oc.data_entrega_prevista) < hoje;
          marcos.push({ data: oc.data_entrega_prevista, label: `OC ${oc.numero_oc} — entrega prevista`, status: oc.data_entrega_real ? "ok" : late ? "late" : "pending", tipo: "oc" });
        }
        if (oc.data_entrega_real) marcos.push({ data: oc.data_entrega_real, label: `OC ${oc.numero_oc} entregue`, status: "ok", tipo: "oc" });
      }
      for (const e of embarques) {
        if (e.data_embarque) marcos.push({ data: e.data_embarque, label: `Embarque ${e.numero_embarque} — saída`, status: "ok", tipo: "embarque" });
        if (e.data_eta) {
          const late = new Date(e.data_eta) < hoje && !/entregue|delivered/i.test(e.status ?? "");
          marcos.push({ data: e.data_eta, label: `Embarque ${e.numero_embarque} — ETA`, status: late ? "late" : "pending", tipo: "embarque" });
        }
      }
      marcos.sort((a, b) => (a.data ?? "").localeCompare(b.data ?? ""));

      const analytics = {
        progresso_pct: checklistFlat.total > 0 ? Math.round((checklistFlat.concluidas / checklistFlat.total) * 100) : 0,
        por_coluna: Array.from(porColunaMap.values()),
        docs_resumo,
        ocs_resumo,
        embarques_resumo,
        atrasos_top: atrasos
          .map((a) => ({ coluna: a.coluna, item: a.item, prazo: a.prazo, responsavel: a.responsavel, dias_atraso: a.prazo ? daysBetween(hoje, new Date(a.prazo)) : null }))
          .sort((a, b) => (b.dias_atraso ?? 0) - (a.dias_atraso ?? 0))
          .slice(0, 10),
        marcos,
      };

      // 3. Monta payload estruturado
      const dossie = {
        submissao: {
          id: submissao.id,
          codigo: submissao.produto_codigo,
          nome: submissao.produto_nome,
          numero_item: submissao.numero_item,
          numero_ordem: submissao.numero_ordem,
          status: submissao.status,
          qty_total: submissao.qty_total,
          linha_produto: submissao.linha_produto,
          created_at: submissao.created_at,
          data_envio: submissao.data_envio,
          aprovado_em: submissao.aprovado_em,
          observacoes_china: submissao.observacoes_china,
          observacoes_brasil: submissao.observacoes_brasil,
        },
        kpis: {
          etapas_concluidas: checklistFlat.concluidas,
          etapas_totais: checklistFlat.total,
          atrasos_count: atrasos.length,
          dias_para_embarque: proxEmbarque ? daysBetween(proxEmbarque, hoje) : null,
          risco: atrasos.length > 0 ? "alto" : proxEmbarque && daysBetween(proxEmbarque, hoje) < 7 ? "medio" : "baixo",
        },
        checklist: checklistFlat,
        documentos: docsRes.data ?? [],
        ordens_compra: ocsRes.data ?? [],
        embarques,
        producao,
        eventos_recentes: (eventosRes.data ?? []).slice(0, 30),
        gerado_em: new Date().toISOString(),
      };

      const userPrompt =
        `Profundidade solicitada: ${profundidade}.\n\nDados estruturados (JSON) da submissão:\n\n` +
        "```json\n" + JSON.stringify(dossie, null, 2) + "\n```\n\n" +
        (profundidade === "executivo"
          ? "Gere um RESUMO EXECUTIVO conciso (~600 palavras)."
          : "Gere o RELATÓRIO COMPLETO e detalhado conforme as 6 seções.");

      const r = await callAIGateway({
        model: "openai/gpt-5.2",
        messages: [
          { role: "system", content: SYSTEM_PROMPTS[idioma] },
          { role: "user", content: userPrompt },
        ],
        timeoutMs: 120_000,
      });
      if (r.kind !== "ok") return aiGatewayErrorResponse(r, cors);

      const content = r.data?.choices?.[0]?.message?.content ?? "";

      // Log no timeline
      sb.from("china_timeline_eventos")
        .insert({
          submissao_id: submissao.id,
          kind: "copilot_relatorio_gerado",
          payload: { idioma, profundidade, model: r.modelUsed },
        })
        .then(() => {})
        .catch(() => {});

      return new Response(
        JSON.stringify({
          markdown: content,
          kpis: dossie.kpis,
          submissao: { id: submissao.id, codigo: submissao.produto_codigo, nome: submissao.produto_nome },
          model: r.modelUsed,
        }),
        { headers: { ...cors, "Content-Type": "application/json" } },
      );
    },
  ),
);
