// china-submission-copilot — Relatório multilíngue (PT/EN/ZH) com visão 360° de
// uma submissão China: checklist efetivo (merge), documentos anexados por
// categoria, planilha inicial, OC, OP, embarque, atrasos e sugestões.
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

// ===== Constantes-espelho do checklist (sync com src/lib/china-document-types.ts) =====
const DEFAULT_DOC_TYPES: Record<string, { labelPt: string; labelCn: string }> = {
  volumetria: { labelPt: "Volumetria (Líquido e Bruto)", labelCn: "容量(液体和总重)" },
  formula: { labelPt: "Fórmula (Composição)", labelCn: "配方" },
  doc_regulatoria: { labelPt: "Documentação Regulatória", labelCn: "法规文件" },
  faca_primaria: { labelPt: "Faca Primária", labelCn: "初级刀模" },
  faca_display: { labelPt: "Faca Display", labelCn: "展示刀模" },
  faca_cartucho: { labelPt: "Faca Cartucho", labelCn: "盒子刀模" },
  faca_tester: { labelPt: "Faca Tester", labelCn: "试用装刀模" },
  amostra_foto: { labelPt: "Amostra Embalagem (Fotos)", labelCn: "包装样品(照片)" },
  amostra_video: { labelPt: "Amostra Embalagem (Vídeos)", labelCn: "包装样品(视频)" },
  planilha_excel: { labelPt: "Planilha Excel", labelCn: "Excel表格" },
  foto_confirmed_item: { labelPt: "Produto Confirmado", labelCn: "已确认产品照片" },
  foto_cores_todas: { labelPt: "Todas as Cores", labelCn: "所有颜色照片" },
  foto_garrafa: { labelPt: "Garrafa/Frasco", labelCn: "瓶子照片" },
  foto_garrafa_design: { labelPt: "Design da Garrafa", labelCn: "瓶子设计照片" },
  foto_cores_produto: { labelPt: "Cores do Produto", labelCn: "产品颜色照片" },
  foto_embalagem_ref: { labelPt: "Embalagem (Referência)", labelCn: "包装参考照片" },
  foto_produto_individual: { labelPt: "Foto Produto Individual", labelCn: "单个产品照片" },
  foto_cores_pesos: { labelPt: "Cores (Seção Pesos)", labelCn: "颜色照片" },
  foto_rotulo: { labelPt: "Foto do Rótulo", labelCn: "标签照片" },
  foto_arte: { labelPt: "Foto da Arte/Layout", labelCn: "设计/排版照片" },
  etiqueta_fundo: { labelPt: "Etiqueta de Fundo", labelCn: "底部标签" },
  etiqueta_tester: { labelPt: "Etiqueta Tester", labelCn: "试用标签" },
  etiqueta_bula: { labelPt: "Etiqueta Bula", labelCn: "说明标签" },
  arte_display: { labelPt: "Arte Display", labelCn: "展示设计稿" },
  ean_unitario: { labelPt: "EAN Unitário", labelCn: "单位EAN码" },
  ean_display: { labelPt: "EAN Display", labelCn: "展示EAN码" },
  ean_caixa: { labelPt: "EAN Caixa Master", labelCn: "主箱EAN码" },
  solicitacao_amostra_fotos: { labelPt: "Solicitação Amostra (Fotos)", labelCn: "样品请求(照片)" },
  solicitacao_amostra_videos: { labelPt: "Solicitação Amostra (Vídeos)", labelCn: "样品请求(视频)" },
};

