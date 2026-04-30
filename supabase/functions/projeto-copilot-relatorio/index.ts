// projeto-copilot-relatorio — Fase 3
// Gera relatório PDF (pdf-lib) ou XLSX (exceljs) com gráficos simples,
// salva em bucket privado projeto-relatorios (path: <userId>/<projetoId>/<id>.<ext>)
// e devolve signed URL curta. Atualiza projeto_copilot_relatorios.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { z } from "https://esm.sh/zod@3.23.8";
import { secureHandler } from "../_shared/secure-handler.ts";
import { getCorsHeaders } from "../_shared/cors.ts";
import { PDFDocument, StandardFonts, rgb } from "https://esm.sh/pdf-lib@1.17.1";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const Body = z.object({
  projeto_id: z.string().uuid(),
  thread_id: z.string().uuid().optional(),
  tipo: z.enum(["status", "responsaveis", "executivo"]),
  formato: z.enum(["pdf", "xlsx"]),
}).strict();

interface TarefaRow {
  id: string; titulo: string; status: string; prioridade: string;
  data_prazo: string | null; responsavel_id: string | null;
}

async function loadDados(userClient: any, projetoId: string) {
  const [{ data: projeto }, { data: tarefas }, { data: profiles }] = await Promise.all([
    userClient.from("projetos").select("id, nome, descricao").eq("id", projetoId).maybeSingle(),
    userClient.from("projeto_tarefas")
      .select("id, titulo, status, prioridade, data_prazo, responsavel_id")
      .eq("projeto_id", projetoId).is("excluida_em", null),
    userClient.from("profiles").select("id, full_name, email"),
  ]);
  const profMap = new Map<string, string>();
  for (const p of (profiles ?? [])) profMap.set(p.id, p.full_name || p.email || "—");
  return { projeto, tarefas: (tarefas ?? []) as TarefaRow[], profMap };
}

function metricas(tarefas: TarefaRow[]) {
  const today = new Date(); today.setHours(0,0,0,0);
  const total = tarefas.length;
  const concluidas = tarefas.filter(t => t.status === "concluida").length;
  const atrasadas = tarefas.filter(t => t.status !== "concluida" && t.data_prazo && new Date(t.data_prazo) < today).length;
  const sem_resp = tarefas.filter(t => !t.responsavel_id).length;
  const em_andamento = tarefas.filter(t => t.status === "em_andamento").length;
  const pct = total ? Math.round((concluidas/total)*100) : 0;
  return { total, concluidas, atrasadas, sem_resp, em_andamento, pct };
}

function porResponsavel(tarefas: TarefaRow[], profMap: Map<string,string>) {
  const today = new Date(); today.setHours(0,0,0,0);
  const map = new Map<string, { nome: string; total: number; concluidas: number; atrasadas: number; pendentes: number }>();
  for (const t of tarefas) {
    const k = t.responsavel_id ?? "__sem__";
    const nome = t.responsavel_id ? (profMap.get(t.responsavel_id) ?? "—") : "Sem responsável";
    const cur = map.get(k) ?? { nome, total: 0, concluidas: 0, atrasadas: 0, pendentes: 0 };
    cur.total++;
    if (t.status === "concluida") cur.concluidas++;
    else cur.pendentes++;
    if (t.status !== "concluida" && t.data_prazo && new Date(t.data_prazo) < today) cur.atrasadas++;
    map.set(k, cur);
  }
  return Array.from(map.values()).sort((a,b) => b.total - a.total);
}

