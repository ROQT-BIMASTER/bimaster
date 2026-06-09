import ExcelJS from 'exceljs';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { formatInTimeZone } from 'date-fns-tz';
import type { EstoqueUnificadoRow } from '@/hooks/estoque/useEstoqueUnificado';
import type { ModoExibicao } from '@/lib/estoque/modoExibicao';

export interface ExportKpis {
  caixas: number;
  displays: number;
  unidades: number;
  total_un: number;
  bloqueado: number;
  disponivel: number;
  pendente: number;
  equivalente_cx: number;
}

export interface ExportFiltros {
  empresaIds: number[];
  empresasLabels?: string[];
  marcas: string[];
  linhas: string[];
  busca: string;
  somenteComSaldo: boolean;
  consolidar: boolean;
  modo: ModoExibicao;
}

const TZ = 'America/Sao_Paulo';

function nowLabel(): string {
  return formatInTimeZone(new Date(), TZ, "dd/MM/yyyy HH:mm");
}
function nowFile(): string {
  return formatInTimeZone(new Date(), TZ, "yyyyMMdd-HHmm");
}

function buildFiltrosLines(f: ExportFiltros): string[] {
  const lines: string[] = [];
  lines.push(`Modo de exibição: ${f.modo.toUpperCase()}`);
  lines.push(
    `Empresas: ${
      f.empresasLabels && f.empresasLabels.length
        ? f.empresasLabels.join(', ')
        : f.empresaIds.length
          ? f.empresaIds.join(', ')
          : 'Todas'
    }`,
  );
  if (f.marcas.length) lines.push(`Marcas: ${f.marcas.join(', ')}`);
  if (f.linhas.length) lines.push(`Linhas: ${f.linhas.join(', ')}`);
  if (f.busca) lines.push(`Busca: "${f.busca}"`);
  lines.push(`Apenas com saldo: ${f.somenteComSaldo ? 'Sim' : 'Não'}`);
  lines.push(`Consolidar empresas: ${f.consolidar ? 'Sim' : 'Não'}`);
  return lines;
}

function rowToRecord(r: EstoqueUnificadoRow) {
  const fcx = Number(r.fator_cx_para_un ?? 0);
  const equivCx = fcx > 0 ? Number(r.disponivel_total_em_unidades || 0) / fcx : 0;
  return {
    empresa: r.filial_nome ?? r.raiz_abrev ?? String(r.empresa ?? ''),
    codigo: String(r.produto_raiz ?? ''),
    produto: r.raiz_nome ?? `Produto ${r.produto_raiz}`,
    ean: r.ean_raiz ?? '',
    marca: r.marca ?? '',
    linha: r.linha ?? '',
    caixas: Math.round(Number(r.saldo_em_caixas || 0)),
    displays: Math.round(Number(r.saldo_em_displays || 0)),
    unidades: Math.round(Number(r.saldo_em_unidades || 0)),
    total_un: Math.round(Number(r.saldo_total_em_unidades || 0)),
    bloqueado: Math.round(Number(r.bloqueado_total_em_unidades || 0)),
    disponivel: Math.round(Number(r.disponivel_total_em_unidades || 0)),
    pendente: Math.round(Number(r.pendente_total_em_unidades || 0)),
    equiv_cx: Math.round(equivCx * 10) / 10,
    skus: Number(r.skus_envolvidos || 0),
  };
}

function triggerBlobDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export async function exportEstoqueToXlsx(
  rows: EstoqueUnificadoRow[],
  kpis: ExportKpis,
  filtros: ExportFiltros,
) {
  const wb = new ExcelJS.Workbook();
  wb.creator = 'Bimaster';
  wb.created = new Date();
  const ws = wb.addWorksheet('Estoque Unificado', {
    views: [{ state: 'frozen', ySplit: 9 }],
  });

  // Título
  ws.mergeCells('A1:N1');
  const title = ws.getCell('A1');
  title.value = 'Estoque Unificado — 3 Níveis';
  title.font = { bold: true, size: 14 };
  ws.getCell('A2').value = `Gerado em ${nowLabel()} (America/Sao_Paulo)`;
  ws.getCell('A2').font = { italic: true, color: { argb: 'FF666666' } };

  // KPIs
  ws.getCell('A4').value = 'KPIs';
  ws.getCell('A4').font = { bold: true };
  const kpiPairs: Array<[string, number]> = [
    ['Caixas Master', kpis.caixas],
    ['Displays / Box', kpis.displays],
    ['Unidades', kpis.unidades],
    ['Total em UN', kpis.total_un],
    ['Bloqueado em UN', kpis.bloqueado],
    ['Disponível em UN', kpis.disponivel],
    ['Pendente em UN', kpis.pendente],
    ['Disponível em CX (eq.)', kpis.equivalente_cx],
  ];
  kpiPairs.forEach(([label, value], i) => {
    const col = 1 + (i % 4) * 2; // A,C,E,G or A,C,E,G again
    const row = 5 + Math.floor(i / 4);
    ws.getCell(row, col).value = label;
    ws.getCell(row, col).font = { bold: true };
    ws.getCell(row, col + 1).value = value;
    ws.getCell(row, col + 1).numFmt = '#,##0';
  });

  // Filtros (linha 7)
  ws.mergeCells('A7:N7');
  ws.getCell('A7').value = 'Filtros aplicados: ' + buildFiltrosLines(filtros).join(' • ');
  ws.getCell('A7').font = { italic: true, color: { argb: 'FF666666' } };

  // Cabeçalho na linha 9
  const headerRow = 9;
  const headers = [
    'Empresa', 'Código', 'Produto-Raiz', 'EAN', 'Marca', 'Linha',
    'Caixas', 'Displays', 'Unidades', 'Total UN',
    'Bloqueado', 'Disponível', 'Pendente', 'Equiv. CX', 'SKUs',
  ];
  headers.forEach((h, i) => {
    const c = ws.getCell(headerRow, i + 1);
    c.value = h;
    c.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1F2937' } };
    c.alignment = { vertical: 'middle', horizontal: i < 6 ? 'left' : 'right' };
  });

  // Dados
  rows.forEach((r, idx) => {
    const rec = rowToRecord(r);
    const rowIdx = headerRow + 1 + idx;
    const values = [
      rec.empresa, rec.codigo, rec.produto, rec.ean, rec.marca, rec.linha,
      rec.caixas, rec.displays, rec.unidades, rec.total_un,
      rec.bloqueado, rec.disponivel, rec.pendente, rec.equiv_cx, rec.skus,
    ];
    values.forEach((v, i) => {
      const cell = ws.getCell(rowIdx, i + 1);
      cell.value = v as any;
      if (i >= 6) cell.numFmt = i === 13 ? '#,##0.0' : '#,##0';
    });
  });

  // Larguras
  const widths = [28, 10, 60, 16, 18, 18, 10, 10, 10, 12, 12, 12, 12, 12, 8];
  widths.forEach((w, i) => { ws.getColumn(i + 1).width = w; });

  // Autofilter
  ws.autoFilter = { from: { row: headerRow, column: 1 }, to: { row: headerRow, column: headers.length } };

  const buf = await wb.xlsx.writeBuffer();
  triggerBlobDownload(
    new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }),
    `estoque-unificado-${nowFile()}.xlsx`,
  );
}

