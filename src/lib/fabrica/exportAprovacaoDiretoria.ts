/**
 * Exportações da visão de preços para aprovação da diretoria (Excel e PDF).
 *
 * Layout: cabeçalho com perfil, vigência e responsável; uma coluna por tabela
 * com a regra de formação logo abaixo do nome (ex.: "+42% s/ Clear"); preço e
 * multiplicador sobre o custo de fábrica por produto; coluna de decisão;
 * resumo por tabela; pontos de atenção e campos de assinatura.
 */
import jsPDF from "jspdf";
import autoTable, { type CellDef, type RowInput, type Styles } from "jspdf-autotable";
import { saveAs } from "file-saver";
import { formatCurrency } from "@/lib/formatters";
import { auditExport } from "@/lib/utils/sensitive-audit";
import type { LinhaDiretoria, VisaoDiretoria } from "@/lib/fabrica/visaoDiretoriaPrecos";

export interface OpcoesAprovacaoDiretoria {
  titulo: string;
  /** Contexto da proposta (ex.: "Lançamento linha Baunilha"). */
  referencia: string;
  /** Vigência proposta em texto livre (ex.: "A partir de 01/10/2026"). */
  vigencia: string;
  elaboradoPor: string;
  mostrarMultiplicador: boolean;
}

export const OPCOES_DIRETORIA_PADRAO: OpcoesAprovacaoDiretoria = {
  titulo: "Proposta de tabela de preços",
  referencia: "",
  vigencia: "",
  elaboradoPor: "",
  mostrarMultiplicador: true,
};

export const DECISOES_DIRETORIA = ["Aprovado", "Aprovado com ajuste", "Reprovado"] as const;

const RODAPE = "Documento interno — proposta sujeita à aprovação da diretoria";
const ENTIDADE_AUDITORIA = "aprovacao_precos_diretoria";

const fmtMultiplicador = (v: number) =>
  `${new Intl.NumberFormat("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(v)}x`;

const fmtCusto = (v: number) =>
  new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    minimumFractionDigits: 4,
    maximumFractionDigits: 4,
  }).format(v);

const fmtPct = (v: number) =>
  `${new Intl.NumberFormat("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 }).format(v)}%`;

function agora() {
  return new Date().toLocaleString("pt-BR", {
    timeZone: "America/Sao_Paulo",
    dateStyle: "short",
    timeStyle: "short",
  });
}

function dataArquivo() {
  return new Date().toLocaleDateString("sv-SE", { timeZone: "America/Sao_Paulo" });
}

function nomeArquivo(visao: VisaoDiretoria, ext: "xlsx" | "pdf") {
  const perfil = visao.perfil
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .toLowerCase();
  return `aprovacao_precos_${perfil || "perfil"}_${dataArquivo()}.${ext}`;
}

function linhaMeta(visao: VisaoDiretoria, opcoes: OpcoesAprovacaoDiretoria): string {
  return [
    `Perfil de cálculo: ${visao.perfil}`,
    opcoes.vigencia.trim() && `Vigência: ${opcoes.vigencia.trim()}`,
    opcoes.elaboradoPor.trim() && `Elaborado por: ${opcoes.elaboradoPor.trim()}`,
    `${visao.totalProdutos} produto${visao.totalProdutos === 1 ? "" : "s"}`,
    `Gerado em ${agora()}`,
  ]
    .filter(Boolean)
    .join("   |   ");
}

/** Coluna "Linha" só aparece quando há linha informada e a tabela não está agrupada. */
const exibeColunaLinha = (visao: VisaoDiretoria) => visao.usaLinha && !visao.agrupado;

// ---------------------------------------------------------------------------
// Excel
// ---------------------------------------------------------------------------

const XL = {
  cabecalho: "FF1E293B",
  cabecalhoTexto: "FFFFFFFF",
  regra: "FFE2E8F0",
  grupo: "FFF1F5F9",
  zebra: "FFF8FAFC",
  textoSuave: "FF64748B",
  texto: "FF0F172A",
  borda: "FFCBD5E1",
};

const FMT_CUSTO = '"R$" #,##0.0000';
const FMT_PRECO = '"R$" #,##0.00';
const FMT_MULT = '0.00"x"';
const FMT_PCT = '0.0"%"';