const DEFAULT_CATEGORIES: { key: string; labelPt: string; labelCn: string; fluxo: "china_envia" | "brasil_envia"; tipos: string[] }[] = [
  { key: "dados_oficiais", labelPt: "Dados Oficiais", labelCn: "官方数据", fluxo: "china_envia", tipos: ["planilha_excel"] },
  { key: "fotos_planilha", labelPt: "Fotos da Planilha", labelCn: "表格照片", fluxo: "china_envia", tipos: ["foto_confirmed_item","foto_cores_todas","foto_garrafa","foto_garrafa_design","foto_cores_produto","foto_embalagem_ref","foto_produto_individual","foto_cores_pesos"] },
  { key: "imagens_gerais", labelPt: "Imagens Gerais", labelCn: "通用图片", fluxo: "china_envia", tipos: ["foto_rotulo","foto_arte"] },
  { key: "rotulagem", labelPt: "Rotulagem", labelCn: "标签", fluxo: "china_envia", tipos: ["volumetria","formula","doc_regulatoria"] },
  { key: "embalagem", labelPt: "Embalagem", labelCn: "包装", fluxo: "china_envia", tipos: ["faca_primaria","faca_display","faca_cartucho","faca_tester","amostra_foto","amostra_video"] },
  { key: "etiquetas", labelPt: "Etiquetas", labelCn: "标签贴纸", fluxo: "brasil_envia", tipos: ["etiqueta_fundo","etiqueta_tester","etiqueta_bula"] },
  { key: "artes_brasil", labelPt: "Artes e Design", labelCn: "设计稿", fluxo: "brasil_envia", tipos: ["arte_display"] },
  { key: "codigos_ean", labelPt: "Códigos EAN", labelCn: "EAN条码", fluxo: "brasil_envia", tipos: ["ean_unitario","ean_display","ean_caixa"] },
  { key: "solicitacao_amostras", labelPt: "Solicitação de Amostras", labelCn: "样品请求", fluxo: "brasil_envia", tipos: ["solicitacao_amostra_fotos","solicitacao_amostra_videos"] },
];

function daysBetween(a: Date, b: Date) {
  return Math.round((a.getTime() - b.getTime()) / 86400000);
}

