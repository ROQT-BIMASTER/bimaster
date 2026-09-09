/**
 * Geração da planilha profissional do Estoque do Fornecedor.
 * Usa ExcelJS (mesma dependência de src/utils/excelExport.ts).
 */
import ExcelJS from 'exceljs';
import { saveAs } from 'file-saver';
import { format } from 'date-fns';
import { parseLocalDate } from '@/lib/utils/parseLocalDate';
import type { FornecedorIntegradoRow } from '@/hooks/estoque/useFornecedorIntegrado';

export interface FilialCol {
  id: number;
  nome: string;
  abrev: string;
}

export interface ExportFornecedorParams {
  rows: FornecedorIntegradoRow[];
  filiais: FilialCol[];
  filtrosResumo: string;
}

const HEADER_BG = 'FF1F3B57';
const ZEBRA_BG = 'FFF5F7FA';
const TOTAL_BG = 'FFE8EDF3';
const RED = 'FFC0392B';
const AMBER = 'FFB7791F';

const ORIGEM_LABEL: Record<string, string> = {
  master_caixa: 'Master · caixa',
  master_unitario: 'Master · unitário',
  depara_manual: 'De-para manual',
  fabrica_produtos: 'Fábrica',
};

function nowSaoPaulo(): string {
  return new Intl.DateTimeFormat('pt-BR', {
    timeZone: 'America/Sao_Paulo',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date());
}

function toDate(value: string | null | undefined): Date | null {
  if (!value) return null;
  const d = parseLocalDate(value.slice(0, 10));
  return d && !Number.isNaN(d.getTime()) ? d : null;
}

function saldoFilial(r: FornecedorIntegradoRow, id: number): { cx: number | null; un: number | null } {
  const s = (r.saldos_por_empresa as any)?.[String(id)];
  if (!s || !r.casado) return { cx: null, un: null };
  const cx = s.disp_cx != null ? Number(s.disp_cx) : null;
  const un = s.disp_un != null ? Number(s.disp_un) : null;
  if (cx == null && un == null) return { cx: null, un: null };
  return { cx, un };
}

export async function exportFornecedorEstoque({ rows, filiais, filtrosResumo }: ExportFornecedorParams): Promise<string> {
  const wb = new ExcelJS.Workbook();
  wb.creator = 'BiMaster';
  wb.created = new Date();

  const ws = wb.addWorksheet('Estoque fornecedor', {
    views: [{ state: 'frozen', ySplit: 4 }],
    pageSetup: { orientation: 'landscape', fitToPage: true, fitToWidth: 1, fitToHeight: 0 },
  });

  const baseHeaders = [
    { h: 'Fornecedor', w: 32 },
    { h: 'EAN caixa', w: 16 },
    { h: 'Cód. Futura', w: 14 },
    { h: 'Descrição', w: 46 },
    { h: 'Status', w: 12 },
    { h: 'Categoria', w: 20 },
    { h: 'Linha', w: 18 },
    { h: 'Estoque forn. (CX)', w: 18 },
    { h: 'Validade', w: 12 },
    { h: 'Prazo (dias)', w: 12 },
    { h: 'Casado', w: 10 },
    { h: 'Origem do casamento', w: 20 },
    { h: 'Nosso código', w: 14 },
    { h: 'SKU', w: 16 },
    { h: 'Nome comercial', w: 40 },
    { h: 'Disponível (CX)', w: 15 },
    { h: 'Disponível (UN)', w: 15 },
  ];
  const filialHeaders = filiais.flatMap((f) => [
    { h: `${f.abrev} CX`, w: 12 },
    { h: `${f.abrev} UN`, w: 12 },
  ]);
  const tailHeaders = [
    { h: 'Total CX', w: 13 },
    { h: 'Total UN', w: 13 },
  ];
  const headers = [...baseHeaders, ...filialHeaders, ...tailHeaders];
  const lastCol = headers.length;

  ws.columns = headers.map((h) => ({ width: h.w }));

  // Título
  ws.mergeCells(1, 1, 1, lastCol);
  const titleCell = ws.getCell(1, 1);
  titleCell.value = 'Estoque do fornecedor';
  titleCell.font = { bold: true, size: 16, name: 'Arial' };
  ws.getRow(1).height = 24;

  ws.mergeCells(2, 1, 2, lastCol);
  const subCell = ws.getCell(2, 1);
  subCell.value = `Gerado em ${nowSaoPaulo()} (America/Sao_Paulo) · ${rows.length} item(ns) · Filtros: ${filtrosResumo}`;
  subCell.font = { size: 10, italic: true, color: { argb: 'FF5A6B7C' }, name: 'Arial' };

  ws.getRow(3).height = 6;

  // Cabeçalho
  const headerRow = ws.getRow(4);
  headers.forEach((h, i) => {
    const c = headerRow.getCell(i + 1);
    c.value = h.h;
    c.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 10, name: 'Arial' };
    c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: HEADER_BG } };
    c.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
    c.border = {
      top: { style: 'thin', color: { argb: HEADER_BG } },
      bottom: { style: 'thin', color: { argb: HEADER_BG } },
      left: { style: 'thin', color: { argb: HEADER_BG } },
      right: { style: 'thin', color: { argb: HEADER_BG } },
    };
  });
  headerRow.height = 30;
  ws.autoFilter = { from: { row: 4, column: 1 }, to: { row: 4, column: lastCol } };

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  let somaFornCx = 0;
  let somaDispCx = 0;
  let somaDispUn = 0;
  const somaFilial = new Map<number, { cx: number; un: number }>();
  filiais.forEach((f) => somaFilial.set(f.id, { cx: 0, un: 0 }));
  const porFornecedor = new Map<string, { itens: number; casados: number; fornCx: number; dispCx: number; dispUn: number }>();

  rows.forEach((r, idx) => {
    const validade = toDate(r.validade_ultimo_lote);
    const dispCx = r.casado ? Number((r as any).nosso_disponivel_cx ?? 0) : null;
    const dispUn = r.casado ? Number((r as any).nosso_disponivel_un ?? 0) : null;

    const values: any[] = [
      r.empresa_nome ?? '—',
      r.ean_caixa ?? '',
      r.futura_codigo ?? '',
      r.futura_descricao ?? '',
      r.futura_status ?? '',
      r.categoria ?? '',
      r.nome_linha ?? '',
      r.fornecedor_caixas != null ? Number(r.fornecedor_caixas) : null,
      validade,
      r.validade_dias ?? null,
      r.casado ? 'Sim' : 'Não',
      r.casado ? (ORIGEM_LABEL[r.origem_match ?? ''] ?? r.origem_match ?? '') : '',
      r.nosso_codigo ?? '',
      r.sku ?? '',
      r.nome_comercial ?? '',
      dispCx,
      dispUn,
    ];

    let totalCx = 0;
    let totalUn = 0;
    for (const f of filiais) {
      const s = saldoFilial(r, f.id);
      values.push(s.cx, s.un);
      if (s.cx) totalCx += s.cx;
      if (s.un) totalUn += s.un;
      const acc = somaFilial.get(f.id)!;
      acc.cx += s.cx ?? 0;
      acc.un += s.un ?? 0;
    }
    values.push(r.casado ? totalCx : null, r.casado ? totalUn : null);

    const row = ws.addRow(values);
    row.font = { size: 10, name: 'Arial' };
    row.alignment = { vertical: 'middle' };

    if (idx % 2 === 1) {
      row.eachCell({ includeEmpty: true }, (cell) => {
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: ZEBRA_BG } };
      });
    }

    // Formatos numéricos
    row.getCell(8).numFmt = '#,##0.0000';
    row.getCell(9).numFmt = 'dd/mm/yyyy';
    row.getCell(10).numFmt = '#,##0';
    row.getCell(16).numFmt = '#,##0.0';
    row.getCell(17).numFmt = '#,##0';
    for (let i = 0; i < filiais.length; i++) {
      row.getCell(18 + i * 2).numFmt = '#,##0.0';
      row.getCell(19 + i * 2).numFmt = '#,##0';
    }
    row.getCell(lastCol - 1).numFmt = '#,##0.0';
    row.getCell(lastCol).numFmt = '#,##0';
    row.getCell(lastCol - 1).font = { size: 10, bold: true, name: 'Arial' };
    row.getCell(lastCol).font = { size: 10, bold: true, name: 'Arial' };

    if (validade) {
      const diff = Math.floor((validade.getTime() - today.getTime()) / 86_400_000);
      if (diff < 0) row.getCell(9).font = { size: 10, bold: true, color: { argb: RED }, name: 'Arial' };
      else if (diff < 90) row.getCell(9).font = { size: 10, bold: true, color: { argb: AMBER }, name: 'Arial' };
    }

    row.eachCell({ includeEmpty: true }, (cell) => {
      cell.border = {
        bottom: { style: 'hair', color: { argb: 'FFD9DEE5' } },
      };
    });

    somaFornCx += Number(r.fornecedor_caixas ?? 0);
    somaDispCx += dispCx ?? 0;
    somaDispUn += dispUn ?? 0;

    const key = r.empresa_nome ?? '—';
    const agg = porFornecedor.get(key) ?? { itens: 0, casados: 0, fornCx: 0, dispCx: 0, dispUn: 0 };
    agg.itens += 1;
    if (r.casado) agg.casados += 1;
    agg.fornCx += Number(r.fornecedor_caixas ?? 0);
    agg.dispCx += dispCx ?? 0;
    agg.dispUn += dispUn ?? 0;
    porFornecedor.set(key, agg);
  });

  // Linha de totais
  const totalValues: any[] = new Array(lastCol).fill(null);
  totalValues[0] = `TOTAL (${rows.length} itens)`;
  totalValues[7] = somaFornCx;
  totalValues[15] = somaDispCx;
  totalValues[16] = somaDispUn;
  filiais.forEach((f, i) => {
    const acc = somaFilial.get(f.id)!;
    totalValues[17 + i * 2] = acc.cx;
    totalValues[18 + i * 2] = acc.un;
  });
  totalValues[lastCol - 2] = somaDispCx;
  totalValues[lastCol - 1] = somaDispUn;

  const totalRow = ws.addRow(totalValues);
  totalRow.eachCell({ includeEmpty: true }, (cell) => {
    cell.font = { bold: true, size: 10, name: 'Arial' };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: TOTAL_BG } };
    cell.border = { top: { style: 'thin', color: { argb: HEADER_BG } } };
  });
  totalRow.getCell(8).numFmt = '#,##0.0000';
  totalRow.getCell(16).numFmt = '#,##0.0';
  totalRow.getCell(17).numFmt = '#,##0';
  for (let i = 0; i < filiais.length; i++) {
    totalRow.getCell(18 + i * 2).numFmt = '#,##0.0';
    totalRow.getCell(19 + i * 2).numFmt = '#,##0';
  }
  totalRow.getCell(lastCol - 1).numFmt = '#,##0.0';
  totalRow.getCell(lastCol).numFmt = '#,##0';

  // ---------------- Aba Resumo ----------------
  const rs = wb.addWorksheet('Resumo');
  rs.columns = [{ width: 38 }, { width: 20 }, { width: 18 }, { width: 18 }, { width: 18 }, { width: 16 }];

  const addTitle = (text: string) => {
    const r = rs.addRow([text]);
    r.getCell(1).font = { bold: true, size: 12, name: 'Arial' };
    return r;
  };
  const addHead = (cells: string[]) => {
    const r = rs.addRow(cells);
    r.eachCell((c) => {
      c.font = { bold: true, size: 10, color: { argb: 'FFFFFFFF' }, name: 'Arial' };
      c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: HEADER_BG } };
      c.alignment = { horizontal: 'center' };
    });
    return r;
  };

  addTitle('Estoque do fornecedor — resumo');
  rs.addRow([`Gerado em ${nowSaoPaulo()} (America/Sao_Paulo)`]).getCell(1).font = { italic: true, size: 10, name: 'Arial' };
  rs.addRow([`Filtros: ${filtrosResumo}`]).getCell(1).font = { italic: true, size: 10, name: 'Arial' };
  rs.addRow([]);

  const casados = rows.filter((r) => r.casado).length;
  addHead(['Indicador', 'Valor']);
  const indicadores: [string, number | string, string?][] = [
    ['Itens no recorte', rows.length, '#,##0'],
    ['Itens casados', casados, '#,##0'],
    ['% casados', rows.length ? casados / rows.length : 0, '0.0%'],
    ['Caixas no fornecedor (CX)', somaFornCx, '#,##0.0000'],
    ['Disponível nosso (CX)', somaDispCx, '#,##0.0'],
    ['Disponível nosso (UN)', somaDispUn, '#,##0'],
    ['Cobertura vs. fornecedor', somaFornCx > 0 ? somaDispCx / somaFornCx : 0, '0.0%'],
  ];
  for (const [label, value, fmt] of indicadores) {
    const r = rs.addRow([label, value]);
    r.getCell(1).font = { size: 10, name: 'Arial' };
    r.getCell(2).font = { size: 10, name: 'Arial' };
    if (fmt) r.getCell(2).numFmt = fmt;
  }
  rs.addRow([]);

  addTitle('Por fornecedor');
  addHead(['Fornecedor', 'Itens', 'Casados', 'CX no fornecedor', 'Disponível (CX)', 'Disponível (UN)']);
  for (const [nome, a] of Array.from(porFornecedor.entries()).sort((x, y) => x[0].localeCompare(y[0], 'pt-BR'))) {
    const r = rs.addRow([nome, a.itens, a.casados, a.fornCx, a.dispCx, a.dispUn]);
    r.font = { size: 10, name: 'Arial' };
    r.getCell(2).numFmt = '#,##0';
    r.getCell(3).numFmt = '#,##0';
    r.getCell(4).numFmt = '#,##0.0000';
    r.getCell(5).numFmt = '#,##0.0';
    r.getCell(6).numFmt = '#,##0';
  }
  rs.addRow([]);

  addTitle('Por filial');
  addHead(['Filial', 'Disponível (CX)', 'Disponível (UN)']);
  for (const f of filiais) {
    const acc = somaFilial.get(f.id)!;
    const r = rs.addRow([`${f.abrev} — ${f.nome}`, acc.cx, acc.un]);
    r.font = { size: 10, name: 'Arial' };
    r.getCell(2).numFmt = '#,##0.0';
    r.getCell(3).numFmt = '#,##0';
  }

  const filename = `estoque-fornecedor_${format(new Date(), 'yyyy-MM-dd')}.xlsx`;
  const buffer = await wb.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
  saveAs(blob, filename);
  return filename;
}
