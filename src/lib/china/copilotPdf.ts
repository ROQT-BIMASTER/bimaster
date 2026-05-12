// copilotPdf.ts — Gera PDF executivo do Copiloto de Submissão China.
// Layout fiel ao markdown com paginação automática, KPIs em cards,
// tabelas via jspdf-autotable e header/footer com numeração.
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

export type CopilotPdfIdioma = "pt" | "en" | "zh";

export interface CopilotPdfResultado {
  markdown: string;
  kpis: {
    etapas_concluidas: number;
    etapas_totais: number;
    atrasos_count: number;
    dias_para_embarque: number | null;
    risco: "alto" | "medio" | "baixo";
  };
  analytics?: {
    progresso_pct: number;
    por_coluna: Array<{ coluna: string; concluido: number; pendente: number; atrasado: number }>;
    docs_resumo: { total: number; oficializado: number; pendente: number };
    ocs_resumo: { total: number; aprovadas: number; em_producao: number; concluidas: number };
    embarques_resumo: { total: number; em_transito: number; entregues: number };
    atrasos_top: Array<{ coluna: string; item: string; prazo: string | null; responsavel: string | null; dias_atraso: number | null }>;
    marcos: Array<{ data: string | null; label: string; status: "ok" | "pending" | "late"; tipo: string }>;
    checklist_360?: Array<{ categoria: string; fluxo: string; total_itens: number; cumpridos: number; pendentes: number; docs_anexados: number; docs_oficializados: number; percentual: number }>;
    planilha_resumo?: { tem_planilha: boolean; linhas: number; colunas: string[]; principais_campos: Array<{ campo: string; valor: string }> };
    sugestoes_acao?: Array<{ prioridade: "alta" | "media" | "baixa"; titulo: string; detalhe: string; responsavel: string | null; prazo: string | null }>;
  };
  submissao: { id: string; codigo: string; nome: string };
  model: string;
}

const LABELS: Record<CopilotPdfIdioma, Record<string, string>> = {
  pt: {
    title: "Relatório do Copiloto", risk: "Risco", progress: "Progresso",
    riskLow: "baixo", riskMed: "médio", riskHigh: "alto",
    etapas: "Etapas concluídas", atrasos: "Atrasos", diasEmbarque: "Dias até embarque",
    docs: "Documentos oficiais", ocs: "OCs aprovadas", embarques: "Embarques entregues",
    statusArea: "Status por área", area: "Área", ok: "Concluído", pending: "Pendente", late: "Atrasado",
    delaysTitle: "Atrasos prioritários", item: "Item", deadline: "Prazo", owner: "Responsável", days: "Dias",
    timelineTitle: "Marcos da operação", date: "Data", milestone: "Marco",
    reportTitle: "Relatório completo", model: "Modelo", page: "Página", of: "de",
    generatedAt: "Gerado em",
    docs360Title: "Documentos & Checklists 360°", attached: "Anexados", official: "Oficializados", pct: "% Concluído",
    planilhaTitle: "Planilha Inicial", rows: "Linhas", cols: "Colunas", field: "Campo", value: "Valor",
    sugestoesTitle: "Sugestões Priorizadas", priority: "Prioridade", suggestion: "Sugestão",
    noPlanilha: "Planilha inicial não disponível.",
  },
  en: {
    title: "Copilot Report", risk: "Risk", progress: "Progress",
    riskLow: "low", riskMed: "medium", riskHigh: "high",
    etapas: "Steps completed", atrasos: "Delays", diasEmbarque: "Days to shipment",
    docs: "Official documents", ocs: "Approved POs", embarques: "Delivered shipments",
    statusArea: "Status by area", area: "Area", ok: "Completed", pending: "Pending", late: "Overdue",
    delaysTitle: "Top delays", item: "Item", deadline: "Deadline", owner: "Owner", days: "Days",
    timelineTitle: "Operation milestones", date: "Date", milestone: "Milestone",
    reportTitle: "Full report", model: "Model", page: "Page", of: "of",
    generatedAt: "Generated at",
  },
  zh: {
    title: "副驾驶报告", risk: "风险", progress: "进度",
    riskLow: "低", riskMed: "中", riskHigh: "高",
    etapas: "已完成步骤", atrasos: "延误", diasEmbarque: "距装运天数",
    docs: "正式文件", ocs: "已批准订单", embarques: "已交付发运",
    statusArea: "区域状态", area: "区域", ok: "完成", pending: "待处理", late: "逾期",
    delaysTitle: "优先延误", item: "项目", deadline: "截止", owner: "负责人", days: "天",
    timelineTitle: "运营里程碑", date: "日期", milestone: "里程碑",
    reportTitle: "完整报告", model: "模型", page: "页", of: "/",
    generatedAt: "生成于",
  },
};

