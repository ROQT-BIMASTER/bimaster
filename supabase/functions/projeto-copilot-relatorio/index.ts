// projeto-copilot-relatorio — v2 (relatórios dinâmicos guiados por IA)
// Pipeline: contexto do projeto (+ documentos opcionais) → IA produz ReportSpec
// → renderer genérico desenha PDF/XLSX. Fallback determinístico se a IA falhar.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { z } from "https://esm.sh/zod@3.23.8";
import { secureHandler } from "../_shared/secure-handler.ts";
import { getCorsHeaders } from "../_shared/cors.ts";
import { callAIGateway } from "../_shared/ai-gateway-call.ts";
import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from "https://esm.sh/pdf-lib@1.17.1";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const Body = z.object({
  projeto_id: z.string().uuid(),
  thread_id: z.string().uuid().optional(),
  // legacy
  tipo: z.enum(["status", "responsaveis", "executivo"]).optional(),
  formato: z.enum(["pdf", "xlsx"]),
  // novo
  prompt: z.string().min(1).max(4000).optional(),
  incluir_documentos: z.boolean().optional(),
}).strict();

interface TarefaRow {
  id: string; titulo: string; status: string; prioridade: string;
  data_prazo: string | null; responsavel_id: string | null;
  estagio?: string | null; descricao?: string | null;
}

// =============== ReportSpec ===============
type Block =
  | { kind: "heading"; level: 1 | 2 | 3; text: string }
  | { kind: "paragraph"; text: string }
  | { kind: "kpis"; items: { label: string; value: string | number; hint?: string }[] }
  | { kind: "table"; columns: string[]; rows: (string | number | null)[][]; caption?: string }
  | { kind: "bar_chart"; title: string; series: { label: string; value: number; color?: [number, number, number] }[] }
  | { kind: "pie_chart"; title: string; series: { label: string; value: number }[] }
  | { kind: "list"; ordered?: boolean; items: string[] }
  | { kind: "callout"; tone: "info" | "warn" | "success" | "danger"; text: string }
  | { kind: "document_ref"; nome: string; trecho: string }
  | { kind: "page_break" };

interface ReportSpec {
  titulo: string;
  subtitulo?: string;
  resumo_executivo?: string;
  blocks: Block[];
}

// =============== Carregamento de contexto ===============
async function loadContexto(userClient: any, projetoId: string) {
  const [{ data: projeto }, { data: tarefas }, { data: profiles }, { data: anexos }] = await Promise.all([
    userClient.from("projetos").select("id, nome, descricao, status, data_inicio, data_fim_prevista").eq("id", projetoId).maybeSingle(),
    userClient.from("projeto_tarefas")
      .select("id, titulo, descricao, status, prioridade, data_prazo, responsavel_id, estagio")
      .eq("projeto_id", projetoId).is("excluida_em", null),
    userClient.from("profiles").select("id, full_name, email"),
    userClient.from("projeto_tarefa_anexos")
      .select("id, nome, tipo_arquivo, tamanho, storage_path, tarefa_id, projeto_tarefas!inner(projeto_id, titulo)")
      .eq("projeto_tarefas.projeto_id", projetoId)
      .limit(50),
  ]);
  const profMap = new Map<string, string>();
  for (const p of (profiles ?? [])) profMap.set(p.id, p.full_name || p.email || "—");
  return { projeto, tarefas: (tarefas ?? []) as TarefaRow[], profMap, anexos: anexos ?? [] };
}

function metricas(tarefas: TarefaRow[]) {
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const total = tarefas.length;
  const concluidas = tarefas.filter(t => t.status === "concluida").length;
  const atrasadas = tarefas.filter(t => t.status !== "concluida" && t.data_prazo && new Date(t.data_prazo) < today).length;
  const sem_resp = tarefas.filter(t => !t.responsavel_id).length;
  const em_andamento = tarefas.filter(t => t.status === "em_andamento").length;
  const alta_prioridade = tarefas.filter(t => (t.prioridade ?? "").toLowerCase().includes("alta") || (t.prioridade ?? "").toLowerCase().includes("urgent")).length;
  const pct = total ? Math.round((concluidas / total) * 100) : 0;
  return { total, concluidas, atrasadas, sem_resp, em_andamento, alta_prioridade, pct };
}

