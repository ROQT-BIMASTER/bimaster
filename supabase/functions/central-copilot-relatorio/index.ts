// central-copilot-relatorio — relatório dinâmico cross-projeto sobre o trabalho do USUÁRIO.
// Reaproveita o renderer do projeto-copilot-relatorio via cópia mínima para evitar acoplamento.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { z } from "https://esm.sh/zod@3.23.8";
import { secureHandler } from "../_shared/secure-handler.ts";
import { getCorsHeaders } from "../_shared/cors.ts";
import { callAIGateway } from "../_shared/ai-gateway-call.ts";
import { PDFDocument, StandardFonts, rgb } from "https://esm.sh/pdf-lib@1.17.1";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const Body = z.object({
  thread_id: z.string().uuid().optional(),
  formato: z.enum(["pdf", "xlsx"]),
  prompt: z.string().min(1).max(4000),
  escopo_dias: z.number().int().min(1).max(90).optional(),
}).strict();

type Block =
  | { kind: "heading"; level: 1 | 2 | 3; text: string }
  | { kind: "paragraph"; text: string }
  | { kind: "kpis"; items: { label: string; value: string | number; hint?: string }[] }
  | { kind: "table"; columns: string[]; rows: (string | number | null)[][]; caption?: string }
  | { kind: "list"; ordered?: boolean; items: string[] }
  | { kind: "callout"; tone: "info" | "warn" | "success" | "danger"; text: string };

interface ReportSpec {
  titulo: string;
  subtitulo?: string;
  resumo_executivo?: string;
  blocks: Block[];
}

const SPEC_TOOL = {
  type: "function",
  function: {
    name: "render_report",
    description: "Produz a especificação estruturada do relatório pessoal.",
    parameters: {
      type: "object",
      properties: {
        titulo: { type: "string" },
        subtitulo: { type: "string" },
        resumo_executivo: { type: "string" },
        blocks: {
          type: "array", minItems: 1, maxItems: 60,
          items: {
            oneOf: [
              { type: "object", properties: { kind: { const: "heading" }, level: { type: "integer", enum: [1,2,3] }, text: { type: "string" } }, required: ["kind","level","text"], additionalProperties: false },
              { type: "object", properties: { kind: { const: "paragraph" }, text: { type: "string" } }, required: ["kind","text"], additionalProperties: false },
              { type: "object", properties: { kind: { const: "kpis" }, items: { type: "array", minItems: 1, maxItems: 16, items: { type: "object", properties: { label: { type: "string" }, value: {}, hint: { type: "string" } }, required: ["label","value"], additionalProperties: false } } }, required: ["kind","items"], additionalProperties: false },
              { type: "object", properties: { kind: { const: "table" }, columns: { type: "array", items: { type: "string" }, maxItems: 10 }, rows: { type: "array", maxItems: 200, items: { type: "array", items: {} } }, caption: { type: "string" } }, required: ["kind","columns","rows"], additionalProperties: false },
              { type: "object", properties: { kind: { const: "list" }, ordered: { type: "boolean" }, items: { type: "array", maxItems: 50, items: { type: "string" } } }, required: ["kind","items"], additionalProperties: false },
              { type: "object", properties: { kind: { const: "callout" }, tone: { type: "string", enum: ["info","warn","success","danger"] }, text: { type: "string" } }, required: ["kind","tone","text"], additionalProperties: false },
            ],
          },
        },
      },
      required: ["titulo","blocks"],
      additionalProperties: false,
    },
  },
};

function sanitizeText(s: string): string {
  return String(s ?? "")
    .replace(/\*\*(.+?)\*\*/g, "$1")
    .replace(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/gu, "")
    .replace(/[\u200B-\u200F\uFEFF]/g, "")
    .replace(/[\u2018\u2019]/g, "'").replace(/[\u201C\u201D]/g, '"')
    .replace(/[\u2013\u2014]/g, "-").replace(/[\u2026]/g, "...")
    .replace(/[\u00A0]/g, " ").replace(/[\u2192]/g, "->");
}