export function exportEstoqueToPdf(
  rows: EstoqueUnificadoRow[],
  kpis: ExportKpis,
  filtros: ExportFiltros,
) {
  const doc = new jsPDF({ orientation: 'landscape', unit: 'pt', format: 'a4' });
  const pageWidth = doc.internal.pageSize.getWidth();

  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.text('Estoque Unificado — 3 Níveis', 32, 36);
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(110);
  doc.text(`Gerado em ${nowLabel()} (America/Sao_Paulo)`, 32, 50);

  // KPIs em linha
  const kpiLine =
    `Caixas: ${kpis.caixas.toLocaleString('pt-BR')}   ` +
    `Displays: ${kpis.displays.toLocaleString('pt-BR')}   ` +
    `Unidades: ${kpis.unidades.toLocaleString('pt-BR')}   ` +
    `Total UN: ${kpis.total_un.toLocaleString('pt-BR')}   ` +
    `Bloq.: ${kpis.bloqueado.toLocaleString('pt-BR')}   ` +
    `Disp.: ${kpis.disponivel.toLocaleString('pt-BR')}   ` +
    `Pend.: ${kpis.pendente.toLocaleString('pt-BR')}   ` +
    `Eq.CX: ${kpis.equivalente_cx.toLocaleString('pt-BR')}`;
  doc.setTextColor(30);
  doc.text(kpiLine, 32, 64);

  const filtrosTxt = doc.splitTextToSize(
    'Filtros: ' + buildFiltrosLines(filtros).join(' • '),
    pageWidth - 64,
  );
  doc.setTextColor(110);
  doc.text(filtrosTxt, 32, 78);

  const body = rows.map((r) => {
    const rec = rowToRecord(r);
    return [
      rec.empresa, rec.codigo, rec.produto, rec.ean,
      rec.caixas.toLocaleString('pt-BR'),
      rec.displays.toLocaleString('pt-BR'),
      rec.unidades.toLocaleString('pt-BR'),
      rec.total_un.toLocaleString('pt-BR'),
      rec.bloqueado.toLocaleString('pt-BR'),
      rec.disponivel.toLocaleString('pt-BR'),
      rec.pendente.toLocaleString('pt-BR'),
      rec.equiv_cx.toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 }),
      String(rec.skus),
    ];
  });

  autoTable(doc, {
    startY: 78 + filtrosTxt.length * 11 + 8,
    head: [[
      'Empresa', 'Código', 'Produto-Raiz', 'EAN',
      'Caixas', 'Displays', 'Unidades', 'Total UN',
      'Bloq.', 'Disp.', 'Pend.', 'Eq.CX', 'SKUs',
    ]],
    body,
    styles: { fontSize: 7, cellPadding: 3, overflow: 'linebreak' },
    headStyles: { fillColor: [31, 41, 55], textColor: 255, fontStyle: 'bold' },
    columnStyles: {
      0: { cellWidth: 90 },
      1: { cellWidth: 40 },
      2: { cellWidth: 170 },
      3: { cellWidth: 60 },
      4: { halign: 'right', cellWidth: 42 },
      5: { halign: 'right', cellWidth: 42 },
      6: { halign: 'right', cellWidth: 48 },
      7: { halign: 'right', cellWidth: 52 },
      8: { halign: 'right', cellWidth: 48 },
      9: { halign: 'right', cellWidth: 48 },
      10: { halign: 'right', cellWidth: 48 },
      11: { halign: 'right', cellWidth: 44 },
      12: { halign: 'right', cellWidth: 30 },
    },
    didDrawPage: (data) => {
      const pageCount = (doc as any).internal.getNumberOfPages();
      const pageStr = `Página ${data.pageNumber} de ${pageCount}`;
      doc.setFontSize(8);
      doc.setTextColor(110);
      doc.text(pageStr, pageWidth - 32, doc.internal.pageSize.getHeight() - 16, { align: 'right' });
    },
    margin: { left: 32, right: 32 },
  });

  doc.save(`estoque-unificado-${nowFile()}.pdf`);
}