// =============== Leitura opcional de documentos ===============
async function lerAnexos(userClient: any, anexos: any[], maxPorArquivo = 4000, totalMax = 20000): Promise<{ nome: string; trecho: string }[]> {
  const out: { nome: string; trecho: string }[] = [];
  let acumulado = 0;
  for (const a of anexos.slice(0, 10)) {
    if (acumulado >= totalMax) break;
    if (a.tamanho && a.tamanho > 15 * 1024 * 1024) continue;
    const tipo = (a.tipo_arquivo ?? "").toLowerCase();
    const nome = (a.nome ?? "").toLowerCase();
    try {
      const { data: file } = await userClient.storage.from("projeto-anexos").download(a.storage_path);
      if (!file) continue;
      const buf = new Uint8Array(await file.arrayBuffer());
      let texto = "";
      if (tipo.includes("pdf") || nome.endsWith(".pdf")) {
        const mod = await import("https://esm.sh/pdfjs-serverless@0.5.0");
        const doc = await mod.getDocument({ data: buf, useSystemFonts: false }).promise;
        const numPages = Math.min(doc.numPages, 20);
        const partes: string[] = [];
        for (let i = 1; i <= numPages; i++) {
          const page = await doc.getPage(i);
          const content = await page.getTextContent();
          partes.push((content.items as any[]).map((it: any) => it.str).join(" "));
          if (partes.join(" ").length > maxPorArquivo) break;
        }
        texto = partes.join("\n");
      } else if (nome.endsWith(".csv") || tipo.includes("csv")) {
        texto = new TextDecoder().decode(buf);
      } else if (nome.endsWith(".xlsx") || tipo.includes("spreadsheet")) {
        const XLSX = await import("https://esm.sh/xlsx@0.18.5");
        const wb = XLSX.read(buf, { type: "array" });
        texto = wb.SheetNames.map((n: string) => `# ${n}\n${XLSX.utils.sheet_to_csv(wb.Sheets[n])}`).join("\n\n");
      } else if (tipo.startsWith("text/") || nome.endsWith(".txt") || nome.endsWith(".md")) {
        texto = new TextDecoder().decode(buf);
      } else {
        continue;
      }
      if (texto.length > maxPorArquivo) texto = texto.slice(0, maxPorArquivo) + "…";
      out.push({ nome: a.nome, trecho: texto });
      acumulado += texto.length;
    } catch (e) {
      logger.warn("[relatorio] falha ao ler anexo", a.nome, e);
    }
  }
  return out;
}

// =============== IA → ReportSpec ===============
const REPORT_SPEC_TOOL = {
  type: "function",
  function: {
    name: "render_report",
    description: "Produz a especificação estruturada do relatório que será desenhado.",
    parameters: {
      type: "object",
      properties: {
        titulo: { type: "string" },
        subtitulo: { type: "string" },
        resumo_executivo: { type: "string", description: "Texto curto, 2-4 parágrafos, em português, descrevendo o panorama. Markdown simples permitido." },
        blocks: {
          type: "array",
          minItems: 1,
          maxItems: 60,
          items: {
            oneOf: [
              { type: "object", properties: { kind: { const: "heading" }, level: { type: "integer", enum: [1, 2, 3] }, text: { type: "string" } }, required: ["kind", "level", "text"], additionalProperties: false },
              { type: "object", properties: { kind: { const: "paragraph" }, text: { type: "string" } }, required: ["kind", "text"], additionalProperties: false },
              { type: "object", properties: { kind: { const: "kpis" }, items: { type: "array", minItems: 1, maxItems: 16, items: { type: "object", properties: { label: { type: "string" }, value: {}, hint: { type: "string" } }, required: ["label", "value"], additionalProperties: false } } }, required: ["kind", "items"], additionalProperties: false },
              { type: "object", properties: { kind: { const: "table" }, columns: { type: "array", items: { type: "string" }, maxItems: 10 }, rows: { type: "array", maxItems: 200, items: { type: "array", items: {} } }, caption: { type: "string" } }, required: ["kind", "columns", "rows"], additionalProperties: false },
              { type: "object", properties: { kind: { const: "bar_chart" }, title: { type: "string" }, series: { type: "array", maxItems: 12, items: { type: "object", properties: { label: { type: "string" }, value: { type: "number" } }, required: ["label", "value"], additionalProperties: false } } }, required: ["kind", "title", "series"], additionalProperties: false },
              { type: "object", properties: { kind: { const: "pie_chart" }, title: { type: "string" }, series: { type: "array", maxItems: 8, items: { type: "object", properties: { label: { type: "string" }, value: { type: "number" } }, required: ["label", "value"], additionalProperties: false } } }, required: ["kind", "title", "series"], additionalProperties: false },
              { type: "object", properties: { kind: { const: "list" }, ordered: { type: "boolean" }, items: { type: "array", maxItems: 30, items: { type: "string" } } }, required: ["kind", "items"], additionalProperties: false },
              { type: "object", properties: { kind: { const: "callout" }, tone: { type: "string", enum: ["info", "warn", "success", "danger"] }, text: { type: "string" } }, required: ["kind", "tone", "text"], additionalProperties: false },
              { type: "object", properties: { kind: { const: "document_ref" }, nome: { type: "string" }, trecho: { type: "string" } }, required: ["kind", "nome", "trecho"], additionalProperties: false },
              { type: "object", properties: { kind: { const: "page_break" } }, required: ["kind"], additionalProperties: false },
            ],
          },
        },
      },
      required: ["titulo", "blocks"],
      additionalProperties: false,
    },
  },
};