function wrapByChars(text: string, max: number): string[] {
  const words = String(text ?? "").split(/\s+/);
  const lines: string[] = [];
  let cur = "";
  for (const w of words) {
    if ((cur + " " + w).trim().length > max) { if (cur) lines.push(cur); cur = w; } else { cur = cur ? cur+" "+w : w; }
  }
  if (cur) lines.push(cur);
  return lines.length ? lines : [""];
}

async function renderPdf(spec: ReportSpec): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const fontBold = await pdf.embedFont(StandardFonts.HelveticaBold);
  let page = pdf.addPage([595, 842]);
  let y = 800;
  const left = 40;
  const right = 555;
  const newPage = () => { page = pdf.addPage([595,842]); y = 800; };
  const ensure = (h: number) => { if (y - h < 40) newPage(); };

  const title = sanitizeText(spec.titulo);
  page.drawText(title, { x: left, y, size: 18, font: fontBold, color: rgb(0.1,0.1,0.3) });
  y -= 24;
  if (spec.subtitulo) { page.drawText(sanitizeText(spec.subtitulo), { x: left, y, size: 10, font, color: rgb(0.4,0.4,0.4) }); y -= 16; }
  if (spec.resumo_executivo) {
    y -= 4;
    for (const ln of wrapByChars(sanitizeText(spec.resumo_executivo), 95)) { ensure(14); page.drawText(ln, { x: left, y, size: 10, font }); y -= 13; }
  }
  y -= 10;

  for (const b of spec.blocks) {
    if (b.kind === "heading") {
      ensure(24); y -= 8;
      page.drawText(sanitizeText(b.text), { x: left, y, size: b.level === 1 ? 14 : b.level === 2 ? 12 : 11, font: fontBold });
      y -= 18;
    } else if (b.kind === "paragraph") {
      for (const ln of wrapByChars(sanitizeText(b.text), 95)) { ensure(14); page.drawText(ln, { x: left, y, size: 10, font }); y -= 13; }
      y -= 4;
    } else if (b.kind === "kpis") {
      const cols = Math.min(4, b.items.length);
      const cellW = (right - left) / cols;
      const rows = Math.ceil(b.items.length / cols);
      for (let r = 0; r < rows; r++) {
        ensure(48);
        for (let c = 0; c < cols; c++) {
          const idx = r*cols+c; if (idx >= b.items.length) break;
          const it = b.items[idx];
          const x = left + c*cellW;
          page.drawRectangle({ x, y: y-44, width: cellW-6, height: 42, borderColor: rgb(0.85,0.85,0.9), borderWidth: 0.5, color: rgb(0.97,0.97,1) });
          page.drawText(sanitizeText(String(it.value ?? "")).slice(0,18), { x: x+8, y: y-22, size: 14, font: fontBold });
          for (const [i, ln] of wrapByChars(sanitizeText(it.label), Math.floor((cellW-16)/4)).slice(0,2).entries()) {
            page.drawText(ln, { x: x+8, y: y-34-i*9, size: 8, font, color: rgb(0.4,0.4,0.45) });
          }
        }
        y -= 50;
      }
    } else if (b.kind === "table") {
      ensure(40);
      if (b.caption) { page.drawText(sanitizeText(b.caption), { x: left, y, size: 9, font, color: rgb(0.4,0.4,0.4) }); y -= 12; }
      const cols = b.columns.length;
      const cellW = (right - left) / cols;
      page.drawRectangle({ x: left, y: y-14, width: right-left, height: 14, color: rgb(0.13,0.18,0.45) });
      for (let i = 0; i < cols; i++) {
        page.drawText(sanitizeText(b.columns[i]).slice(0, Math.floor(cellW/5)), { x: left+i*cellW+4, y: y-10, size: 9, font: fontBold, color: rgb(1,1,1) });
      }
      y -= 16;
      for (const row of b.rows.slice(0, 60)) {
        ensure(14);
        for (let i = 0; i < cols; i++) {
          page.drawText(sanitizeText(String(row[i] ?? "")).slice(0, Math.floor(cellW/5)), { x: left+i*cellW+4, y, size: 9, font });
        }
        page.drawLine({ start: { x: left, y: y-2 }, end: { x: right, y: y-2 }, thickness: 0.3, color: rgb(0.85,0.85,0.9) });
        y -= 14;
      }
      y -= 6;
    } else if (b.kind === "list") {
      for (const [i, it] of b.items.entries()) {
        const prefix = b.ordered ? `${i+1}. ` : "• ";
        for (const ln of wrapByChars(prefix + sanitizeText(it), 92)) { ensure(13); page.drawText(ln, { x: left, y, size: 10, font }); y -= 12; }
      }
      y -= 4;
    } else if (b.kind === "callout") {
      const colors: Record<string, [number,number,number]> = {
        info: [0.85,0.92,1], warn: [1,0.95,0.8], success: [0.85,1,0.9], danger: [1,0.85,0.85],
      };
      const [r1,g1,bl] = colors[b.tone] ?? [0.95,0.95,0.95];
      const lines = wrapByChars(sanitizeText(b.text), 90);
      const h = 12 + lines.length*12;
      ensure(h+4);
      page.drawRectangle({ x: left, y: y-h, width: right-left, height: h, color: rgb(r1,g1,bl) });
      let yy = y-12;
      for (const ln of lines) { page.drawText(ln, { x: left+8, y: yy, size: 10, font }); yy -= 12; }
      y -= h+4;
    }
  }

  return await pdf.save();
}