const SYSTEM_PROMPTS: Record<"pt" | "en" | "zh", string> = {
  pt: `Você é um analista sênior de operações China–Brasil. Gere um relatório executivo detalhado, sofisticado e acionável sobre uma submissão de produto. Use markdown estruturado com tabelas. Estruture nas seções:
1. Sumário Executivo (1 parágrafo + KPIs)
2. Status do Checklist 360° (tabela por categoria com itens cumpridos, pendentes, documentos anexados e percentual)
3. Planilha Inicial (dados-chave da submissão)
4. Linha do Tempo (OC, OP, Embarque)
5. Riscos e Atrasos Identificados (alto/médio/baixo)
6. Sugestões Priorizadas de Atuação (com responsável e prazo recomendado)
7. Pontos de Atenção
Marque atrasos com ⚠. Sem emojis decorativos. Responda 100% em PORTUGUÊS BR.`,
  en: `You are a senior China–Brazil operations analyst. Produce a detailed, sophisticated and actionable executive report. Use structured markdown with tables. Sections:
1. Executive Summary (1 paragraph + KPIs)
2. 360° Checklist Status (table per category: completed items, pending, attached documents, percentage)
3. Initial Spreadsheet (key data)
4. Timeline (PO, Production, Shipment)
5. Identified Risks and Delays (high/medium/low)
6. Prioritized Action Suggestions (owner + recommended deadline)
7. Attention Points
Flag delays with ⚠. No decorative emojis. Respond 100% in ENGLISH.`,
  zh: `您是资深中国-巴西运营分析师。请生成详尽、专业、可执行的执行报告。使用带表格的结构化 markdown。包含以下部分:
1. 执行摘要(一段 + KPI)
2. 360° 清单状态(按类别表格:已完成项、待处理、已上传文档、百分比)
3. 初始表格(关键数据)
4. 时间线(采购订单、生产、装运)
5. 已识别风险与延误(高/中/低)
6. 优先行动建议(负责人 + 建议截止日期)
7. 注意事项
用 ⚠ 标记延误。不要装饰性 emoji。请100%使用简体中文。`,
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

      // 2. Carrega contexto em paralelo (incl. merge de checklist)
      const [docsRes, ocsRes, eventosRes, customCatsRes, customItensRes, hiddenRes, overridesRes] = await Promise.all([
        sb.from("china_produto_documentos").select("tipo_documento, status, previsao_envio, oficializado, oficializado_em, nome_arquivo, created_at").eq("submissao_id", submissao.id),
        sb.from("china_ordens_compra").select("id, numero_oc, status, qty_total, qty_produzida, data_emissao, data_entrega_prevista, data_entrega_real, aprovado_em, aceita_em, recusada_em").eq("submissao_id", submissao.id),
        sb.from("china_timeline_eventos").select("kind, payload, created_at").eq("submissao_id", submissao.id).order("created_at", { ascending: false }).limit(50),
        sb.from("china_checklist_custom_categorias").select("*").eq("submissao_id", submissao.id),
        sb.from("china_checklist_custom_itens").select("*").eq("submissao_id", submissao.id),
        sb.from("china_checklist_itens_ocultos").select("tipo_key").eq("submissao_id", submissao.id),
        sb.from("china_checklist_cat_overrides").select("categoria_key,label_pt,label_cn").eq("submissao_id", submissao.id),
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

      const docs = docsRes.data ?? [];
      const customCats = customCatsRes.data ?? [];
      const customItens = customItensRes.data ?? [];
      const hiddenSet = new Set<string>((hiddenRes.data ?? []).map((h: any) => h.tipo_key));
      const overrideMap = new Map<string, { label_pt: string; label_cn: string }>(
        (overridesRes.data ?? []).map((o: any) => [o.categoria_key, o]),
      );

      // ===== Checklist efetivo (merge) =====
      const customLabelByTipo: Record<string, { labelPt: string; labelCn: string }> = {};
      for (const i of customItens) customLabelByTipo[i.tipo_key] = { labelPt: i.label_pt, labelCn: i.label_cn ?? "" };

      const docsByTipo = new Map<string, any[]>();
      for (const d of docs) {
        const arr = docsByTipo.get(d.tipo_documento) ?? [];
        arr.push(d);
        docsByTipo.set(d.tipo_documento, arr);
      }

      // Categorias default + custom; itens custom adicionados à sua categoria
      type CatMerged = { key: string; labelPt: string; labelCn: string; fluxo: "china_envia" | "brasil_envia"; tipos: string[]; isCustom: boolean };
      const defaultMerged: CatMerged[] = DEFAULT_CATEGORIES.map((c) => {
        const ov = overrideMap.get(c.key);
        const extras = customItens.filter((i: any) => i.categoria_default_key === c.key && !i.categoria_custom_id).map((i: any) => i.tipo_key);
        return { key: c.key, labelPt: ov?.label_pt || c.labelPt, labelCn: ov?.label_cn ?? c.labelCn, fluxo: c.fluxo, tipos: [...c.tipos, ...extras], isCustom: false };
      });
      const customMerged: CatMerged[] = customCats.map((c: any) => ({
        key: `custom_${c.id}`, labelPt: c.label_pt, labelCn: c.label_cn || "", fluxo: c.fluxo,
        tipos: customItens.filter((i: any) => i.categoria_custom_id === c.id).map((i: any) => i.tipo_key),
        isCustom: true,
      }));
      const allCats = [...defaultMerged, ...customMerged].filter((c) => !hiddenSet.has(`cat:${c.key}`));

      const hoje = new Date();
      const checklist360: Array<{
        categoria: string; categoria_cn: string; fluxo: string;
        total_itens: number; cumpridos: number; pendentes: number;
        docs_anexados: number; docs_oficializados: number; percentual: number;
        itens: Array<{ tipo: string; label: string; cumprido: boolean; docs_anexados: number; docs_oficializados: number; ultimo_envio: string | null }>;
      }> = [];

      let totalItens = 0, totalCumpridos = 0, totalAnexados = 0, totalOficializados = 0;
      const itensPendentes: Array<{ categoria: string; tipo: string; label: string; previsao: string | null; dias_atraso: number | null }> = [];

      for (const cat of allCats) {
        const tiposVisiveis = cat.tipos.filter((t) => !hiddenSet.has(t));
        const itens = tiposVisiveis.map((tipo) => {
          const meta = DEFAULT_DOC_TYPES[tipo] ?? customLabelByTipo[tipo] ?? { labelPt: tipo, labelCn: tipo };
          const arr = docsByTipo.get(tipo) ?? [];
          const oficializados = arr.filter((d) => d.oficializado).length;
          const ultimo = arr.map((d) => d.created_at).sort().reverse()[0] ?? null;
          const cumprido = oficializados > 0 || arr.some((d) => /enviado|recebido|aprovado/i.test(d.status ?? ""));
          if (!cumprido) {
            // tentar extrair previsao de envio do primeiro doc planejado
            const prev = arr.map((d) => d.previsao_envio).find(Boolean) ?? null;
            const diasAtraso = prev ? -daysBetween(new Date(prev), hoje) : null;
            itensPendentes.push({ categoria: idioma === "zh" ? cat.labelCn : cat.labelPt, tipo, label: idioma === "zh" ? meta.labelCn : meta.labelPt, previsao: prev, dias_atraso: diasAtraso });
          }
          return {
            tipo, label: idioma === "zh" ? meta.labelCn : meta.labelPt,
            cumprido, docs_anexados: arr.length, docs_oficializados: oficializados,
            ultimo_envio: ultimo,
          };
        });
        const cumpridos = itens.filter((i) => i.cumprido).length;
        const docsAnex = itens.reduce((s, i) => s + i.docs_anexados, 0);
        const docsOf = itens.reduce((s, i) => s + i.docs_oficializados, 0);
        const total = itens.length;
        totalItens += total;
        totalCumpridos += cumpridos;
        totalAnexados += docsAnex;
        totalOficializados += docsOf;
        checklist360.push({
          categoria: cat.labelPt,
          categoria_cn: cat.labelCn,
          fluxo: cat.fluxo,
          total_itens: total,
          cumpridos,
          pendentes: total - cumpridos,
          docs_anexados: docsAnex,
          docs_oficializados: docsOf,
          percentual: total > 0 ? Math.round((cumpridos / total) * 100) : 0,
          itens,
        });
      }

      // Pendentes ordenados por dias de atraso
      itensPendentes.sort((a, b) => (b.dias_atraso ?? -9999) - (a.dias_atraso ?? -9999));

      // ===== Planilha Inicial =====
      const dadosExcel = (submissao as any).dados_excel ?? null;
      const medidas = (submissao as any).medidas_display ?? null;
      const planilha_resumo: any = { tem_planilha: !!dadosExcel, linhas: 0, colunas: [], preview: [], principais_campos: [] };
      if (dadosExcel) {
        if (Array.isArray(dadosExcel)) {
          planilha_resumo.linhas = dadosExcel.length;
          if (dadosExcel.length > 0 && typeof dadosExcel[0] === "object") {
            planilha_resumo.colunas = Object.keys(dadosExcel[0]);
            planilha_resumo.preview = dadosExcel.slice(0, 5);
          }
        } else if (typeof dadosExcel === "object") {
          planilha_resumo.colunas = Object.keys(dadosExcel);
          planilha_resumo.preview = [dadosExcel];
          planilha_resumo.linhas = 1;
        }
      }
      const principais: Array<{ campo: string; valor: string }> = [];
      const pushIf = (campo: string, valor: any) => {
        if (valor != null && valor !== "") principais.push({ campo, valor: String(valor) });
      };
      pushIf("Código", submissao.produto_codigo);
      pushIf("Produto", submissao.produto_nome);
      pushIf("Linha", submissao.linha_produto);
      pushIf("Qtd Total", submissao.qty_total);
      pushIf("Nº Ordem", submissao.numero_ordem);
      pushIf("Nº Item", submissao.numero_item);
      pushIf("Status", submissao.status);
      if (medidas && typeof medidas === "object") {
        for (const k of Object.keys(medidas).slice(0, 8)) pushIf(k, (medidas as any)[k]);
      }
      planilha_resumo.principais_campos = principais;

      // ===== Marcos / OC / Embarques =====
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
      const proxEmbarque = embarques
        .map((e) => e.data_embarque)
        .filter(Boolean)
        .map((d) => new Date(d as string))
        .sort((a, b) => a.getTime() - b.getTime())[0];

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

      // por_coluna agregado para o gráfico
      const por_coluna = checklist360.map((c) => ({
        coluna: c.categoria,
        concluido: c.cumpridos,
        pendente: c.pendentes,
        atrasado: c.itens.filter((i) => !i.cumprido && i.docs_anexados === 0).length,
      }));

      const docs_por_categoria = checklist360.map((c) => ({
        categoria: c.categoria,
        anexados: c.docs_anexados,
        oficializados: c.docs_oficializados,
      }));

      // ===== Sugestões heurísticas =====
      const sugestoes_acao: Array<{ prioridade: "alta" | "media" | "baixa"; titulo: string; detalhe: string; responsavel: string | null; prazo: string | null }> = [];
      for (const p of itensPendentes.slice(0, 3)) {
        sugestoes_acao.push({
          prioridade: (p.dias_atraso ?? 0) > 3 ? "alta" : "media",
          titulo: `Cobrar entrega: ${p.label}`,
          detalhe: `Categoria ${p.categoria}. ${p.previsao ? `Previsto para ${p.previsao}.` : "Sem previsão de envio cadastrada."}`,
          responsavel: null,
          prazo: p.previsao,
        });
      }
      if (proxEmbarque && daysBetween(proxEmbarque, hoje) <= 7 && totalItens - totalCumpridos > 0) {
        sugestoes_acao.push({
          prioridade: "alta",
          titulo: "Embarque iminente com checklist incompleto",
          detalhe: `Faltam ${totalItens - totalCumpridos} itens no checklist e o embarque está em ${daysBetween(proxEmbarque, hoje)} dias.`,
          responsavel: null, prazo: proxEmbarque.toISOString().slice(0, 10),
        });
      }
      if (!planilha_resumo.tem_planilha) {
        sugestoes_acao.push({
          prioridade: "alta",
          titulo: "Planilha inicial ausente",
          detalhe: "Solicitar à China o envio da planilha oficial da submissão para destravar etapas dependentes.",
          responsavel: null, prazo: null,
        });
      }

      // KPIs
      const atrasos_count = itensPendentes.filter((i) => (i.dias_atraso ?? 0) > 0).length;
      const atrasos_top = itensPendentes
        .filter((i) => (i.dias_atraso ?? 0) > 0)
        .slice(0, 10)
        .map((i) => ({ coluna: i.categoria, item: i.label, prazo: i.previsao, responsavel: null, dias_atraso: i.dias_atraso }));

      const analytics = {
        progresso_pct: totalItens > 0 ? Math.round((totalCumpridos / totalItens) * 100) : 0,
        por_coluna,
        docs_resumo: { total: totalAnexados, oficializado: totalOficializados, pendente: Math.max(0, totalAnexados - totalOficializados) },
        ocs_resumo,
        embarques_resumo,
        atrasos_top,
        marcos,
        checklist_360: checklist360,
        docs_por_categoria,
        planilha_resumo,
        sugestoes_acao,
        itens_pendentes_top: itensPendentes.slice(0, 15),
      };

      // 3. Monta payload estruturado para o modelo
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
        },
        kpis: {
          etapas_concluidas: totalCumpridos,
          etapas_totais: totalItens,
          atrasos_count,
          dias_para_embarque: proxEmbarque ? daysBetween(proxEmbarque, hoje) : null,
          risco: atrasos_count > 0 ? "alto" : proxEmbarque && daysBetween(proxEmbarque, hoje) < 7 ? "medio" : "baixo",
        },
        checklist_360: checklist360,
        planilha_resumo,
        sugestoes_acao,
        documentos_resumo: { total: totalAnexados, oficializados: totalOficializados },
        ordens_compra: ocsArr,
        embarques,
        producao,
        eventos_recentes: (eventosRes.data ?? []).slice(0, 30),
        gerado_em: new Date().toISOString(),
      };

      const userPrompt =
        `Profundidade solicitada: ${profundidade}.\n\nDossiê 360° (JSON):\n\n` +
        "```json\n" + JSON.stringify(dossie, null, 2) + "\n```\n\n" +
        (profundidade === "executivo"
          ? "Gere um RESUMO EXECUTIVO conciso (~700 palavras) com tabelas."
          : "Gere o RELATÓRIO COMPLETO e detalhado conforme as 7 seções, com tabelas markdown.");

      const r = await callAIGateway({
        model: "openai/gpt-5.5",
        messages: [
          { role: "system", content: SYSTEM_PROMPTS[idioma] },
          { role: "user", content: userPrompt },
        ],
        timeoutMs: 180_000,
      });
      if (r.kind !== "ok") return aiGatewayErrorResponse(r, cors);

      const content = r.data?.choices?.[0]?.message?.content ?? "";

      // Persistir relatório
      const submissaoSnapshot = {
        id: submissao.id,
        codigo: submissao.produto_codigo,
        nome: submissao.produto_nome,
        numero_item: submissao.numero_item,
        numero_ordem: submissao.numero_ordem,
        status: submissao.status,
      };
      let relatorioId: string | null = null;
      try {
        const { data: ins } = await sb
          .from("china_copilot_relatorios")
          .insert({
            submissao_id: submissao.id,
            idioma,
            profundidade,
            markdown: content,
            kpis: dossie.kpis,
            analytics,
            submissao_snapshot: submissaoSnapshot,
            model: r.modelUsed,
            gerado_por: _ctx.userId ?? null,
          })
          .select("id")
          .single();
        relatorioId = ins?.id ?? null;
      } catch (e) {
        console.error("Falha ao persistir relatório copiloto:", e);
      }

      sb.from("china_timeline_eventos")
        .insert({
          submissao_id: submissao.id,
          kind: "copilot_relatorio_gerado",
          payload: { idioma, profundidade, model: r.modelUsed, relatorio_id: relatorioId },
        })
        .then(() => {})
        .catch(() => {});

      return new Response(
        JSON.stringify({
          relatorio_id: relatorioId,
          markdown: content,
          kpis: dossie.kpis,
          analytics,
          submissao: { id: submissao.id, codigo: submissao.produto_codigo, nome: submissao.produto_nome },
          model: r.modelUsed,
        }),
        { headers: { ...cors, "Content-Type": "application/json" } },
      );
    },
  ),
);