async function buildSpecComIA(opts: {
  prompt: string;
  projetoNome: string;
  projetoDescricao?: string | null;
  tarefas: TarefaRow[];
  profMap: Map<string, string>;
  documentos: { nome: string; trecho: string }[];
}): Promise<ReportSpec | null> {
  const { prompt, projetoNome, projetoDescricao, tarefas, profMap, documentos } = opts;
  const m = metricas(tarefas);

  // Snapshot compacto de tarefas (até 120) para a IA filtrar/agregar como quiser
  const tarefasContext = tarefas.slice(0, 120).map(t => ({
    titulo: t.titulo,
    status: t.status,
    prioridade: t.prioridade,
    prazo: t.data_prazo,
    estagio: t.estagio ?? null,
    responsavel: t.responsavel_id ? (profMap.get(t.responsavel_id) ?? null) : null,
  }));

  const sys = `Você é um analista que produz relatórios dinâmicos para gestão de projetos.
Receba o pedido do usuário, os dados do projeto e (opcionalmente) trechos de documentos anexados.
Decida livremente a estrutura do relatório: capa, KPIs, tabelas específicas, gráficos, listas, callouts, citações de documentos.
Regra obrigatória: SEMPRE que houver dados quantitativos (tarefas, prazos, responsáveis, métricas), inclua um bloco "kpis" no início do relatório com 4 a 12 indicadores relevantes ao pedido (totais, percentuais, atrasos, distribuição). Use labels curtos e descritivos (até ~22 caracteres) para evitar quebra excessiva. Só omita KPIs se o pedido for puramente textual/qualitativo (ex.: leitura de documentos sem números).
NÃO use sempre o mesmo template — adapte ao pedido. Se o usuário pediu algo restrito (ex.: só atrasadas do João), foque APENAS nisso, mas ainda apresente os KPIs daquele recorte.
Responda APENAS chamando a tool render_report. Texto em português do Brasil. Datas em formato local. Não invente dados que não estão no contexto.`;

  const user = `# Pedido
${prompt}

# Projeto
Nome: ${projetoNome}
Descrição: ${projetoDescricao ?? "—"}

# Métricas agregadas
${JSON.stringify(m)}

# Tarefas (amostra de até 120)
${JSON.stringify(tarefasContext)}

# Documentos disponíveis (trechos)
${documentos.length === 0 ? "Nenhum documento anexado ou leitura não solicitada." :
      documentos.map(d => `## ${d.nome}\n${d.trecho.slice(0, 1500)}`).join("\n\n")}
`;

  const r = await callAIGateway({
    model: "openai/gpt-5.2",
    timeoutMs: 90_000,
    messages: [
      { role: "system", content: sys },
      { role: "user", content: user },
    ],
    tools: [REPORT_SPEC_TOOL],
    tool_choice: { type: "function", function: { name: "render_report" } },
  });

  if (r.kind !== "ok") {
    logger.warn("[relatorio] IA falhou:", r);
    return null;
  }

  const tc = r.data.choices?.[0]?.message?.tool_calls?.[0];
  const argsRaw = tc?.function?.arguments;
  if (!argsRaw) return null;
  try {
    const spec = JSON.parse(argsRaw) as ReportSpec;
    if (!spec.titulo || !Array.isArray(spec.blocks) || spec.blocks.length === 0) return null;
    return spec;
  } catch (e) {
    logger.error("[relatorio] JSON inválido da IA:", e);
    return null;
  }
}

// =============== Fallback ===============
function specFallback(projetoNome: string, tarefas: TarefaRow[], profMap: Map<string, string>): ReportSpec {
  const m = metricas(tarefas);
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const atrasadas = tarefas
    .filter(t => t.status !== "concluida" && t.data_prazo && new Date(t.data_prazo) < today)
    .sort((a, b) => (a.data_prazo ?? "").localeCompare(b.data_prazo ?? ""));

  const porResp = new Map<string, { total: number; concl: number; atr: number }>();
  for (const t of tarefas) {
    const k = t.responsavel_id ? (profMap.get(t.responsavel_id) ?? "—") : "Sem responsável";
    const c = porResp.get(k) ?? { total: 0, concl: 0, atr: 0 };
    c.total++;
    if (t.status === "concluida") c.concl++;
    if (t.status !== "concluida" && t.data_prazo && new Date(t.data_prazo) < today) c.atr++;
    porResp.set(k, c);
  }

  return {
    titulo: `Relatório de status — ${projetoNome}`,
    subtitulo: `Gerado automaticamente em ${new Date().toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" })}`,
    resumo_executivo: `O projeto possui ${m.total} tarefas, sendo ${m.concluidas} concluídas (${m.pct}%), ${m.em_andamento} em andamento e ${m.atrasadas} atrasadas.`,
    blocks: [
      { kind: "kpis", items: [
        { label: "Total", value: m.total },
        { label: "Concluídas", value: m.concluidas },
        { label: "Em andamento", value: m.em_andamento },
        { label: "Atrasadas", value: m.atrasadas },
        { label: "Sem responsável", value: m.sem_resp },
        { label: "% concluído", value: `${m.pct}%` },
      ]},
      { kind: "bar_chart", title: "Distribuição por status", series: [
        { label: "Concluídas", value: m.concluidas },
        { label: "Em andam.", value: m.em_andamento },
        { label: "Pendentes", value: Math.max(0, m.total - m.concluidas - m.em_andamento) },
        { label: "Atrasadas", value: m.atrasadas },
      ]},
      { kind: "heading", level: 2, text: "Carga por responsável" },
      { kind: "table",
        columns: ["Responsável", "Total", "Concluídas", "Atrasadas"],
        rows: Array.from(porResp.entries()).sort((a, b) => b[1].total - a[1].total).map(([n, v]) => [n, v.total, v.concl, v.atr]),
      },
      { kind: "heading", level: 2, text: "Tarefas atrasadas" },
      atrasadas.length === 0
        ? { kind: "callout", tone: "success", text: "Nenhuma tarefa atrasada no momento." }
        : { kind: "table", columns: ["Tarefa", "Prazo", "Responsável"],
            rows: atrasadas.slice(0, 60).map(t => [t.titulo, t.data_prazo ?? "—", t.responsavel_id ? (profMap.get(t.responsavel_id) ?? "—") : "Sem responsável"]) },
    ],
  };
}