async function renderXlsx(spec: ReportSpec): Promise<Uint8Array> {
  const ExcelJS: any = await import("https://esm.sh/exceljs@4.4.0");
  const wb = new ExcelJS.Workbook();
  const s1 = wb.addWorksheet("Resumo");
  s1.addRow([spec.titulo]); s1.lastRow!.font = { bold: true, size: 14 };
  if (spec.subtitulo) s1.addRow([spec.subtitulo]);
  if (spec.resumo_executivo) { s1.addRow([]); s1.addRow([spec.resumo_executivo]); s1.lastRow!.alignment = { wrapText: true }; }
  s1.addRow([]);
  s1.columns = [{ width: 80 }];
  let tableCount = 0;
  for (const b of spec.blocks) {
    if (b.kind === "table") {
      tableCount++;
      const sh = wb.addWorksheet(`Tabela ${tableCount}`.slice(0,31));
      const headerRow = sh.addRow(b.columns);
      headerRow.font = { bold: true, color: { argb: "FFFFFFFF" } };
      headerRow.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1F2E73" } };
      for (const r of b.rows) sh.addRow(r);
      sh.columns = b.columns.map(() => ({ width: 22 }));
    } else if (b.kind === "kpis") {
      s1.addRow(["KPIs"]); s1.lastRow!.font = { bold: true };
      s1.addRow(["Indicador","Valor","Observação"]); s1.lastRow!.font = { bold: true };
      for (const k of b.items) s1.addRow([k.label, k.value, k.hint ?? ""]);
      s1.addRow([]);
    } else if (b.kind === "list") {
      for (let i = 0; i < b.items.length; i++) s1.addRow([b.ordered ? `${i+1}. ${b.items[i]}` : `• ${b.items[i]}`]);
    } else if (b.kind === "callout") {
      s1.addRow([`[${b.tone.toUpperCase()}] ${b.text}`]);
    } else if (b.kind === "heading") {
      s1.addRow([b.text]); s1.lastRow!.font = { bold: true, size: b.level === 1 ? 14 : b.level === 2 ? 12 : 11 };
    } else if (b.kind === "paragraph") {
      s1.addRow([b.text]);
    }
  }
  const buf = await wb.xlsx.writeBuffer();
  return new Uint8Array(buf);
}

