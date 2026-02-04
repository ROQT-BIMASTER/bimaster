/**
 * Utilitários para exportação Excel usando ExcelJS
 * Substitui o pacote xlsx (vulnerável) por exceljs (seguro)
 */
import ExcelJS from 'exceljs';
import { saveAs } from 'file-saver';

export interface SheetData {
  name: string;
  data: Record<string, unknown>[];
  columns?: { header: string; key: string; width?: number }[];
}

/**
 * Cria e baixa um arquivo Excel com uma ou mais planilhas
 */
export async function exportToExcel(
  sheets: SheetData[],
  filename: string
): Promise<void> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'BiMaster';
  workbook.created = new Date();

  for (const sheet of sheets) {
    const worksheet = workbook.addWorksheet(sheet.name);

    // Se columns foi definido, usa as colunas especificadas
    if (sheet.columns && sheet.columns.length > 0) {
      worksheet.columns = sheet.columns.map(col => ({
        header: col.header,
        key: col.key,
        width: col.width || 15,
      }));
    } else if (sheet.data.length > 0) {
      // Auto-detecta colunas do primeiro objeto
      const keys = Object.keys(sheet.data[0]);
      worksheet.columns = keys.map(key => ({
        header: key,
        key: key,
        width: 15,
      }));
    }

    // Adiciona os dados
    sheet.data.forEach(row => {
      worksheet.addRow(row);
    });

    // Estiliza o cabeçalho
    const headerRow = worksheet.getRow(1);
    headerRow.font = { bold: true };
    headerRow.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFE0E0E0' },
    };
  }

  // Gera o arquivo e baixa
  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], { 
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' 
  });
  saveAs(blob, filename.endsWith('.xlsx') ? filename : `${filename}.xlsx`);
}

/**
 * Versão simplificada para exportar array de objetos
 */
export async function exportArrayToExcel(
  data: Record<string, unknown>[],
  sheetName: string,
  filename: string
): Promise<void> {
  await exportToExcel([{ name: sheetName, data }], filename);
}

/**
 * Lê um arquivo Excel e retorna os dados
 */
export async function readExcelFile(
  file: File
): Promise<{ sheetName: string; data: unknown[][] }[]> {
  const workbook = new ExcelJS.Workbook();
  const arrayBuffer = await file.arrayBuffer();
  await workbook.xlsx.load(arrayBuffer);

  const sheets: { sheetName: string; data: unknown[][] }[] = [];

  workbook.eachSheet((worksheet) => {
    const data: unknown[][] = [];
    worksheet.eachRow((row) => {
      const rowData: unknown[] = [];
      row.eachCell({ includeEmpty: true }, (cell) => {
        rowData.push(cell.value);
      });
      data.push(rowData);
    });
    sheets.push({ sheetName: worksheet.name, data });
  });

  return sheets;
}

/**
 * Cria um workbook para uso mais avançado
 */
export function createWorkbook(): ExcelJS.Workbook {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'BiMaster';
  workbook.created = new Date();
  return workbook;
}

/**
 * Salva um workbook como arquivo Excel
 */
export async function saveWorkbook(
  workbook: ExcelJS.Workbook,
  filename: string
): Promise<void> {
  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], { 
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' 
  });
  saveAs(blob, filename.endsWith('.xlsx') ? filename : `${filename}.xlsx`);
}