// =============== Renderer PDF ===============
const PALETTE: [number, number, number][] = [
  [0.20, 0.40, 0.85], [0.20, 0.70, 0.45], [0.85, 0.65, 0.20],
  [0.85, 0.30, 0.30], [0.55, 0.35, 0.80], [0.20, 0.65, 0.75],
  [0.95, 0.55, 0.20], [0.45, 0.50, 0.55],
];

function wrapText(text: string, maxChars: number): string[] {
  const words = String(text ?? "").split(/\s+/);
  const lines: string[] = [];
  let cur = "";
  for (const w of words) {
    if ((cur + " " + w).trim().length > maxChars) {
      if (cur) lines.push(cur);
      cur = w.length > maxChars ? w.slice(0, maxChars - 1) + "…" : w;
    } else {
      cur = cur ? cur + " " + w : w;
    }
  }
  if (cur) lines.push(cur);
  return lines.length ? lines : [""];
}

function sanitizeText(s: string): string {
  // Helvetica/WinAnsi suporta Latin-1 + alguns símbolos. Normalizamos:
  // - remove emojis e marcas zero-width
  // - troca caracteres tipográficos comuns por equivalentes Latin-1
  // - remove markdown bold/itálico marcadores (a IA usa **texto**)
  return String(s ?? "")
    .replace(/\*\*(.+?)\*\*/g, "$1")          // **bold** -> bold
    .replace(/(^|\s)\*(.+?)\*(?=\s|$)/g, "$1$2") // *itálico*
    .replace(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/gu, "") // emojis
    .replace(/[\u200B-\u200F\uFEFF]/g, "")    // zero-width
    .replace(/[\u2018\u2019\u201A\u201B]/g, "'")
    .replace(/[\u201C\u201D\u201E\u201F]/g, '"')
    .replace(/[\u2013\u2014]/g, "-")          // – —
    .replace(/[\u2026]/g, "...")              // …
    .replace(/[\u00A0]/g, " ")
    .replace(/[\u2192\u2794]/g, "->")
    .replace(/[\u2022\u25CF\u25AA\u25AB]/g, "*"); // bullets
}

interface RenderCtx {
  pdf: PDFDocument;
  font: PDFFont;
  fontBold: PDFFont;
  page: PDFPage;
  W: number;
  H: number;
  y: number;
  marginX: number;
  marginBottom: number;
  projetoNome: string;
}

function newPage(ctx: RenderCtx) {
  ctx.page = ctx.pdf.addPage([595, 842]);
  ctx.W = ctx.page.getWidth();
  ctx.H = ctx.page.getHeight();
  ctx.y = ctx.H - 60;
}

function ensure(ctx: RenderCtx, need: number) {
  if (ctx.y - need < ctx.marginBottom) newPage(ctx);
}

function drawWrapped(ctx: RenderCtx, text: string, opts: { size?: number; bold?: boolean; color?: [number, number, number]; indent?: number; lineGap?: number; maxChars?: number } = {}) {
  const size = opts.size ?? 10;
  const bold = opts.bold ?? false;
  const color = opts.color ?? [0.10, 0.10, 0.15];
  const indent = opts.indent ?? 0;
  const lineGap = opts.lineGap ?? 4;
  const maxChars = opts.maxChars ?? Math.floor((ctx.W - ctx.marginX * 2 - indent) / (size * 0.55));
  const lines = wrapText(sanitizeText(text), maxChars);
  for (const ln of lines) {
    ensure(ctx, size + lineGap);
    ctx.page.drawText(ln, {
      x: ctx.marginX + indent,
      y: ctx.y - size,
      size,
      font: bold ? ctx.fontBold : ctx.font,
      color: rgb(color[0], color[1], color[2]),
    });
    ctx.y -= size + lineGap;
  }
}

function drawHeading(ctx: RenderCtx, level: 1 | 2 | 3, text: string) {
  const sizes = { 1: 18, 2: 14, 3: 12 } as const;
  ctx.y -= 6;
  ensure(ctx, sizes[level] + 8);
  drawWrapped(ctx, text, { size: sizes[level], bold: true, color: [0.05, 0.10, 0.40] });
  ctx.y -= 4;
}

function fitText(text: string, font: PDFFont, size: number, maxWidth: number): string {
  const t = sanitizeText(text);
  if (font.widthOfTextAtSize(t, size) <= maxWidth) return t;
  // binary search por número de caracteres
  let lo = 0, hi = t.length;
  while (lo < hi) {
    const mid = Math.floor((lo + hi + 1) / 2);
    const candidate = t.slice(0, mid) + "…";
    if (font.widthOfTextAtSize(candidate, size) <= maxWidth) lo = mid;
    else hi = mid - 1;
  }
  return t.slice(0, Math.max(1, lo)) + "…";
}

function wrapByWidth(text: string, font: PDFFont, size: number, maxWidth: number, maxLines = 2): string[] {
  const t = sanitizeText(text);
  const words = t.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let cur = "";
  for (const w of words) {
    const candidate = cur ? cur + " " + w : w;
    if (font.widthOfTextAtSize(candidate, size) <= maxWidth) {
      cur = candidate;
    } else {
      if (cur) lines.push(cur);
      // palavra única maior que a largura — força corte
      if (font.widthOfTextAtSize(w, size) > maxWidth) {
        cur = fitText(w, font, size, maxWidth);
      } else {
        cur = w;
      }
      if (lines.length === maxLines - 1) break;
    }
  }
  if (cur && lines.length < maxLines) lines.push(cur);
  // Se sobrou texto não consumido, marcar última linha com elipse cabível
  if (lines.length === maxLines) {
    const consumed = lines.join(" ");
    if (consumed.length < t.length) {
      lines[maxLines - 1] = fitText(lines[maxLines - 1] + " " + t.slice(consumed.length).trim(), font, size, maxWidth);
    }
  }
  return lines.length ? lines : [""];
}