function specFallback(metricas: any, tarefasPorProjeto: any[], atrasadas: any[]): ReportSpec {
  return {
    titulo: "Meu painel de trabalho",
    subtitulo: `Gerado em ${new Date().toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" })}`,
    resumo_executivo: `Você tem ${metricas.total_minhas} tarefas, sendo ${metricas.atrasadas} atrasadas, ${metricas.hoje} para hoje e ${metricas.prox_7_dias} nos próximos 7 dias.`,
    blocks: [
      { kind: "kpis", items: [
        { label: "Total minhas", value: metricas.total_minhas },
        { label: "Atrasadas", value: metricas.atrasadas },
        { label: "Hoje", value: metricas.hoje },
        { label: "Próx. 7 dias", value: metricas.prox_7_dias },
        { label: "Concluídas", value: metricas.concluidas },
        { label: "Inbox pendente", value: metricas.inbox_pendente },
      ]},
      { kind: "heading", level: 2, text: "Por projeto" },
      { kind: "table", columns: ["Projeto","Total","Atrasadas"], rows: tarefasPorProjeto.map(p => [p.nome, p.total, p.atrasadas]) },
      { kind: "heading", level: 2, text: "Atrasadas" },
      atrasadas.length === 0
        ? { kind: "callout", tone: "success", text: "Nenhuma tarefa atrasada." } as Block
        : { kind: "table", columns: ["Tarefa","Projeto","Prazo"], rows: atrasadas.slice(0,40).map(a => [a.titulo, a.projeto_nome, a.data_prazo]) },
    ],
  };
}

