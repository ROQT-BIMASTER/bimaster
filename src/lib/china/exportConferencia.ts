import ExcelJS from "exceljs";
import { saveAs } from "file-saver";
import type { ChinaOPRow } from "@/hooks/useChinaOrdensProducao";
import { getOPStatusInfo } from "@/lib/china/opStatus";

const TZ = "America/Sao_Paulo";

function fmtDate(s?: string | null): string {
  if (!s) return "";
  try {
    return new Date(s).toLocaleDateString("pt-BR", { timeZone: TZ });
  } catch { return ""; }
}
function fmtDateTime(s?: string | null): string {
  if (!s) return "";
  try {
    return new Date(s).toLocaleString("pt-BR", { timeZone: TZ });
  } catch { return ""; }
}

function applyHeader(ws: ExcelJS.Worksheet, titlePt: string, titleCn: string, totalRows: number) {
  ws.mergeCells(1, 1, 1, ws.columnCount);
  const c = ws.getCell(1, 1);
  c.value = `BiMaster — ${titlePt} / ${titleCn}`;
  c.font = { name: "Arial", bold: true, size: 14, color: { argb: "FFFFFFFF" } };
  c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1F2937" } };
  c.alignment = { horizontal: "center", vertical: "middle" };
  ws.getRow(1).height = 24;

  ws.mergeCells(2, 1, 2, ws.columnCount);
  const sub = ws.getCell(2, 1);
  sub.value = `Emitido em ${new Date().toLocaleString("pt-BR", { timeZone: TZ })} · Total: ${totalRows} registro(s)`;
  sub.font = { name: "Arial", italic: true, size: 9, color: { argb: "FF6B7280" } };
  sub.alignment = { horizontal: "center" };
  ws.getRow(2).height = 16;
}

function styleHeaderRow(row: ExcelJS.Row) {
  row.font = { name: "Arial", bold: true, size: 10, color: { argb: "FFFFFFFF" } };
  row.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF374151" } };
  row.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
  row.height = 28;
  row.eachCell((cell) => {
    cell.border = {
      top: { style: "thin", color: { argb: "FF9CA3AF" } },
      bottom: { style: "thin", color: { argb: "FF9CA3AF" } },
      left: { style: "thin", color: { argb: "FF9CA3AF" } },
      right: { style: "thin", color: { argb: "FF9CA3AF" } },
    };
  });
}

function applyZebraAndBorders(ws: ExcelJS.Worksheet, startRow: number) {
  for (let r = startRow; r <= ws.rowCount; r++) {
    const row = ws.getRow(r);
    row.font = { ...(row.font || {}), name: "Arial", size: 10 };
    if ((r - startRow) % 2 === 1) {
      row.eachCell((cell) => {
        cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF9FAFB" } };
      });
    }
    row.eachCell((cell) => {
      cell.border = {
        top: { style: "hair", color: { argb: "FFE5E7EB" } },
        bottom: { style: "hair", color: { argb: "FFE5E7EB" } },
        left: { style: "hair", color: { argb: "FFE5E7EB" } },
        right: { style: "hair", color: { argb: "FFE5E7EB" } },
      };
    });
  }
}

/* ============================================================
 * EXPORT 1 — Conferência de Submissões (mantido p/ compat)
 * ============================================================ */
export interface ChinaSubmissaoConferenciaRow {
  numero_ordem?: string | null;
  linha_produto?: string | null;
  produto_codigo?: string | null;
  produto_nome?: string | null;
  formula_codigo?: string | null;
  qty_total?: number | null;
  ean_display?: string | null;
  ean_caixa_master?: string | null;
  status?: string | null;
  created_at?: string | null;
}