function drawKPIs(ctx: RenderCtx, items: { label: string; value: any; hint?: string }[]) {
  if (!items || items.length === 0) return;
  ensure(ctx, 60);
  const usable = ctx.W - ctx.marginX * 2;
  const gap = 6;

  // Escolhe perRow para garantir largura mínima razoável por card.
  // Cards mais estreitos exigem labels mais curtas — buscamos ~110-130px de largura útil.
  const minCardW = 105;
  const maxPerRow = Math.max(1, Math.floor((usable + gap) / (minCardW + gap)));
  // Quantos por linha? Equilibra layout quando há poucos itens.
  const n = items.length;
  let perRow: number;
  if (n <= 4) perRow = n;
  else if (n <= 6) perRow = 3;
  else if (n <= 8) perRow = 4;
  else if (n <= 12) perRow = Math.min(6, maxPerRow);
  else perRow = Math.min(8, maxPerRow);
  perRow = Math.min(perRow, maxPerRow);

  const cardW = (usable - gap * (perRow - 1)) / perRow;
  const innerW = cardW - 12;

  let i = 0;
  while (i < items.length) {
    const row = items.slice(i, i + perRow);
    // Pré-calcular linhas de label e altura necessária por card da linha
    const cellMeta = row.map((c) => {
      const labelLines = wrapByWidth(c.label, ctx.font, 8, innerW, 2);
      const hintLines = c.hint ? wrapByWidth(c.hint, ctx.font, 7, innerW, 1) : [];
      return { labelLines, hintLines };
    });
    const maxLabelLines = Math.max(...cellMeta.map((m) => m.labelLines.length));
    const hasHint = cellMeta.some((m) => m.hintLines.length > 0);
    // Layout interno: padding-top 8 + valor 16 + 6 + label N*10 + (hint 9 se houver) + padding-bottom 6
    const cardH = 8 + 16 + 6 + maxLabelLines * 10 + (hasHint ? 9 : 0) + 6;

    ensure(ctx, cardH + gap);
    let x = ctx.marginX;
    for (let k = 0; k < row.length; k++) {
      const c = row[k];
      const meta = cellMeta[k];
      const top = ctx.y;
      ctx.page.drawRectangle({
        x, y: top - cardH, width: cardW, height: cardH,
        color: rgb(0.96, 0.97, 1), borderColor: rgb(0.85, 0.87, 0.95), borderWidth: 0.7,
      });
      // Valor
      const valStr = fitText(String(c.value ?? "-"), ctx.fontBold, 16, innerW);
      ctx.page.drawText(valStr, {
        x: x + 6, y: top - 8 - 16, size: 16, font: ctx.fontBold, color: rgb(0.10, 0.20, 0.50),
      });
      // Label (multilinha)
      let ly = top - 8 - 16 - 6 - 8; // baseline da 1ª linha do label
      for (const ln of meta.labelLines) {
        ctx.page.drawText(ln, { x: x + 6, y: ly, size: 8, font: ctx.font, color: rgb(0.4, 0.4, 0.5) });
        ly -= 10;
      }
      // Hint (1 linha)
      if (meta.hintLines.length > 0) {
        ctx.page.drawText(meta.hintLines[0], { x: x + 6, y: ly + 2, size: 7, font: ctx.font, color: rgb(0.55, 0.55, 0.60) });
      }
      x += cardW + gap;
    }
    ctx.y -= cardH + gap;
    i += perRow;
  }
  ctx.y -= 4;
}

function drawTable(ctx: RenderCtx, columns: string[], rows: any[][], caption?: string) {
  if (caption) drawWrapped(ctx, caption, { size: 9, color: [0.4, 0.4, 0.5] });
  const usable = ctx.W - ctx.marginX * 2;
  // Larguras proporcionais: dá mais espaço para a 1ª coluna se houver muitas
  const n = columns.length;
  const colWeights = columns.map((_, i) => i === 0 && n > 2 ? 2 : 1);
  const totalW = colWeights.reduce((a, b) => a + b, 0);
  const colWs = colWeights.map(w => (w / totalW) * usable);
  const colXs: number[] = [];
  let acc = ctx.marginX;
  for (const w of colWs) { colXs.push(acc); acc += w; }

  const headerH = 18, rowH = 14;
  ensure(ctx, headerH + rowH + 10);

  // Header
  ctx.page.drawRectangle({ x: ctx.marginX, y: ctx.y - headerH, width: usable, height: headerH, color: rgb(0.12, 0.18, 0.45) });
  columns.forEach((col, i) => {
    const t = fitText(col, ctx.fontBold, 9, colWs[i] - 8);
    ctx.page.drawText(t, { x: colXs[i] + 4, y: ctx.y - 13, size: 9, font: ctx.fontBold, color: rgb(1, 1, 1) });
  });
  ctx.y -= headerH;

  rows.forEach((row, idx) => {
    ensure(ctx, rowH);
    if (idx % 2 === 0) {
      ctx.page.drawRectangle({ x: ctx.marginX, y: ctx.y - rowH, width: usable, height: rowH, color: rgb(0.96, 0.96, 0.98) });
    }
    columns.forEach((_, i) => {
      const v = row[i];
      const txt = fitText(v == null ? "-" : String(v), ctx.font, 8, colWs[i] - 8);
      ctx.page.drawText(txt, { x: colXs[i] + 4, y: ctx.y - 10, size: 8, font: ctx.font, color: rgb(0.10, 0.10, 0.15) });
    });
    ctx.y -= rowH;
  });
  ctx.y -= 6;
}