Deno.serve(secureHandler(
  { auth: "jwt", rateLimit: 10, rateLimitPrefix: "central-copilot-relatorio" },
  async (req, ctx) => {
    const corsHeaders = getCorsHeaders(req);
    const parsed = Body.safeParse(await req.json());
    if (!parsed.success) {
      return new Response(JSON.stringify({ error: parsed.error.flatten() }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const { thread_id, formato, prompt, escopo_dias } = parsed.data;
    const userId = ctx.userId!;
    const authHeader = req.headers.get("Authorization") ?? "";
    const userClient = createClient(SUPABASE_URL, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });
    const admin = createClient(SUPABASE_URL, SERVICE_KEY);
    const dias = escopo_dias ?? 7;

    const { data: rel, error: relErr } = await admin
      .from("central_copilot_relatorios")
      .insert({ user_id: userId, thread_id, tipo: "dinamico", formato, status: "pending" })
      .select("id").single();
    if (relErr) {
      return new Response(JSON.stringify({ error: relErr.message }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const relId = rel.id as string;

    try {
      const today = new Date().toISOString().slice(0,10);
      const ate = new Date(); ate.setDate(ate.getDate() + dias);
      const ateStr = ate.toISOString().slice(0,10);

      // Carrega contexto pessoal cross-projeto
      const { data: minhas } = await userClient.from("projeto_tarefas")
        .select("id,titulo,status,prioridade,data_prazo,projeto_id,responsavel_id,criador_id, projetos:projeto_id(nome)")
        .or(`responsavel_id.eq.${userId},criador_id.eq.${userId}`)
        .is("excluida_em", null).limit(500);

      const list = (minhas ?? []) as any[];
      const total = list.length;
      const concluidas = list.filter(t => t.status === "concluida").length;
      const atrasadasArr = list.filter(t => t.status !== "concluida" && t.data_prazo && t.data_prazo < today)
        .map(t => ({ titulo: t.titulo, projeto_nome: t.projetos?.nome ?? "—", data_prazo: t.data_prazo }));
      const hoje = list.filter(t => t.status !== "concluida" && t.data_prazo === today).length;
      const semana = list.filter(t => t.status !== "concluida" && t.data_prazo && t.data_prazo >= today && t.data_prazo <= ateStr).length;
      const { count: inboxCount } = await userClient.from("inbox_items")
        .select("id", { count: "exact", head: true }).is("resolvido_em", null).is("arquivado_em", null);

      const metricas = {
        total_minhas: total, concluidas, atrasadas: atrasadasArr.length,
        hoje, prox_7_dias: semana, inbox_pendente: inboxCount ?? 0,
      };

      const porProjMap = new Map<string, { nome: string; total: number; atrasadas: number }>();
      for (const t of list) {
        const k = t.projeto_id; if (!k) continue;
        const nome = t.projetos?.nome ?? "—";
        const cur = porProjMap.get(k) ?? { nome, total: 0, atrasadas: 0 };
        cur.total++;
        if (t.status !== "concluida" && t.data_prazo && t.data_prazo < today) cur.atrasadas++;
        porProjMap.set(k, cur);
      }
      const porProjeto = Array.from(porProjMap.values()).sort((a,b)=>b.total-a.total);

      // Snapshot compacto
      const tarefasContext = list.slice(0, 150).map(t => ({
        titulo: t.titulo, projeto: t.projetos?.nome, status: t.status,
        prioridade: t.prioridade, prazo: t.data_prazo,
        sou_responsavel: t.responsavel_id === userId,
        sou_criador: t.criador_id === userId,
      }));

      const sys = `Você produz relatórios PESSOAIS dinâmicos para o usuário (multi-projeto).
Decida livremente a estrutura: KPIs, tabelas, listas, callouts. SEMPRE inclua um bloco "kpis" no início (4-12 indicadores) quando houver dados quantitativos.
Adapte ao pedido. Use português do Brasil. Não invente dados.
Responda APENAS chamando a tool render_report.`;

      const userMsg = `# Pedido
${prompt}

# Janela
Hoje: ${today} · até ${ateStr} (${dias} dias)

# Métricas pessoais
${JSON.stringify(metricas)}

# Por projeto
${JSON.stringify(porProjeto)}

# Tarefas (amostra de até 150)
${JSON.stringify(tarefasContext)}
`;

      const r = await callAIGateway({
        model: "openai/gpt-5.2", timeoutMs: 90_000,
        messages: [{ role: "system", content: sys }, { role: "user", content: userMsg }],
        tools: [SPEC_TOOL],
        tool_choice: { type: "function", function: { name: "render_report" } },
      });

      let spec: ReportSpec | null = null;
      let usouFallback = false;
      if (r.kind === "ok") {
        const tc = r.data.choices?.[0]?.message?.tool_calls?.[0];
        try { spec = tc?.function?.arguments ? JSON.parse(tc.function.arguments) : null; } catch { spec = null; }
        if (!spec || !spec.titulo || !Array.isArray(spec.blocks) || spec.blocks.length === 0) spec = null;
      }
      if (!spec) { spec = specFallback(metricas, porProjeto, atrasadasArr); usouFallback = true; }

      const ext = formato === "pdf" ? "pdf" : "xlsx";
      const path = `${userId}/central/${relId}.${ext}`;
      const bytes = formato === "pdf" ? await renderPdf(spec) : await renderXlsx(spec);
      const contentType = formato === "pdf"
        ? "application/pdf"
        : "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

      const { error: upErr } = await admin.storage.from("projeto-relatorios")
        .upload(path, bytes, { contentType, upsert: true });
      if (upErr) throw upErr;

      const titulo = spec.titulo;
      const safeTitulo = titulo.replace(/[^a-z0-9]+/gi, "_").slice(0, 60);

      await admin.from("central_copilot_relatorios").update({
        status: "done", storage_path: path,
        metadata: {
          tarefas_total: list.length, prompt, escopo_dias: dias,
          usou_fallback: usouFallback, titulo, blocos: spec.blocks.length,
        },
      }).eq("id", relId);

      const { data: signed } = await admin.storage.from("projeto-relatorios").createSignedUrl(path, 600);
      return new Response(JSON.stringify({
        ok: true, relatorio_id: relId, storage_path: path, signed_url: signed?.signedUrl,
        nome_arquivo: `${safeTitulo}.${ext}`, titulo, usou_fallback: usouFallback,
      }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    } catch (e: any) {
      console.error("central-relatorio error", e);
      await admin.from("central_copilot_relatorios").update({
        status: "failed", erro: e?.message ?? "erro desconhecido",
      }).eq("id", relId);
      return new Response(JSON.stringify({ error: e?.message ?? "Falha ao gerar relatório." }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
  }
));