export async function exportChinaSubmissoesConferencia(
  rows: ChinaSubmissaoConferenciaRow[],
): Promise<void> {
  const wb = new ExcelJS.Workbook();
  wb.creator = "BiMaster";
  wb.created = new Date();

  const ws = wb.addWorksheet("Conferência", {
    views: [{ state: "frozen", ySplit: 4 }],
  });

  ws.columns = [
    { key: "ordem", width: 18 },
    { key: "linha", width: 20 },
    { key: "item", width: 16 },
    { key: "produto", width: 40 },
    { key: "formula", width: 14 },
    { key: "qty", width: 12 },
    { key: "ean_d", width: 18 },
    { key: "ean_m", width: 18 },
    { key: "status", width: 14 },
    { key: "criado", width: 20 },
  ];

  applyHeader(ws, "Conferência de Submissões", "提交核对表", rows.length);

  const h1 = ws.getRow(3);
  h1.values = [
    "Código (Projeto)\n项目编号",
    "Linha do Produto\n产品系列",
    "Item MUB\nMUB 编号",
    "Produto\n产品",
    "Fórmula\n配方",
    "Qty Total\n总数量",
    "EAN Display\n显示码",
    "EAN Caixa Master\n外箱码",
    "Status\n状态",
    "Criado em\n创建时间",
  ];
  styleHeaderRow(h1);
  // Header técnico (key) — opcional, escondido como linha separadora
  ws.getRow(4).values = ["", "", "", "", "", "", "", "", "", ""];
  ws.getRow(4).height = 4;

  const sorted = [...rows].sort((a, b) => {
    const ord = (a.numero_ordem || "").localeCompare(b.numero_ordem || "");
    if (ord !== 0) return ord;
    return (a.linha_produto || "").localeCompare(b.linha_produto || "");
  });

  sorted.forEach((r) => {
    ws.addRow({
      ordem: r.numero_ordem || "",
      linha: r.linha_produto || "",
      item: r.produto_codigo || "",
      produto: r.produto_nome || "",
      formula: r.formula_codigo || "",
      qty: r.qty_total ?? "",
      ean_d: r.ean_display || "",
      ean_m: r.ean_caixa_master || "",
      status: r.status || "",
      criado: fmtDateTime(r.created_at),
    });
  });

  ws.getColumn("qty").numFmt = "#,##0";
  applyZebraAndBorders(ws, 5);

  const buf = await wb.xlsx.writeBuffer();
  const ts = new Date().toISOString().slice(0, 10);
  saveAs(new Blob([buf]), `conferencia_submissoes_${ts}.xlsx`);
}

/* ============================================================
 * EXPORT 2 — Planilha profissional de OPs da China (3 abas)
 * ============================================================ */
export interface ExportChinaOPsOptions {
  modo?: "todas" | "sem_oc" | "atrasadas";
}