function drawBarChart(ctx: RenderCtx, title: string, series: { label: string; value: number; color?: [number, number, number] }[]) {
  drawWrapped(ctx, title, { size: 11, bold: true });
  const chartH = 110;
  ensure(ctx, chartH + 30);
  const usable = ctx.W - ctx.marginX * 2;
  const n = Math.max(1, series.length);
  const gap = 10;
  const barW = Math.max(20, (usable - gap * (n - 1)) / n);
  const maxV = Math.max(1, ...series.map(s => s.value));
  const baseY = ctx.y - chartH;
  let x = ctx.marginX;
  series.forEach((s, i) => {
    const h = (s.value / maxV) * (chartH - 20);
    const c = s.color ?? PALETTE[i % PALETTE.length];
    ctx.page.drawRectangle({ x, y: baseY, width: barW, height: h, color: rgb(c[0], c[1], c[2]) });
    ctx.page.drawText(String(s.value), { x: x + 4, y: baseY + h + 3, size: 9, font: ctx.fontBold, color: rgb(0.1, 0.1, 0.15) });
    const lbl = sanitizeText(s.label).slice(0, Math.floor(barW / 4));
    ctx.page.drawText(lbl, { x, y: baseY - 12, size: 8, font: ctx.font, color: rgb(0.3, 0.3, 0.4) });
    x += barW + gap;
  });
  ctx.y = baseY - 24;
}

function drawPieChart(ctx: RenderCtx, title: string, series: { label: string; value: number }[]) {
  // PDF-lib não tem arc; renderizamos legenda + barra empilhada horizontal como aproximação visual
  drawWrapped(ctx, title, { size: 11, bold: true });
  const total = series.reduce((s, x) => s + (x.value || 0), 0) || 1;
  const usable = ctx.W - ctx.marginX * 2;
  const barH = 18;
  ensure(ctx, barH + series.length * 12 + 16);
  let x = ctx.marginX;
  series.forEach((s, i) => {
    const w = (s.value / total) * usable;
    const c = PALETTE[i % PALETTE.length];
    ctx.page.drawRectangle({ x, y: ctx.y - barH, width: w, height: barH, color: rgb(c[0], c[1], c[2]) });
    x += w;
  });
  ctx.y -= barH + 6;
  series.forEach((s, i) => {
    ensure(ctx, 12);
    const c = PALETTE[i % PALETTE.length];
    ctx.page.drawRectangle({ x: ctx.marginX, y: ctx.y - 8, width: 8, height: 8, color: rgb(c[0], c[1], c[2]) });
    const pct = Math.round((s.value / total) * 100);
    ctx.page.drawText(sanitizeText(`${s.label} — ${s.value} (${pct}%)`), {
      x: ctx.marginX + 14, y: ctx.y - 8, size: 9, font: ctx.font, color: rgb(0.2, 0.2, 0.3),
    });
    ctx.y -= 12;
  });
  ctx.y -= 4;
}

function drawCallout(ctx: RenderCtx, tone: "info" | "warn" | "success" | "danger", text: string) {
  const colors: Record<string, { bg: [number, number, number]; border: [number, number, number]; fg: [number, number, number] }> = {
    info: { bg: [0.93, 0.95, 1], border: [0.6, 0.7, 0.95], fg: [0.10, 0.20, 0.50] },
    warn: { bg: [1, 0.97, 0.86], border: [0.9, 0.75, 0.3], fg: [0.5, 0.35, 0.05] },
    success: { bg: [0.90, 0.97, 0.92], border: [0.4, 0.75, 0.5], fg: [0.10, 0.40, 0.20] },
    danger: { bg: [1, 0.93, 0.93], border: [0.85, 0.4, 0.4], fg: [0.55, 0.10, 0.10] },
  };
  const c = colors[tone];
  const usable = ctx.W - ctx.marginX * 2;
  const maxChars = Math.floor((usable - 16) / 5.5);
  const lines = wrapText(sanitizeText(text), maxChars);
  const h = lines.length * 12 + 12;
  ensure(ctx, h + 6);
  ctx.page.drawRectangle({
    x: ctx.marginX, y: ctx.y - h, width: usable, height: h,
    color: rgb(c.bg[0], c.bg[1], c.bg[2]), borderColor: rgb(c.border[0], c.border[1], c.border[2]), borderWidth: 0.8,
  });
  let yy = ctx.y - 14;
  for (const ln of lines) {
    ctx.page.drawText(ln, { x: ctx.marginX + 8, y: yy, size: 9, font: ctx.fontBold, color: rgb(c.fg[0], c.fg[1], c.fg[2]) });
    yy -= 12;
  }
  ctx.y -= h + 6;
}

function drawDocumentRef(ctx: RenderCtx, nome: string, trecho: string) {
  drawWrapped(ctx, `Documento: ${nome}`, { size: 10, bold: true, color: [0.30, 0.20, 0.05] });
  drawWrapped(ctx, `"${trecho.slice(0, 600)}${trecho.length > 600 ? "…" : ""}"`, { size: 9, color: [0.30, 0.30, 0.35], indent: 12 });
  ctx.y -= 4;
}