export async function exportarAprovacaoDiretoriaExcel(
  visao: VisaoDiretoria,
  opcoes: OpcoesAprovacaoDiretoria,
) {
  const ExcelJS = (await import("exceljs")).default;
  type Cell = import("exceljs").Cell;
  type Borders = Partial<import("exceljs").Borders>;

  const wb = new ExcelJS.Workbook();
  wb.creator = opcoes.elaboradoPor.trim() || "Simulador de preços";
  wb.created = new Date();

  const borda: Borders = {
    top: { style: "thin", color: { argb: XL.borda } },
    left: { style: "thin", color: { argb: XL.borda } },
    bottom: { style: "thin", color: { argb: XL.borda } },
    right: { style: "thin", color: { argb: XL.borda } },
  };
  const preencher = (cell: Cell, argb: string) => {
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb } };
  };

  const mult = opcoes.mostrarMultiplicador;
  const comLinha = exibeColunaLinha(visao);

  // Mapa de colunas
  let c = 1;
  const colProduto = c++;
  const colLinha = comLinha ? c++ : 0;
  const colCusto = c++;
  const colTabelas = visao.colunas.map(() => {
    const preco = c++;
    const multiplicador = mult ? c++ : 0;
    return { preco, multiplicador };
  });
  const colDecisao = c++;
  const colObs = c++;
  const ultima = colObs;

  const ws = wb.addWorksheet("Aprovação", {
    pageSetup: {
      paperSize: 9,
      orientation: "landscape",
      fitToPage: true,
      fitToWidth: 1,
      fitToHeight: 0,
      margins: { left: 0.4, right: 0.4, top: 0.5, bottom: 0.6, header: 0.3, footer: 0.3 },
    },
  });
  ws.headerFooter.oddFooter = `&L&8${RODAPE}&R&8Página &P de &N`;

  ws.getColumn(colProduto).width = 30;
  if (colLinha) ws.getColumn(colLinha).width = 16;
  ws.getColumn(colCusto).width = 14;
  for (const t of colTabelas) {
    ws.getColumn(t.preco).width = 13;
    if (t.multiplicador) ws.getColumn(t.multiplicador).width = 8;
  }
  ws.getColumn(colDecisao).width = 20;
  ws.getColumn(colObs).width = 34;

  // Título e metadados
  let r = 1;
  ws.mergeCells(r, 1, r, ultima);
  Object.assign(ws.getCell(r, 1), {
    value: opcoes.titulo.trim() || OPCOES_DIRETORIA_PADRAO.titulo,
    font: { bold: true, size: 15, color: { argb: XL.texto } },
  });
  ws.getRow(r).height = 22;
  r++;
  if (opcoes.referencia.trim()) {
    ws.mergeCells(r, 1, r, ultima);
    Object.assign(ws.getCell(r, 1), {
      value: opcoes.referencia.trim(),
      font: { size: 11, color: { argb: XL.texto } },
    });
    r++;
  }
  ws.mergeCells(r, 1, r, ultima);
  Object.assign(ws.getCell(r, 1), {
    value: linhaMeta(visao, opcoes),
    font: { size: 9, color: { argb: XL.textoSuave } },
  });
  r += 2;

  // Cabeçalho em duas linhas: nome da tabela + regra de formação
  const h1 = r;
  const h2 = r + 1;
  const estiloCabecalho = (cell: Cell) => {
    preencher(cell, XL.cabecalho);
    cell.font = { bold: true, size: 10, color: { argb: XL.cabecalhoTexto } };
    cell.alignment = { vertical: "middle", horizontal: "center", wrapText: true };
    cell.border = borda;
  };
  const fixas: [number, string][] = [
    [colProduto, "Produto"],
    ...(colLinha ? ([[colLinha, "Linha"]] as [number, string][]) : []),
    [colCusto, "Custo fábrica"],
    [colDecisao, "Decisão da diretoria"],
    [colObs, "Observações / preço ajustado"],
  ];
  for (const [col, texto] of fixas) {
    ws.mergeCells(h1, col, h2, col);
    const cell = ws.getCell(h1, col);
    cell.value = texto;
    estiloCabecalho(cell);
  }
  visao.colunas.forEach((coluna, i) => {
    const { preco, multiplicador } = colTabelas[i];
    const fim = multiplicador || preco;
    if (fim > preco) {
      ws.mergeCells(h1, preco, h1, fim);
      ws.mergeCells(h2, preco, h2, fim);
    }
    const nome = ws.getCell(h1, preco);
    nome.value = coluna.nome;
    estiloCabecalho(nome);
    const regra = ws.getCell(h2, preco);
    regra.value = coluna.regra;
    preencher(regra, XL.regra);
    regra.font = { italic: true, size: 9, color: { argb: XL.texto } };
    regra.alignment = { vertical: "middle", horizontal: "center" };
    regra.border = borda;
  });
  ws.getRow(h1).height = 20;
  ws.getRow(h2).height = 16;
  ws.pageSetup.printTitlesRow = `${h1}:${h2}`;
  ws.views = [{ state: "frozen", xSplit: colLinha || colProduto, ySplit: h2 }];

  // Produtos
  r = h2 + 1;
  const escreverProduto = (l: LinhaDiretoria, zebra: boolean) => {
    const row = ws.getRow(r);
    row.getCell(colProduto).value = l.produto;
    if (colLinha) row.getCell(colLinha).value = l.linha;
    const custo = row.getCell(colCusto);
    custo.value = l.custo;
    custo.numFmt = FMT_CUSTO;
    visao.colunas.forEach((coluna, i) => {
      const { preco, multiplicador } = colTabelas[i];
      // Preço gravado em centavos: o valor da célula é exatamente o que será aprovado.
      const valor = Math.round((l.precos[coluna.id] ?? 0) * 100) / 100;
      const cPreco = row.getCell(preco);
      cPreco.value = valor;
      cPreco.numFmt = FMT_PRECO;
      cPreco.font = { bold: true, color: { argb: XL.texto } };
      if (multiplicador) {
        const cMult = row.getCell(multiplicador);
        // Fórmula: se a diretoria ajustar o preço na planilha, o multiplicador acompanha.
        cMult.value = {
          formula: `IF(${custo.address}>0,${cPreco.address}/${custo.address},0)`,
          result: l.custo > 0 ? valor / l.custo : 0,
        };
        cMult.numFmt = FMT_MULT;
        cMult.font = { size: 9, color: { argb: XL.textoSuave } };
      }
    });
    row.getCell(colDecisao).dataValidation = {
      type: "list",
      allowBlank: true,
      formulae: [`"${DECISOES_DIRETORIA.join(",")}"`],
    };
    for (let col = 1; col <= ultima; col++) {
      const cell = row.getCell(col);
      cell.border = borda;
      if (zebra) preencher(cell, XL.zebra);
    }
    r++;
  };

  for (const grupo of visao.grupos) {
    if (visao.agrupado) {
      ws.mergeCells(r, 1, r, ultima);
      const cell = ws.getCell(r, 1);
      cell.value = `${grupo.linha}  —  ${grupo.itens.length} produto${grupo.itens.length === 1 ? "" : "s"}`;
      cell.font = { bold: true, size: 10, color: { argb: XL.texto } };
      preencher(cell, XL.grupo);
      cell.border = borda;
      r++;
    }
    grupo.itens.forEach((l, i) => escreverProduto(l, i % 2 === 1));
  }

  // Pontos de atenção
  if (visao.pontosAtencao.length > 0) {
    r++;
    Object.assign(ws.getCell(r, 1), {
      value: "Pontos de atenção",
      font: { bold: true, size: 10, color: { argb: XL.texto } },
    });
    r++;
    for (const ponto of visao.pontosAtencao) {
      ws.mergeCells(r, 1, r, ultima);
      Object.assign(ws.getCell(r, 1), {
        value: `• ${ponto}`,
        font: { size: 9, color: { argb: XL.texto } },
      });
      r++;
    }
  }

  // Assinaturas
  r += 2;
  const meio = Math.floor(ultima / 2);
  const blocos: { de: number; ate: number; titulo: string }[] = [
    {
      de: 1,
      ate: Math.max(1, meio - 1),
      titulo: opcoes.elaboradoPor.trim()
        ? `Elaborado por: ${opcoes.elaboradoPor.trim()}`
        : "Elaborado por",
    },
    { de: Math.min(ultima, meio + 1), ate: ultima, titulo: "Aprovação da diretoria" },
  ];
  ws.getRow(r).height = 30;
  for (const b of blocos) {
    if (b.ate > b.de) {
      ws.mergeCells(r, b.de, r, b.ate);
      ws.mergeCells(r + 1, b.de, r + 1, b.ate);
      ws.mergeCells(r + 2, b.de, r + 2, b.ate);
    }
    ws.getCell(r, b.de).border = { bottom: { style: "medium", color: { argb: XL.texto } } };
    Object.assign(ws.getCell(r + 1, b.de), {
      value: b.titulo,
      font: { size: 9, bold: true, color: { argb: XL.texto } },
      alignment: { horizontal: "center" },
    });
    Object.assign(ws.getCell(r + 2, b.de), {
      value: "Data: ____/____/______",
      font: { size: 9, color: { argb: XL.textoSuave } },
      alignment: { horizontal: "center" },
    });
  }

  // Aba de premissas: regra e indicadores por tabela
  const wsP = wb.addWorksheet("Premissas", {
    pageSetup: { paperSize: 9, orientation: "landscape", fitToPage: true, fitToWidth: 1, fitToHeight: 0 },
  });
  const cabecalhoP = [
    "Tabela",
    "Base",
    "Regra de formação",
    "Markup médio s/ custo",
    "Margem bruta média",
    "Menor preço",
    "Maior preço",
  ];
  [22, 18, 26, 20, 20, 14, 14].forEach((w, i) => (wsP.getColumn(i + 1).width = w));
  wsP.mergeCells(1, 1, 1, cabecalhoP.length);
  Object.assign(wsP.getCell(1, 1), {
    value: `Premissas de formação de preço — ${visao.perfil}`,
    font: { bold: true, size: 13, color: { argb: XL.texto } },
  });
  const hp = wsP.getRow(3);
  cabecalhoP.forEach((texto, i) => {
    const cell = hp.getCell(i + 1);
    cell.value = texto;
    estiloCabecalho(cell);
  });
  visao.colunas.forEach((coluna, i) => {
    const row = wsP.getRow(4 + i);
    row.values = [
      coluna.nome,
      coluna.base,
      coluna.regra,
      coluna.multiplicadorMedio,
      coluna.margemMedia,
      coluna.menorPreco,
      coluna.maiorPreco,
    ];
    row.getCell(4).numFmt = FMT_MULT;
    row.getCell(5).numFmt = FMT_PCT;
    row.getCell(6).numFmt = FMT_PRECO;
    row.getCell(7).numFmt = FMT_PRECO;
    for (let col = 1; col <= cabecalhoP.length; col++) {
      row.getCell(col).border = borda;
      if (i % 2 === 1) preencher(row.getCell(col), XL.zebra);
    }
  });
  const notaP = 4 + visao.colunas.length + 1;
  wsP.mergeCells(notaP, 1, notaP, cabecalhoP.length);
  Object.assign(wsP.getCell(notaP, 1), {
    value:
      "Markup = preço ÷ custo de fábrica. Margem bruta = (preço − custo de fábrica) ÷ preço. Médias calculadas sobre os produtos da proposta.",
    font: { italic: true, size: 9, color: { argb: XL.textoSuave } },
  });

  const filename = nomeArquivo(visao, "xlsx");
  const buffer = await wb.xlsx.writeBuffer();
  saveAs(
    new Blob([buffer], {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    }),
    filename,
  );
  void auditExport("excel", ENTIDADE_AUDITORIA, visao.totalProdutos, filename);
}