async function gerarPDF(projetoNome: string, tipo: string, tarefas: TarefaRow[], profMap: Map<string,string>): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const fontBold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const m = metricas(tarefas);
  const resp = porResponsavel(tarefas, profMap);

  let page = pdf.addPage([595, 842]); // A4
  const W = page.getWidth(), H = page.getHeight();
  let y = H - 60;

  const drawText = (txt: string, x: number, yy: number, size = 11, bold = false, color = rgb(0.1,0.1,0.15)) => {
    page.drawText(txt, { x, y: yy, size, font: bold ? fontBold : font, color });
  };
  const newPageIfNeeded = (need = 60) => {
    if (y < need) { page = pdf.addPage([595, 842]); y = H - 60; }
  };

  // Capa / cabeçalho
  drawText("Relatório de Projeto", 50, y, 22, true, rgb(0.05,0.1,0.4)); y -= 28;
  drawText(projetoNome, 50, y, 14, true); y -= 18;
  drawText(`Tipo: ${tipo === "status" ? "Status do projeto" : tipo === "responsaveis" ? "Responsáveis e carga" : "Executivo"}`, 50, y, 10); y -= 14;
  drawText(`Gerado em ${new Date().toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" })}`, 50, y, 10, false, rgb(0.4,0.4,0.5)); y -= 24;

  // Métricas
  drawText("Métricas", 50, y, 13, true); y -= 18;
  const cards = [
    { lbl: "Total", v: m.total },
    { lbl: "Concluídas", v: m.concluidas },
    { lbl: "Em andamento", v: m.em_andamento },
    { lbl: "Atrasadas", v: m.atrasadas },
    { lbl: "Sem resp.", v: m.sem_resp },
    { lbl: "% concluído", v: `${m.pct}%` },
  ];
  let cx = 50;
  for (const c of cards) {
    page.drawRectangle({ x: cx, y: y - 40, width: 80, height: 44, color: rgb(0.95,0.96,1), borderColor: rgb(0.85,0.87,0.95), borderWidth: 0.7 });
    drawText(String(c.v), cx + 6, y - 14, 16, true, rgb(0.1,0.2,0.5));
    drawText(c.lbl, cx + 6, y - 32, 8, false, rgb(0.4,0.4,0.5));
    cx += 88;
  }
  y -= 60;

  // Gráfico simples: barras por status
  drawText("Distribuição por status", 50, y, 13, true); y -= 18;
  const barW = 60, gap = 30;
  const statuses = [
    { lbl: "Concluídas", v: m.concluidas, c: rgb(0.2,0.7,0.4) },
    { lbl: "Em andam.", v: m.em_andamento, c: rgb(0.3,0.5,0.9) },
    { lbl: "Pendentes", v: m.total - m.concluidas - m.em_andamento, c: rgb(0.85,0.7,0.2) },
    { lbl: "Atrasadas", v: m.atrasadas, c: rgb(0.85,0.3,0.3) },
  ];
  const maxV = Math.max(1, ...statuses.map(s => s.v));
  const baseY = y - 100;
  let bx = 60;
  for (const s of statuses) {
    const h = (s.v / maxV) * 90;
    page.drawRectangle({ x: bx, y: baseY, width: barW, height: h, color: s.c });
    drawText(String(s.v), bx + 8, baseY + h + 4, 10, true);
    drawText(s.lbl, bx, baseY - 14, 9);
    bx += barW + gap;
  }
  y = baseY - 30;

  // Tabela: por responsável
  newPageIfNeeded(120);
  drawText("Carga por responsável", 50, y, 13, true); y -= 18;
  drawText("Responsável", 50, y, 9, true); drawText("Total", 280, y, 9, true);
  drawText("Concl.", 340, y, 9, true); drawText("Pend.", 400, y, 9, true); drawText("Atras.", 460, y, 9, true);
  y -= 6;
  page.drawLine({ start: { x: 50, y }, end: { x: 545, y }, thickness: 0.5, color: rgb(0.7,0.7,0.8) });
  y -= 10;
  for (const r of resp) {
    newPageIfNeeded(40);
    drawText((r.nome || "—").slice(0, 40), 50, y, 9);
    drawText(String(r.total), 280, y, 9);
    drawText(String(r.concluidas), 340, y, 9);
    drawText(String(r.pendentes), 400, y, 9);
    drawText(String(r.atrasadas), 460, y, 9, false, r.atrasadas > 0 ? rgb(0.85,0.3,0.3) : rgb(0.1,0.1,0.15));
    y -= 14;
  }
  y -= 10;

  // Tarefas atrasadas
  newPageIfNeeded(120);
  drawText("Tarefas atrasadas", 50, y, 13, true); y -= 18;
  const today = new Date(); today.setHours(0,0,0,0);
  const atrasadas = tarefas
    .filter(t => t.status !== "concluida" && t.data_prazo && new Date(t.data_prazo) < today)
    .sort((a,b) => (a.data_prazo ?? "").localeCompare(b.data_prazo ?? ""));
  if (atrasadas.length === 0) {
    drawText("Nenhuma tarefa atrasada.", 50, y, 10, false, rgb(0.4,0.4,0.5)); y -= 14;
  } else {
    for (const t of atrasadas.slice(0, 80)) {
      newPageIfNeeded(30);
      drawText("• " + t.titulo.slice(0, 70), 50, y, 9);
      drawText(t.data_prazo ?? "—", 460, y, 9, false, rgb(0.85,0.3,0.3));
      y -= 12;
    }
  }

  // Rodapé
  const pages = pdf.getPages();
  pages.forEach((p, i) => {
    p.drawText(`Página ${i+1} de ${pages.length}`, { x: 480, y: 30, size: 8, font, color: rgb(0.5,0.5,0.6) });
    p.drawText(projetoNome.slice(0, 60), { x: 50, y: 30, size: 8, font, color: rgb(0.5,0.5,0.6) });
  });

  return await pdf.save();
}