export async function exportChinaOrdensProducao(
  rows: ChinaOPRow[],
  options: ExportChinaOPsOptions = {},
): Promise<void> {
  const modo = options.modo || "todas";

  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);

  const filtradas = rows.filter((r) => {
    if (modo === "sem_oc") return !r.oc_id;
    if (modo === "atrasadas") {
      if (!r.data_prevista) return false;
      if (r.status === "concluida" || r.status === "cancelada") return false;
      return new Date(r.data_prevista) < hoje;
    }
    return true;
  });

  const wb = new ExcelJS.Workbook();
  wb.creator = "BiMaster";
  wb.created = new Date();

  /* --- Aba 1: OPs --- */
  const ws = wb.addWorksheet("Ordens de Produção", {
    views: [{ state: "frozen", ySplit: 4 }],
  });
  ws.columns = [
    { key: "op", width: 20 },
    { key: "submissao", width: 14 },
    { key: "oc", width: 16 },
    { key: "produto_cod", width: 16 },
    { key: "produto_nome", width: 36 },
    { key: "qty_plan", width: 12 },
    { key: "qty_prod", width: 12 },
    { key: "pct", width: 10 },
    { key: "lote", width: 14 },
    { key: "inicio", width: 12 },
    { key: "prevista", width: 12 },
    { key: "status", width: 14 },
    { key: "alerta", width: 14 },
    { key: "criado", width: 18 },
  ];

  const tituloPt =
    modo === "sem_oc" ? "OPs sem OC" :
    modo === "atrasadas" ? "OPs atrasadas" : "Ordens de Produção China";
  const tituloCn =
    modo === "sem_oc" ? "无采购订单" :
    modo === "atrasadas" ? "逾期生产单" : "中国生产订单";

  applyHeader(ws, tituloPt, tituloCn, filtradas.length);

  const h1 = ws.getRow(3);
  h1.values = [
    "OP\n生产单",
    "Submissão\n提交",
    "OC\n采购订单",
    "Cód.\n编号",
    "Produto\n产品",
    "Qty Plan.\n计划数量",
    "Qty Prod.\n已生产",
    "%",
    "Lote\n批号",
    "Início\n开始",
    "Prevista\n预计",
    "Status\n状态",
    "Alerta\n警示",
    "Criado em\n创建时间",
  ];
  styleHeaderRow(h1);
  ws.getRow(4).height = 4;

  filtradas.forEach((r) => {
    const planejada = Number(r.quantidade_planejada || 0);
    const produzida = Number(r.quantidade_produzida || 0);
    const atrasada =
      r.data_prevista && r.status !== "concluida" && r.status !== "cancelada"
        ? new Date(r.data_prevista) < hoje
        : false;
    const semOc = !r.oc_id;
    const alerta = atrasada ? "Atrasada" : semOc ? "Sem OC" : "";

    const row = ws.addRow({
      op: r.numero,
      submissao: r.submissao_numero || "",
      oc: r.oc_numero || "",
      produto_cod: r.produto_codigo || "",
      produto_nome: r.produto_nome || "",
      qty_plan: planejada,
      qty_prod: produzida,
      pct: 0, // fórmula
      lote: r.lote || "",
      inicio: fmtDate(r.data_inicio),
      prevista: fmtDate(r.data_prevista),
      status: getOPStatusInfo(r.status).pt,
      alerta,
      criado: fmtDateTime(r.created_at),
    });
    // % via fórmula Excel
    const rowNum = row.number;
    row.getCell("pct").value = {
      formula: `IFERROR(G${rowNum}/F${rowNum},0)`,
    } as any;

    // Destaca alerta em amarelo
    if (alerta) {
      row.getCell("alerta").fill = {
        type: "pattern", pattern: "solid",
        fgColor: { argb: atrasada ? "FFFEE2E2" : "FFFEF3C7" },
      };
      row.getCell("alerta").font = {
        name: "Arial", size: 10, bold: true,
        color: { argb: atrasada ? "FFB91C1C" : "FF92400E" },
      };
    }
  });

  ws.getColumn("qty_plan").numFmt = "#,##0";
  ws.getColumn("qty_prod").numFmt = "#,##0";
  ws.getColumn("pct").numFmt = "0.0%";
  applyZebraAndBorders(ws, 5);

  /* --- Aba 2: OCs vinculadas (resumo) --- */
  const wsOC = wb.addWorksheet("OCs vinculadas");
  wsOC.columns = [
    { key: "oc", width: 18 },
    { key: "qtd_ops", width: 12 },
    { key: "qty", width: 14 },
  ];
  applyHeader(wsOC, "OCs vinculadas a OPs", "关联采购订单", 0);
  const hOC = wsOC.getRow(3);
  hOC.values = ["OC\n采购订单", "Qtd OPs\n生产单数", "Qty Total\n总数量"];
  styleHeaderRow(hOC);
  wsOC.getRow(4).height = 4;

  const ocAgg = new Map<string, { count: number; qty: number }>();
  filtradas.forEach((r) => {
    if (!r.oc_numero) return;
    const cur = ocAgg.get(r.oc_numero) || { count: 0, qty: 0 };
    cur.count += 1;
    cur.qty += Number(r.quantidade_planejada || 0);
    ocAgg.set(r.oc_numero, cur);
  });
  Array.from(ocAgg.entries())
    .sort((a, b) => a[0].localeCompare(b[0]))
    .forEach(([oc, v]) => wsOC.addRow({ oc, qtd_ops: v.count, qty: v.qty }));
  wsOC.getColumn("qty").numFmt = "#,##0";
  applyZebraAndBorders(wsOC, 5);

  /* --- Aba 3: Resumo por produto --- */
  const wsResumo = wb.addWorksheet("Resumo por Produto");
  wsResumo.columns = [
    { key: "cod", width: 16 },
    { key: "nome", width: 38 },
    { key: "qtd_ops", width: 10 },
    { key: "plan", width: 14 },
    { key: "prod", width: 14 },
    { key: "pct", width: 10 },
  ];
  applyHeader(wsResumo, "Resumo por Produto", "按产品汇总", 0);
  const hR = wsResumo.getRow(3);
  hR.values = [
    "Cód.\n编号",
    "Produto\n产品",
    "Qtd OPs\n生产单数",
    "Plan.\n计划",
    "Prod.\n实际",
    "%",
  ];
  styleHeaderRow(hR);
  wsResumo.getRow(4).height = 4;

  const prodAgg = new Map<
    string,
    { nome: string; count: number; plan: number; prod: number }
  >();
  filtradas.forEach((r) => {
    const key = r.produto_codigo || "—";
    const cur = prodAgg.get(key) || {
      nome: r.produto_nome || "",
      count: 0, plan: 0, prod: 0,
    };
    cur.count += 1;
    cur.plan += Number(r.quantidade_planejada || 0);
    cur.prod += Number(r.quantidade_produzida || 0);
    prodAgg.set(key, cur);
  });
  let r = 5;
  Array.from(prodAgg.entries())
    .sort((a, b) => a[0].localeCompare(b[0]))
    .forEach(([cod, v]) => {
      const row = wsResumo.addRow({
        cod, nome: v.nome, qtd_ops: v.count, plan: v.plan, prod: v.prod, pct: 0,
      });
      row.getCell("pct").value = { formula: `IFERROR(E${row.number}/D${row.number},0)` } as any;
      r++;
    });
  wsResumo.getColumn("plan").numFmt = "#,##0";
  wsResumo.getColumn("prod").numFmt = "#,##0";
  wsResumo.getColumn("pct").numFmt = "0.0%";
  applyZebraAndBorders(wsResumo, 5);

  const buf = await wb.xlsx.writeBuffer();
  const ts = new Date().toISOString().slice(0, 10);
  const sufixo = modo === "todas" ? "" : `_${modo}`;
  saveAs(new Blob([buf]), `china_ordens_producao${sufixo}_${ts}.xlsx`);
}