async function renderPdf(spec: ReportSpec, projetoNome: string): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const fontBold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const ctx: RenderCtx = {
    pdf, font, fontBold,
    page: pdf.addPage([595, 842]),
    W: 595, H: 842, y: 842 - 60, marginX: 50, marginBottom: 50, projetoNome,
  };
  ctx.W = ctx.page.getWidth(); ctx.H = ctx.page.getHeight();

  // Capa
  drawWrapped(ctx, spec.titulo, { size: 22, bold: true, color: [0.05, 0.10, 0.40] });
  if (spec.subtitulo) drawWrapped(ctx, spec.subtitulo, { size: 12, color: [0.4, 0.4, 0.5] });
  drawWrapped(ctx, `Gerado em ${new Date().toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" })}`,
    { size: 9, color: [0.5, 0.5, 0.6] });
  ctx.y -= 8;
  if (spec.resumo_executivo) {
    drawHeading(ctx, 2, "Resumo executivo");
    drawWrapped(ctx, spec.resumo_executivo, { size: 10 });
    ctx.y -= 6;
  }

  for (const b of spec.blocks) {
    switch (b.kind) {
      case "heading": drawHeading(ctx, b.level, b.text); break;
      case "paragraph": drawWrapped(ctx, b.text, { size: 10 }); ctx.y -= 4; break;
      case "kpis": drawKPIs(ctx, b.items); break;
      case "table": drawTable(ctx, b.columns, b.rows, b.caption); break;
      case "bar_chart": drawBarChart(ctx, b.title, b.series); break;
      case "pie_chart": drawPieChart(ctx, b.title, b.series); break;
      case "list":
        for (let i = 0; i < b.items.length; i++) {
          const prefix = b.ordered ? `${i + 1}. ` : "• ";
          drawWrapped(ctx, prefix + b.items[i], { size: 10, indent: 4 });
        }
        ctx.y -= 4;
        break;
      case "callout": drawCallout(ctx, b.tone, b.text); break;
      case "document_ref": drawDocumentRef(ctx, b.nome, b.trecho); break;
      case "page_break": newPage(ctx); break;
    }
  }

  // Rodapé
  const pages = pdf.getPages();
  pages.forEach((p, i) => {
    p.drawText(`Página ${i + 1} de ${pages.length}`, { x: 480, y: 30, size: 8, font, color: rgb(0.5, 0.5, 0.6) });
    p.drawText(sanitizeText(projetoNome).slice(0, 60), { x: 50, y: 30, size: 8, font, color: rgb(0.5, 0.5, 0.6) });
  });
  return await pdf.save();
}

