/**
 * Utilitário centralizado para exportação Excel usando ExcelJS
 * Substitui o pacote xlsx (vulnerável a prototype pollution)
 */
import ExcelJS from 'exceljs';
import { saveAs } from 'file-saver';

export interface ExcelColumn {
  header: string;
  key: string;
  width?: number;
}

export interface ExcelExportOptions {
  filename: string;
  sheetName?: string;
  columns?: ExcelColumn[];
  headerStyle?: Partial<ExcelJS.Style>;
  includeTimestamp?: boolean;
}

/**
 * Exporta dados para Excel
 */
export async function exportToExcel<T extends Record<string, any>>(
  data: T[],
  options: ExcelExportOptions
): Promise<void> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'BiMaster';
  workbook.created = new Date();
  
  const sheetName = options.sheetName || 'Dados';
  const worksheet = workbook.addWorksheet(sheetName);
  
  // Definir colunas
  if (options.columns) {
    worksheet.columns = options.columns.map(col => ({
      header: col.header,
      key: col.key,
      width: col.width || 15,
    }));
  } else if (data.length > 0) {
    // Auto-detectar colunas
    const keys = Object.keys(data[0]);
    worksheet.columns = keys.map(key => ({
      header: key,
      key,
      width: 15,
    }));
  }
  
  // Adicionar dados
  data.forEach(row => {
    worksheet.addRow(row);
  });
  
  // Estilizar header
  const headerRow = worksheet.getRow(1);
  headerRow.font = { bold: true };
  headerRow.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FFE0E0E0' },
  };
  headerRow.alignment = { horizontal: 'center' };
  
  // Aplicar bordas
  worksheet.eachRow((row, rowNumber) => {
    row.eachCell(cell => {
      cell.border = {
        top: { style: 'thin' },
        left: { style: 'thin' },
        bottom: { style: 'thin' },
        right: { style: 'thin' },
      };
    });
  });
  
  // Gerar filename
  let filename = options.filename;
  if (options.includeTimestamp) {
    const timestamp = new Date().toISOString().split('T')[0];
    filename = `${filename}_${timestamp}`;
  }
  if (!filename.endsWith('.xlsx')) {
    filename += '.xlsx';
  }
  
  // Exportar
  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], { 
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' 
  });
  saveAs(blob, filename);
}

/**
 * Lê um arquivo Excel e retorna os dados como array de objetos
 */
export async function readExcelFile<T = Record<string, any>>(
  file: File,
  options?: { sheetIndex?: number; headerRow?: number }
): Promise<T[]> {
  const workbook = new ExcelJS.Workbook();
  const arrayBuffer = await file.arrayBuffer();
  await workbook.xlsx.load(arrayBuffer);
  
  const sheetIndex = options?.sheetIndex ?? 0;
  const headerRow = options?.headerRow ?? 1;
  
  const worksheet = workbook.worksheets[sheetIndex];
  if (!worksheet) {
    throw new Error('Planilha não encontrada');
  }
  
  const data: T[] = [];
  const headers: string[] = [];
  
  worksheet.eachRow((row, rowNumber) => {
    if (rowNumber === headerRow) {
      // Capturar headers
      row.eachCell((cell, colNumber) => {
        headers[colNumber - 1] = String(cell.value || `col_${colNumber}`);
      });
    } else if (rowNumber > headerRow) {
      // Capturar dados
      const rowData: Record<string, any> = {};
      row.eachCell((cell, colNumber) => {
        const header = headers[colNumber - 1];
        if (header) {
          rowData[header] = cell.value;
        }
      });
      if (Object.keys(rowData).length > 0) {
        data.push(rowData as T);
      }
    }
  });
  
  return data;
}

/**
 * Cria um modelo de importação Excel
 */
export async function createImportTemplate(
  columns: ExcelColumn[],
  filename: string,
  sampleData?: Record<string, any>[]
): Promise<void> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'BiMaster';
  
  const worksheet = workbook.addWorksheet('Modelo');
  
  worksheet.columns = columns.map(col => ({
    header: col.header,
    key: col.key,
    width: col.width || 20,
  }));
  
  // Estilizar header
  const headerRow = worksheet.getRow(1);
  headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
  headerRow.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FF4472C4' },
  };
  headerRow.alignment = { horizontal: 'center' };
  
  // Adicionar dados de exemplo se fornecidos
  if (sampleData) {
    sampleData.forEach(row => {
      worksheet.addRow(row);
    });
  }
  
  // Exportar
  let finalFilename = filename;
  if (!finalFilename.endsWith('.xlsx')) {
    finalFilename += '.xlsx';
  }
  
  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], { 
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' 
  });
  saveAs(blob, finalFilename);
}

/**
 * Compatibilidade: Funções que imitam a API do xlsx para facilitar migração
 */
export const XLSXCompat = {
  /**
   * Converte array de objetos para sheet e exporta
   */
  async writeFile(data: Record<string, any>[], filename: string, sheetName = 'Sheet1') {
    await exportToExcel(data, { filename, sheetName });
  },
  
  /**
   * Lê arquivo Excel
   */
  async readFile(file: File) {
    return readExcelFile(file);
  },
};