function fmtDate(d: string | null, idioma: CopilotPdfIdioma): string {
  if (!d) return "—";
  try {
    const dt = new Date(d);
    return dt.toLocaleDateString(idioma === "zh" ? "zh-CN" : idioma === "en" ? "en-US" : "pt-BR", {
      timeZone: "America/Sao_Paulo",
    });
  } catch { return "—"; }
}

// Parse markdown leve: headings, parágrafos, listas, código, tabelas (separadas).
type Block =
  | { kind: "h1" | "h2" | "h3"; text: string }
  | { kind: "p"; text: string }
  | { kind: "li"; text: string }
  | { kind: "table"; head: string[]; body: string[][] };

function parseMarkdown(md: string): Block[] {
  const lines = md.replace(/\r\n/g, "\n").split("\n");
  const blocks: Block[] = [];
  let i = 0;
  while (i < lines.length) {
    const ln = lines[i];
    // Tabela
    if (/^\s*\|.+\|\s*$/.test(ln) && i + 1 < lines.length && /^\s*\|?[\s:|-]+\|?\s*$/.test(lines[i + 1])) {
      const head = ln.split("|").map((c) => c.trim()).filter((_, idx, arr) => idx > 0 && idx < arr.length - 1);
      const body: string[][] = [];
      i += 2;
      while (i < lines.length && /^\s*\|.+\|\s*$/.test(lines[i])) {
        const row = lines[i].split("|").map((c) => c.trim()).filter((_, idx, arr) => idx > 0 && idx < arr.length - 1);
        body.push(row);
        i++;
      }
      blocks.push({ kind: "table", head, body });
      continue;
    }
    if (/^###\s+/.test(ln)) { blocks.push({ kind: "h3", text: ln.replace(/^###\s+/, "").trim() }); i++; continue; }
    if (/^##\s+/.test(ln)) { blocks.push({ kind: "h2", text: ln.replace(/^##\s+/, "").trim() }); i++; continue; }
    if (/^#\s+/.test(ln)) { blocks.push({ kind: "h1", text: ln.replace(/^#\s+/, "").trim() }); i++; continue; }
    if (/^\s*[-*]\s+/.test(ln)) { blocks.push({ kind: "li", text: ln.replace(/^\s*[-*]\s+/, "").trim() }); i++; continue; }
    if (/^\s*\d+\.\s+/.test(ln)) { blocks.push({ kind: "li", text: ln.replace(/^\s*\d+\.\s+/, "").trim() }); i++; continue; }
    if (ln.trim() === "") { i++; continue; }
    // parágrafo (juntar linhas até quebra)
    let buf = ln;
    i++;
    while (i < lines.length && lines[i].trim() !== "" && !/^[#\-*\d|]/.test(lines[i].trim())) {
      buf += " " + lines[i].trim();
      i++;
    }
    blocks.push({ kind: "p", text: buf.replace(/\*\*/g, "").replace(/\*/g, "").trim() });
  }
  return blocks;
}

export function buildCopilotPdf(resultado: CopilotPdfResultado, idioma: CopilotPdfIdioma): { blob: Blob; filename: string; base64: Promise<string> } {
  const L = LABELS[idioma];
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const margin = 40;
  let y = margin;

  const ensure = (h: number) => {
    if (y + h > pageH - 60) {
      doc.addPage();
      y = margin;
    }
  };

  // ===== Capa =====
  doc.setFillColor(245, 247, 250);
  doc.rect(0, 0, pageW, 110, "F");
  doc.setTextColor(20, 30, 50);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(20);
  doc.text(L.title, margin, 50);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(11);
  doc.text(`${resultado.submissao.codigo} — ${resultado.submissao.nome}`, margin, 72);
  doc.setFontSize(9);
  doc.setTextColor(110, 120, 140);
  doc.text(`${L.generatedAt}: ${fmtDate(new Date().toISOString(), idioma)} • ${L.model}: ${resultado.model}`, margin, 92);

  y = 130;
  doc.setTextColor(20, 30, 50);

  // ===== Risk + Progresso =====
  const riscoLabel = resultado.kpis.risco === "alto" ? L.riskHigh : resultado.kpis.risco === "medio" ? L.riskMed : L.riskLow;
  const riscoColor: [number, number, number] =
    resultado.kpis.risco === "alto" ? [220, 53, 69] :
    resultado.kpis.risco === "medio" ? [230, 162, 60] :
    [40, 167, 110];

  doc.setDrawColor(225);
  doc.roundedRect(margin, y, pageW - margin * 2, 56, 6, 6);
  doc.setFontSize(9); doc.setTextColor(110, 120, 140);
  doc.text(L.risk.toUpperCase(), margin + 12, y + 18);
  doc.setFontSize(14); doc.setFont("helvetica", "bold");
  doc.setTextColor(...riscoColor);
  doc.text(riscoLabel.toUpperCase(), margin + 12, y + 38);

  doc.setFont("helvetica", "normal"); doc.setFontSize(9); doc.setTextColor(110, 120, 140);
  const progresso = resultado.analytics?.progresso_pct ?? 0;
  doc.text(`${L.progress}: ${progresso}%`, pageW - margin - 160, y + 22);
  // barra
  const barX = pageW - margin - 160;
  const barY = y + 30;
  const barW = 140;
  doc.setFillColor(232, 236, 242);
  doc.roundedRect(barX, barY, barW, 8, 4, 4, "F");
  doc.setFillColor(35, 90, 200);
  doc.roundedRect(barX, barY, (barW * progresso) / 100, 8, 4, 4, "F");

  y += 76;

  // ===== KPI Cards (2 linhas x 3) =====
  doc.setTextColor(20, 30, 50);
  const a = resultado.analytics;
  const tiles = [
    { label: L.etapas, value: `${resultado.kpis.etapas_concluidas}/${resultado.kpis.etapas_totais}` },
    { label: L.atrasos, value: String(resultado.kpis.atrasos_count) },
    { label: L.diasEmbarque, value: resultado.kpis.dias_para_embarque == null ? "—" : String(resultado.kpis.dias_para_embarque) },
    { label: L.docs, value: `${a?.docs_resumo.oficializado ?? 0}/${a?.docs_resumo.total ?? 0}` },
    { label: L.ocs, value: `${a?.ocs_resumo.aprovadas ?? 0}/${a?.ocs_resumo.total ?? 0}` },
    { label: L.embarques, value: `${a?.embarques_resumo.entregues ?? 0}/${a?.embarques_resumo.total ?? 0}` },
  ];
  const tileW = (pageW - margin * 2 - 12) / 3;
  const tileH = 50;
  tiles.forEach((tile, idx) => {
    const col = idx % 3;
    const row = Math.floor(idx / 3);
    const x = margin + col * (tileW + 6);
    const yy = y + row * (tileH + 6);
    doc.setDrawColor(225); doc.setFillColor(252, 253, 255);
    doc.roundedRect(x, yy, tileW, tileH, 5, 5, "FD");
    doc.setFontSize(8); doc.setTextColor(120, 130, 150);
    doc.text(tile.label.toUpperCase(), x + 10, yy + 15);
    doc.setFontSize(15); doc.setFont("helvetica", "bold"); doc.setTextColor(25, 35, 55);
    doc.text(tile.value, x + 10, yy + 36);
    doc.setFont("helvetica", "normal");
  });
  y += tileH * 2 + 18;

  // ===== Status por área (tabela) =====
  if (a?.por_coluna?.length) {
    ensure(40);
    doc.setFontSize(11); doc.setFont("helvetica", "bold"); doc.setTextColor(25, 35, 55);
    doc.text(L.statusArea, margin, y);
    y += 6;
    autoTable(doc, {
      startY: y + 4,
      head: [[L.area, L.ok, L.pending, L.late]],
      body: a.por_coluna.map((c) => [c.coluna, String(c.concluido), String(c.pendente), String(c.atrasado)]),
      styles: { fontSize: 9, cellPadding: 4 },
      headStyles: { fillColor: [35, 90, 200], textColor: 255 },
      margin: { left: margin, right: margin },
      didDrawPage: () => { y = margin; },
    });
    y = (doc as any).lastAutoTable.finalY + 16;
  }

  // ===== Atrasos prioritários =====
  if (a?.atrasos_top?.length) {
    ensure(40);
    doc.setFontSize(11); doc.setFont("helvetica", "bold"); doc.setTextColor(25, 35, 55);
    doc.text(L.delaysTitle, margin, y);
    y += 6;
    autoTable(doc, {
      startY: y + 4,
      head: [[L.area, L.item, L.deadline, L.owner, L.days]],
      body: a.atrasos_top.map((d) => [
        d.coluna,
        d.item,
        fmtDate(d.prazo, idioma),
        d.responsavel ?? "—",
        d.dias_atraso != null ? `+${d.dias_atraso}` : "—",
      ]),
      styles: { fontSize: 9, cellPadding: 4 },
      headStyles: { fillColor: [220, 53, 69], textColor: 255 },
      margin: { left: margin, right: margin },
    });
    y = (doc as any).lastAutoTable.finalY + 16;
  }

  // ===== Linha do tempo =====
  if (a?.marcos?.length) {
    ensure(40);
    doc.setFontSize(11); doc.setFont("helvetica", "bold"); doc.setTextColor(25, 35, 55);
    doc.text(L.timelineTitle, margin, y);
    y += 6;
    autoTable(doc, {
      startY: y + 4,
      head: [[L.date, L.milestone, "Status"]],
      body: a.marcos.map((m) => [
        fmtDate(m.data, idioma),
        m.label,
        m.status === "ok" ? L.ok : m.status === "late" ? L.late : L.pending,
      ]),
      styles: { fontSize: 9, cellPadding: 4 },
      headStyles: { fillColor: [60, 70, 95], textColor: 255 },
      margin: { left: margin, right: margin },
    });
    y = (doc as any).lastAutoTable.finalY + 18;
  }

  // ===== Relatório completo (markdown) =====
  doc.addPage();
  y = margin;
  doc.setFontSize(13); doc.setFont("helvetica", "bold"); doc.setTextColor(25, 35, 55);
  doc.text(L.reportTitle, margin, y);
  y += 18;

  const blocks = parseMarkdown(resultado.markdown);
  const contentW = pageW - margin * 2;

  for (const b of blocks) {
    if (b.kind === "table") {
      ensure(30);
      autoTable(doc, {
        startY: y,
        head: [b.head],
        body: b.body,
        styles: { fontSize: 8.5, cellPadding: 3, overflow: "linebreak" },
        headStyles: { fillColor: [60, 70, 95], textColor: 255 },
        margin: { left: margin, right: margin },
      });
      y = (doc as any).lastAutoTable.finalY + 10;
      continue;
    }
    if (b.kind === "h1") {
      ensure(28);
      doc.setFont("helvetica", "bold"); doc.setFontSize(14); doc.setTextColor(25, 35, 55);
      const lines = doc.splitTextToSize(b.text, contentW);
      doc.text(lines, margin, y); y += lines.length * 16 + 6;
      continue;
    }
    if (b.kind === "h2") {
      ensure(24);
      doc.setFont("helvetica", "bold"); doc.setFontSize(12); doc.setTextColor(25, 35, 55);
      const lines = doc.splitTextToSize(b.text, contentW);
      doc.text(lines, margin, y); y += lines.length * 14 + 4;
      continue;
    }
    if (b.kind === "h3") {
      ensure(22);
      doc.setFont("helvetica", "bold"); doc.setFontSize(11); doc.setTextColor(40, 50, 70);
      const lines = doc.splitTextToSize(b.text, contentW);
      doc.text(lines, margin, y); y += lines.length * 13 + 3;
      continue;
    }
    if (b.kind === "li") {
      doc.setFont("helvetica", "normal"); doc.setFontSize(10); doc.setTextColor(40, 50, 70);
      const lines = doc.splitTextToSize("• " + b.text, contentW - 8);
      ensure(lines.length * 12 + 4);
      doc.text(lines, margin + 4, y);
      y += lines.length * 12 + 2;
      continue;
    }
    // parágrafo
    doc.setFont("helvetica", "normal"); doc.setFontSize(10); doc.setTextColor(40, 50, 70);
    const lines = doc.splitTextToSize(b.text, contentW);
    ensure(lines.length * 12 + 4);
    doc.text(lines, margin, y);
    y += lines.length * 12 + 6;
  }

  // ===== Footer com numeração =====
  const totalPages = doc.getNumberOfPages();
  for (let p = 1; p <= totalPages; p++) {
    doc.setPage(p);
    doc.setFont("helvetica", "normal"); doc.setFontSize(8); doc.setTextColor(140, 150, 170);
    doc.text(`${L.page} ${p} ${L.of} ${totalPages}`, pageW - margin, pageH - 20, { align: "right" });
    doc.text(`${resultado.submissao.codigo}`, margin, pageH - 20);
  }

  const blob = doc.output("blob");
  const filename = `copiloto-${resultado.submissao.codigo}-${idioma}.pdf`;

  // base64 (sem o prefixo data:)
  const base64 = (async () => {
    const buf = await blob.arrayBuffer();
    let bin = "";
    const bytes = new Uint8Array(buf);
    const chunk = 0x8000;
    for (let i = 0; i < bytes.length; i += chunk) {
      bin += String.fromCharCode.apply(null, Array.from(bytes.subarray(i, i + chunk)) as any);
    }
    return btoa(bin);
  })();

  return { blob, filename, base64 };
}
