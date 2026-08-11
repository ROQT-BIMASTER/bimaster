import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { formatCurrency } from "@/lib/formatters";
import { exportToExcel } from "@/utils/excelExport";

export interface ComparativoColuna {
  id: string;
  nome: string;
}

export interface ComparativoLinhaExport {
  produto: string;
  perfil: string;
  custo: number;
  /** id da coluna -> preço */
  precos: Record<string, number>;
  /** id da coluna -> diferença em relação ao perfil A (apenas nas linhas do perfil B) */
  diffs?: Record<string, number>;
}

/** Ordem comercial padrão das colunas de preço. */
export const ORDEM_PADRAO: RegExp[] = [
  /clear/i,
  /mude/i,
  /primavera/i,
  /deep/i,
  /b2b/i,
  /e-?com/i,
];

export function ordenarColunasPadrao<T extends { id: string; nome: string }>(cols: T[]): T[] {
  const peso = (nome: string) => {
    const i = ORDEM_PADRAO.findIndex((re) => re.test(nome));
    return i === -1 ? ORDEM_PADRAO.length : i;
  };
  return [...cols].sort((a, b) => peso(a.nome) - peso(b.nome));
}

function agora() {
  return new Date().toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" });
}

export async function exportarComparativoExcel(
  colunas: ComparativoColuna[],
  linhas: ComparativoLinhaExport[],
  perfis: { a: string; b?: string | null },
) {
  const dados = linhas.map((l) => {
    const row: Record<string, string | number> = {
      Produto: l.produto,
      Perfil: l.perfil,
      "Custo Fábrica": Number(l.custo.toFixed(4)),
    };
    for (const c of colunas) {
      row[c.nome] = Number((l.precos[c.id] ?? 0).toFixed(4));
      if (l.diffs) {
        const base = l.precos[c.id] ?? 0;
        const diff = l.diffs[c.id] ?? 0;
        row[`${c.nome} — Dif. R$`] = Number(diff.toFixed(4));
        const ref = base - diff;
        row[`${c.nome} — Dif. %`] = ref > 0 ? Number(((diff / ref) * 100).toFixed(2)) : 0;
      }
    }
    return row;
  });

  await exportToExcel(dados, {
    filename: `comparativo_perfis_${perfis.a}${perfis.b ? `_vs_${perfis.b}` : ""}`,
    sheetName: "Comparativo",
    includeTimestamp: true,
  });
}

export function exportarComparativoPDF(
  colunas: ComparativoColuna[],
  linhas: ComparativoLinhaExport[],
  perfis: { a: string; b?: string | null },
) {
  const doc = new jsPDF({ orientation: "landscape", unit: "pt", format: "a4" });

  doc.setFontSize(14);
  doc.text("Comparativo de preços por perfil", 40, 40);
  doc.setFontSize(9);
  doc.text(
    `${perfis.a}${perfis.b ? ` vs ${perfis.b}` : ""} — gerado em ${agora()}`,
    40,
    56,
  );

  const head = [["Produto", "Perfil", "Custo Fábrica", ...colunas.map((c) => c.nome)]];
  const body = linhas.map((l) => [
    l.produto,
    l.perfil,
    formatCurrency(l.custo),
    ...colunas.map((c) => {
      const v = formatCurrency(l.precos[c.id] ?? 0);
      const d = l.diffs?.[c.id];
      if (d !== undefined && Math.abs(d) > 0.004) {
        return `${v}\n(${d > 0 ? "+" : ""}${formatCurrency(d)})`;
      }
      return v;
    }),
  ]);

  autoTable(doc, {
    head,
    body,
    startY: 70,
    styles: { fontSize: 8, cellPadding: 4 },
    headStyles: { fillColor: [40, 40, 40] },
    columnStyles: { 0: { cellWidth: 90 }, 1: { cellWidth: 90 } },
  });

  doc.save(`comparativo_perfis_${new Date().toISOString().split("T")[0]}.pdf`);
}