async function gerarXLSX(projetoNome: string, tarefas: TarefaRow[], profMap: Map<string,string>): Promise<Uint8Array> {
  const ExcelJS: any = await import("https://esm.sh/exceljs@4.4.0?target=denonext");
  const wb = new ExcelJS.Workbook();
  wb.creator = "Copiloto de Projetos";
  wb.created = new Date();

  const m = metricas(tarefas);
  const resp = porResponsavel(tarefas, profMap);

  // Sheet 1: Resumo
  const s1 = wb.addWorksheet("Resumo");
  s1.addRow(["Projeto", projetoNome]);
  s1.addRow(["Gerado em", new Date().toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" })]);
  s1.addRow([]);
  s1.addRow(["Métrica", "Valor"]);
  s1.addRow(["Total de tarefas", m.total]);
  s1.addRow(["Concluídas", m.concluidas]);
  s1.addRow(["Em andamento", m.em_andamento]);
  s1.addRow(["Atrasadas", m.atrasadas]);
  s1.addRow(["Sem responsável", m.sem_resp]);
  s1.addRow(["% concluído", `${m.pct}%`]);
  s1.getRow(1).font = { bold: true, size: 14 };
  s1.getRow(4).font = { bold: true };
  s1.columns = [{ width: 28 }, { width: 20 }];

  // Sheet 2: Tarefas
  const s2 = wb.addWorksheet("Tarefas");
  s2.columns = [
    { header: "Título", key: "titulo", width: 50 },
    { header: "Status", key: "status", width: 16 },
    { header: "Prioridade", key: "prioridade", width: 14 },
    { header: "Prazo", key: "prazo", width: 14 },
    { header: "Responsável", key: "resp", width: 28 },
  ];
  s2.getRow(1).font = { bold: true };
  for (const t of tarefas) {
    s2.addRow({
      titulo: t.titulo,
      status: t.status,
      prioridade: t.prioridade,
      prazo: t.data_prazo,
      resp: t.responsavel_id ? (profMap.get(t.responsavel_id) ?? "—") : "Sem responsável",
    });
  }

  // Sheet 3: Por responsável
  const s3 = wb.addWorksheet("Por responsável");
  s3.columns = [
    { header: "Responsável", key: "nome", width: 30 },
    { header: "Total", key: "total", width: 10 },
    { header: "Concluídas", key: "c", width: 12 },
    { header: "Pendentes", key: "p", width: 12 },
    { header: "Atrasadas", key: "a", width: 12 },
  ];
  s3.getRow(1).font = { bold: true };
  for (const r of resp) {
    s3.addRow({ nome: r.nome, total: r.total, c: r.concluidas, p: r.pendentes, a: r.atrasadas });
  }

  const buf = await wb.xlsx.writeBuffer();
  return new Uint8Array(buf);
}

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
    const { projeto_id, thread_id, tipo, formato } = parsed.data;
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

    // Cria registro pending
    const { data: rel, error: relErr } = await admin
      .from("projeto_copilot_relatorios")
      .insert({ projeto_id, user_id: userId, thread_id, tipo, formato, status: "pending" })
      .select("id").single();
    if (relErr) {
      return new Response(JSON.stringify({ error: relErr.message }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const relId = rel.id as string;

    try {
      const { projeto, tarefas, profMap } = await loadDados(userClient, projeto_id);
      const projetoNome = projeto?.nome ?? "Projeto";
      const ext = formato === "pdf" ? "pdf" : "xlsx";
      const path = `${userId}/${projeto_id}/${relId}.${ext}`;
      const bytes = formato === "pdf"
        ? await gerarPDF(projetoNome, tipo, tarefas, profMap)
        : await gerarXLSX(projetoNome, tarefas, profMap);

      const contentType = formato === "pdf"
        ? "application/pdf"
        : "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

      const { error: upErr } = await admin.storage.from("projeto-relatorios")
        .upload(path, bytes, { contentType, upsert: true });
      if (upErr) throw upErr;

      await admin.from("projeto_copilot_relatorios").update({
        status: "done",
        storage_path: path,
        metadata: { tarefas_total: tarefas.length, projeto_nome: projetoNome },
      }).eq("id", relId);

      const { data: signed } = await admin.storage.from("projeto-relatorios")
        .createSignedUrl(path, 60 * 10); // 10 min

      return new Response(JSON.stringify({
        ok: true, relatorio_id: relId, storage_path: path, signed_url: signed?.signedUrl,
        nome_arquivo: `${projetoNome.replace(/[^a-z0-9]+/gi, "_")}_${tipo}.${ext}`,
      }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    } catch (e: any) {
      console.error("relatorio error", e);
      await admin.from("projeto_copilot_relatorios").update({
        status: "failed", erro: e?.message ?? "erro desconhecido",
      }).eq("id", relId);
      return new Response(JSON.stringify({ error: e?.message ?? "Falha ao gerar relatório." }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
  }
);