// =============== Renderer XLSX ===============
async function renderXlsx(spec: ReportSpec, projetoNome: string): Promise<Uint8Array> {
  const ExcelJS: any = await import("https://esm.sh/exceljs@4.4.0?target=denonext");
  const wb = new ExcelJS.Workbook();
  wb.creator = "Copiloto de Projetos";
  wb.created = new Date();

  // Aba 1: Resumo (capa + textos + KPIs + listas + callouts + docs)
  const s1 = wb.addWorksheet("Resumo");
  s1.addRow([spec.titulo]);
  if (spec.subtitulo) s1.addRow([spec.subtitulo]);
  s1.addRow(["Projeto", projetoNome]);
  s1.addRow(["Gerado em", new Date().toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" })]);
  s1.addRow([]);
  if (spec.resumo_executivo) {
    s1.addRow(["Resumo executivo"]);
    s1.addRow([spec.resumo_executivo]);
    s1.addRow([]);
  }
  s1.getRow(1).font = { bold: true, size: 16 };
  s1.columns = [{ width: 40 }, { width: 60 }];

  // Tabelas, KPIs e charts viram abas separadas
  let tableCount = 0, kpiCount = 0, chartCount = 0;
  for (const b of spec.blocks) {
    if (b.kind === "table") {
      tableCount++;
      const sh = wb.addWorksheet(`Tabela ${tableCount}`.slice(0, 31));
      if (b.caption) { sh.addRow([b.caption]); sh.getRow(1).font = { bold: true, italic: true }; sh.addRow([]); }
      const headerRow = sh.addRow(b.columns);
      headerRow.font = { bold: true };
      headerRow.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1F2E73" } };
      headerRow.font = { bold: true, color: { argb: "FFFFFFFF" } };
      for (const r of b.rows) sh.addRow(r);
      sh.columns = b.columns.map(() => ({ width: 22 }));
    } else if (b.kind === "kpis") {
      kpiCount++;
      s1.addRow([`KPIs ${kpiCount}`]);
      s1.lastRow!.font = { bold: true };
      s1.addRow(["Indicador", "Valor", "Observação"]);
      s1.lastRow!.font = { bold: true };
      for (const k of b.items) s1.addRow([k.label, k.value, k.hint ?? ""]);
      s1.addRow([]);
    } else if (b.kind === "bar_chart" || b.kind === "pie_chart") {
      chartCount++;
      const sh = wb.addWorksheet(`Gráfico ${chartCount}`.slice(0, 31));
      sh.addRow([b.title]);
      sh.getRow(1).font = { bold: true };
      sh.addRow(["Categoria", "Valor"]);
      sh.lastRow!.font = { bold: true };
      for (const s of b.series) sh.addRow([s.label, s.value]);
      sh.columns = [{ width: 30 }, { width: 14 }];
    } else if (b.kind === "list") {
      s1.addRow([]);
      for (let i = 0; i < b.items.length; i++) {
        s1.addRow([b.ordered ? `${i + 1}. ${b.items[i]}` : `• ${b.items[i]}`]);
      }
    } else if (b.kind === "callout") {
      s1.addRow([`[${b.tone.toUpperCase()}] ${b.text}`]);
    } else if (b.kind === "document_ref") {
      s1.addRow([`📄 ${b.nome}`, b.trecho.slice(0, 800)]);
    } else if (b.kind === "heading") {
      s1.addRow([b.text]);
      s1.lastRow!.font = { bold: true, size: b.level === 1 ? 14 : b.level === 2 ? 12 : 11 };
    } else if (b.kind === "paragraph") {
      s1.addRow([b.text]);
    }
  }

  const buf = await wb.xlsx.writeBuffer();
  return new Uint8Array(buf);
}

// =============== Handler ===============
Deno.serve(secureHandler(
  { auth: "jwt", rateLimit: 10, rateLimitPrefix: "projeto-copilot-relatorio" },
  async (req, ctx) => {
    const corsHeaders = getCorsHeaders(req);
    const parsed = Body.safeParse(await req.json());
    if (!parsed.success) {
      return new Response(JSON.stringify({ error: parsed.error.flatten() }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const { projeto_id, thread_id, tipo, formato, prompt, incluir_documentos } = parsed.data;
    const userId = ctx.userId!;
    const authHeader = req.headers.get("Authorization") ?? "";
    const userClient = createClient(SUPABASE_URL, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });
    const admin = createClient(SUPABASE_URL, SERVICE_KEY);

    const { data: hasAccess } = await admin.rpc("user_can_access_projeto", {
      _user_id: userId, _projeto_id: projeto_id,
    });
    if (!hasAccess) {
      return new Response(JSON.stringify({ error: "Sem acesso a este projeto." }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Determina o pedido efetivo
    const pedidoEfetivo = prompt?.trim() || (
      tipo === "responsaveis" ? "Relatório com a carga de trabalho por responsável, destacando atrasos e desbalanceamentos." :
      tipo === "executivo" ? "Resumo executivo do projeto: visão geral, principais riscos, recomendações e próximos passos." :
      "Relatório de status do projeto com KPIs, distribuição por status e tarefas atrasadas."
    );
    const tipoRegistro = (prompt && prompt.trim()) ? "dinamico" : (tipo ?? "status");

    const { data: rel, error: relErr } = await admin
      .from("projeto_copilot_relatorios")
      .insert({ projeto_id, user_id: userId, thread_id, tipo: tipoRegistro, formato, status: "pending" })
      .select("id").single();
    if (relErr) {
      return new Response(JSON.stringify({ error: relErr.message }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const relId = rel.id as string;

    try {
      const { projeto, tarefas, profMap, anexos } = await loadContexto(userClient, projeto_id);
      const projetoNome = projeto?.nome ?? "Projeto";

      // Decide se vai ler documentos
      const docsParaIA = incluir_documentos
        ? await lerAnexos(userClient, anexos)
        : [];

      // Tenta IA → fallback
      let spec = await buildSpecComIA({
        prompt: pedidoEfetivo,
        projetoNome,
        projetoDescricao: projeto?.descricao,
        tarefas, profMap,
        documentos: docsParaIA,
      });
      let usouFallback = false;
      if (!spec) {
        spec = specFallback(projetoNome, tarefas, profMap);
        usouFallback = true;
      }

      const ext = formato === "pdf" ? "pdf" : "xlsx";
      const path = `${userId}/${projeto_id}/${relId}.${ext}`;
      const bytes = formato === "pdf"
        ? await renderPdf(spec, projetoNome)
        : await renderXlsx(spec, projetoNome);

      const contentType = formato === "pdf"
        ? "application/pdf"
        : "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

      const { error: upErr } = await admin.storage.from("projeto-relatorios")
        .upload(path, bytes, { contentType, upsert: true });
      if (upErr) throw upErr;

      const titulo = spec.titulo || projetoNome;
      const safeTitulo = titulo.replace(/[^a-z0-9]+/gi, "_").slice(0, 60);

      await admin.from("projeto_copilot_relatorios").update({
        status: "done",
        storage_path: path,
        metadata: {
          tarefas_total: tarefas.length,
          projeto_nome: projetoNome,
          prompt: pedidoEfetivo,
          incluiu_documentos: docsParaIA.length,
          usou_fallback: usouFallback,
          titulo,
          blocos: spec.blocks.length,
        },
      }).eq("id", relId);

      const { data: signed } = await admin.storage.from("projeto-relatorios")
        .createSignedUrl(path, 60 * 10);

      return new Response(JSON.stringify({
        ok: true, relatorio_id: relId, storage_path: path, signed_url: signed?.signedUrl,
        nome_arquivo: `${safeTitulo}.${ext}`,
        titulo,
        usou_fallback: usouFallback,
      }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    } catch (e: any) {
      logger.error("relatorio error", e);
      await admin.from("projeto_copilot_relatorios").update({
        status: "failed", erro: e?.message ?? "erro desconhecido",
      }).eq("id", relId);
      return new Response(JSON.stringify({ error: e?.message ?? "Falha ao gerar relatório." }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
  }
));
