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
  /** Linha comercial do produto (rótulo da simulação). */
  linha?: string;
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
      Linha: l.linha ?? "Sem linha",
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

export interface CabecalhoPDF {
  titulo?: string;
  subtitulo?: string;
  incluirData?: boolean;
  incluirPerfis?: boolean;
}

export const CABECALHO_PDF_PADRAO: CabecalhoPDF = {
  titulo: "Comparativo de preços por perfil",
  subtitulo: "",
  incluirData: true,
  incluirPerfis: true,
};

export function exportarComparativoPDF(
  colunas: ComparativoColuna[],
  linhas: ComparativoLinhaExport[],
  perfis: { a: string; b?: string | null },
  cabecalho: CabecalhoPDF = CABECALHO_PDF_PADRAO,
) {
  const doc = new jsPDF({ orientation: "landscape", unit: "pt", format: "a4" });

  const titulo = cabecalho.titulo?.trim() || CABECALHO_PDF_PADRAO.titulo!;
  doc.setFontSize(14);
  doc.text(titulo, 40, 40);

  let y = 56;
  doc.setFontSize(9);
  if (cabecalho.subtitulo?.trim()) {
    doc.text(cabecalho.subtitulo.trim(), 40, y);
    y += 14;
  }
  const meta: string[] = [];
  if (cabecalho.incluirPerfis !== false) {
    meta.push(`${perfis.a}${perfis.b ? ` vs ${perfis.b}` : ""}`);
  }
  if (cabecalho.incluirData !== false) {
    meta.push(`gerado em ${agora()}`);
  }
  if (meta.length > 0) {
    doc.text(meta.join(" — "), 40, y);
    y += 14;
  }

  const head = [["Produto", "Linha", "Perfil", "Custo Fábrica", ...colunas.map((c) => c.nome)]];
  const body = linhas.map((l) => [
    l.produto,
    l.linha ?? "Sem linha",
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
    startY: y + 6,
    styles: { fontSize: 8, cellPadding: 4 },
    headStyles: { fillColor: [40, 40, 40] },
    columnStyles: { 0: { cellWidth: 90 }, 1: { cellWidth: 70 }, 2: { cellWidth: 80 } },
  });

  doc.save(`comparativo_perfis_${new Date().toISOString().split("T")[0]}.pdf`);
}

