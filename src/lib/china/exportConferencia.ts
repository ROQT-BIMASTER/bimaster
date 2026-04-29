import { exportToExcel } from "@/utils/excelExport";

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

/**
 * Exporta planilha de conferência rápida pós-importação:
 * Código (Projeto = numero_ordem) + Linha do Produto + identificadores.
 *
 * Ordenado por numero_ordem ASC, depois linha_produto ASC, para conferir
 * lado a lado com a planilha original.
 */
export async function exportChinaSubmissoesConferencia(
  rows: ChinaSubmissaoConferenciaRow[],
): Promise<void> {
  const sorted = [...rows].sort((a, b) => {
    const ord = (a.numero_ordem || "").localeCompare(b.numero_ordem || "");
    if (ord !== 0) return ord;
    return (a.linha_produto || "").localeCompare(b.linha_produto || "");
  });

  const data = sorted.map((r) => ({
    "Código (Projeto)": r.numero_ordem || "",
    "Linha do Produto": r.linha_produto || "",
    "Item MUB": r.produto_codigo || "",
    "Produto": r.produto_nome || "",
    "Fórmula": r.formula_codigo || "",
    "Qty Total": r.qty_total ?? "",
    "EAN Display": r.ean_display || "",
    "EAN Caixa Master": r.ean_caixa_master || "",
    "Status": r.status || "",
    "Criado em": r.created_at
      ? new Date(r.created_at).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" })
      : "",
  }));

  await exportToExcel(data, {
    filename: "conferencia_china",
    sheetName: "Conferência",
    includeTimestamp: true,
    columns: [
      { header: "Código (Projeto)", key: "Código (Projeto)", width: 18 },
      { header: "Linha do Produto", key: "Linha do Produto", width: 20 },
      { header: "Item MUB", key: "Item MUB", width: 16 },
      { header: "Produto", key: "Produto", width: 40 },
      { header: "Fórmula", key: "Fórmula", width: 14 },
      { header: "Qty Total", key: "Qty Total", width: 12 },
      { header: "EAN Display", key: "EAN Display", width: 18 },
      { header: "EAN Caixa Master", key: "EAN Caixa Master", width: 18 },
      { header: "Status", key: "Status", width: 14 },
      { header: "Criado em", key: "Criado em", width: 20 },
    ],
  });
}