// ---------------------------------------------------------------------------
// PDF
// ---------------------------------------------------------------------------

type RGB = [number, number, number];
const PDF: Record<"cabecalho" | "regra" | "grupo" | "zebra" | "texto" | "suave" | "borda", RGB> = {
  cabecalho: [30, 41, 59],
  regra: [226, 232, 240],
  grupo: [241, 245, 249],
  zebra: [248, 250, 252],
  texto: [15, 23, 42],
  suave: [100, 116, 139],
  borda: [203, 213, 225],
};

export function exportarAprovacaoDiretoriaPDF(
  visao: VisaoDiretoria,
  opcoes: OpcoesAprovacaoDiretoria,
) {
  const doc = new jsPDF({ orientation: "landscape", unit: "pt", format: "a4" });
  const largura = doc.internal.pageSize.getWidth();
  const altura = doc.internal.pageSize.getHeight();
  const margem = 36;
  const mult = opcoes.mostrarMultiplicador;
  const comLinha = exibeColunaLinha(visao);

  const ultimoY = (fallback: number) =>
    (doc as unknown as { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? fallback;
  const garantirEspaco = (y: number, necessario: number) => {
    if (y + necessario <= altura - 44) return y;
    doc.addPage();
    return 48;
  };

  // Título e metadados
  doc.setFont("helvetica", "bold");
  doc.setFontSize(15);
  doc.setTextColor(...PDF.texto);
  doc.text(opcoes.titulo.trim() || OPCOES_DIRETORIA_PADRAO.titulo, margem, 44);
  let y = 62;
  doc.setFont("helvetica", "normal");
  if (opcoes.referencia.trim()) {
    doc.setFontSize(10);
    doc.text(opcoes.referencia.trim(), margem, y);
    y += 14;
  }
  doc.setFontSize(8.5);
  doc.setTextColor(...PDF.suave);
  doc.text(linhaMeta(visao, opcoes), margem, y);
  y += 10;

  // Tabela principal
  const inicioTabelas = comLinha ? 3 : 2;
  const totalColunas = inicioTabelas + visao.colunas.length + 1;

  const head: RowInput[] = [
    [
      { content: "Produto", rowSpan: 2, styles: { valign: "middle" } },
      ...(comLinha ? [{ content: "Linha", rowSpan: 2, styles: { valign: "middle" } } as CellDef] : []),
      { content: "Custo fábrica", rowSpan: 2, styles: { valign: "middle", halign: "right" } },
      ...visao.colunas.map((c): CellDef => ({ content: c.nome, styles: { halign: "center" } })),
      { content: "Decisão / observação", rowSpan: 2, styles: { valign: "middle", halign: "center" } },
    ],
    visao.colunas.map(
      (c): CellDef => ({
        content: c.regra,
        styles: {
          halign: "center",
          fontStyle: "italic",
          fontSize: 6.5,
          fillColor: PDF.regra,
          textColor: PDF.texto,
        },
      }),
    ),
  ];

  const produtoDaLinha: (LinhaDiretoria | null)[] = [];
  const body: RowInput[] = [];
  for (const grupo of visao.grupos) {
    if (visao.agrupado) {
      produtoDaLinha.push(null);
      body.push([
        {
          content: `${grupo.linha}  —  ${grupo.itens.length} produto${grupo.itens.length === 1 ? "" : "s"}`,
          colSpan: totalColunas,
          styles: {
            fillColor: PDF.grupo,
            fontStyle: "bold",
            textColor: PDF.texto,
            minCellHeight: 0,
            valign: "middle",
          },
        },
      ]);
    }
    for (const l of grupo.itens) {
      produtoDaLinha.push(l);
      body.push([
        l.produto,
        ...(comLinha ? [l.linha] : []),
        fmtCusto(l.custo),
        ...visao.colunas.map((c) => formatCurrency(l.precos[c.id] ?? 0)),
        "",
      ]);
    }
  }

  const columnStyles: Record<number, Partial<Styles>> = {
    0: { cellWidth: comLinha ? 110 : 140 },
    [inicioTabelas - 1]: { halign: "right", cellWidth: 62 },
    [totalColunas - 1]: { cellWidth: 92 },
  };
  if (comLinha) columnStyles[1] = { cellWidth: 64 };
  for (let i = 0; i < visao.colunas.length; i++) {
    columnStyles[inicioTabelas + i] = { halign: "right", fontStyle: "bold" };
  }

  autoTable(doc, {
    head,
    body,
    startY: y + 6,
    margin: { left: margem, right: margem, bottom: 44 },
    theme: "grid",
    styles: {
      fontSize: 8,
      cellPadding: 4,
      lineColor: PDF.borda,
      lineWidth: 0.5,
      textColor: PDF.texto,
      valign: mult ? "top" : "middle",
    },
    headStyles: {
      fillColor: PDF.cabecalho,
      textColor: 255,
      fontStyle: "bold",
      fontSize: 7.5,
      valign: "middle",
    },
    bodyStyles: { minCellHeight: mult ? 24 : 0 },
    alternateRowStyles: { fillColor: PDF.zebra },
    columnStyles,
    didDrawCell: (data) => {
      if (!mult || data.section !== "body") return;
      const linha = produtoDaLinha[data.row.index];
      const i = data.column.index - inicioTabelas;
      if (!linha || i < 0 || i >= visao.colunas.length) return;
      const x = linha.multiplicadores[visao.colunas[i].id] ?? 0;
      if (!(x > 0)) return;
      doc.setFont("helvetica", "normal");
      doc.setFontSize(6.5);
      doc.setTextColor(...PDF.suave);
      doc.text(
        `${fmtMultiplicador(x)} custo`,
        data.cell.x + data.cell.width - data.cell.padding("right"),
        data.cell.y + data.cell.height - 5,
        { align: "right" },
      );
    },
  });
  y = ultimoY(y) + 22;

  // Resumo por tabela
  y = garantirEspaco(y, 40 + visao.colunas.length * 16);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.setTextColor(...PDF.texto);
  doc.text("Resumo por tabela", margem, y);
  autoTable(doc, {
    head: [["Tabela", "Regra de formação", "Markup médio s/ custo", "Margem bruta média", "Menor preço", "Maior preço"]],
    body: visao.colunas.map((c) => [
      c.nome,
      c.regra,
      fmtMultiplicador(c.multiplicadorMedio),
      fmtPct(c.margemMedia),
      formatCurrency(c.menorPreco),
      formatCurrency(c.maiorPreco),
    ]),
    startY: y + 6,
    margin: { left: margem, right: margem, bottom: 44 },
    tableWidth: 560,
    theme: "grid",
    styles: { fontSize: 8, cellPadding: 3.5, lineColor: PDF.borda, lineWidth: 0.5, textColor: PDF.texto },
    headStyles: { fillColor: PDF.cabecalho, textColor: 255, fontStyle: "bold", fontSize: 7.5 },
    alternateRowStyles: { fillColor: PDF.zebra },
    columnStyles: {
      2: { halign: "right" },
      3: { halign: "right" },
      4: { halign: "right" },
      5: { halign: "right" },
    },
  });
  y = ultimoY(y) + 20;

  // Pontos de atenção
  if (visao.pontosAtencao.length > 0) {
    const linhas = visao.pontosAtencao.flatMap(
      (p) => doc.splitTextToSize(`• ${p}`, largura - margem * 2) as string[],
    );
    y = garantirEspaco(y, 20 + linhas.length * 11);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.setTextColor(...PDF.texto);
    doc.text("Pontos de atenção", margem, y);
    y += 14;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8.5);
    for (const linha of linhas) {
      doc.text(linha, margem, y);
      y += 11;
    }
    y += 10;
  }

  // Assinaturas
  y = garantirEspaco(y, 80);
  const larguraAssinatura = 260;
  const yLinha = y + 42;
  const blocos = [
    {
      x: margem,
      titulo: opcoes.elaboradoPor.trim()
        ? `Elaborado por: ${opcoes.elaboradoPor.trim()}`
        : "Elaborado por",
    },
    { x: largura - margem - larguraAssinatura, titulo: "Aprovação da diretoria" },
  ];
  doc.setDrawColor(...PDF.texto);
  doc.setLineWidth(0.6);
  for (const b of blocos) {
    const centro = b.x + larguraAssinatura / 2;
    doc.line(b.x, yLinha, b.x + larguraAssinatura, yLinha);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8.5);
    doc.setTextColor(...PDF.texto);
    doc.text(b.titulo, centro, yLinha + 12, { align: "center" });
    doc.setFont("helvetica", "normal");
    doc.setTextColor(...PDF.suave);
    doc.text("Data: ____/____/______", centro, yLinha + 24, { align: "center" });
  }

  // Rodapé em todas as páginas
  const paginas = doc.getNumberOfPages();
  for (let p = 1; p <= paginas; p++) {
    doc.setPage(p);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.5);
    doc.setTextColor(...PDF.suave);
    doc.text(RODAPE, margem, altura - 20);
    doc.text(`Página ${p} de ${paginas}`, largura - margem, altura - 20, { align: "right" });
  }

  const filename = nomeArquivo(visao, "pdf");
  doc.save(filename);
  void auditExport("pdf", ENTIDADE_AUDITORIA, visao.totalProdutos, filename);
}
