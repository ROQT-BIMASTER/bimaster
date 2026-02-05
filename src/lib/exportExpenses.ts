import ExcelJS from "exceljs";
import { saveAs } from "file-saver";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import type { DepartmentExpense } from "@/hooks/useDepartmentExpenses";
import type { PaymentQueueItem } from "@/hooks/useFinancialPaymentQueue";

const CATEGORY_LABELS: Record<string, string> = {
  viagem: "Viagem e Hospedagem",
  transporte: "Transporte",
  material: "Material de Escritório",
  equipamento: "Equipamentos",
  servicos: "Serviços Terceirizados",
  treinamento: "Treinamento e Capacitação",
  software: "Software e Licenças",
  marketing: "Marketing e Divulgação",
  alimentacao: "Alimentação",
  manutencao: "Manutenção",
  outros: "Outros",
};

const STATUS_LABELS: Record<string, string> = {
  pending: "Pendente",
  approved: "Aprovado",
  rejected: "Rejeitado",
  pending_financial: "Aguard. Financeiro",
  paid: "Pago",
  accepted: "Aceito",
  cancelled: "Cancelado",
};

export async function exportDepartmentExpensesToExcel(
  expenses: DepartmentExpense[],
  filename: string = "despesas-departamento"
) {
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet("Despesas");

  // Header styling
  worksheet.columns = [
    { header: "Código", key: "code", width: 15 },
    { header: "Departamento", key: "department", width: 20 },
    { header: "Filial", key: "empresa", width: 20 },
    { header: "Categoria", key: "category", width: 25 },
    { header: "Descrição", key: "description", width: 40 },
    { header: "Solicitante", key: "creator", width: 20 },
    { header: "Data Despesa", key: "expense_date", width: 15 },
    { header: "Valor Previsto", key: "valor_previsto", width: 18 },
    { header: "Valor Realizado", key: "valor_realizado", width: 18 },
    { header: "Status", key: "status", width: 18 },
    { header: "Data Criação", key: "created_at", width: 15 },
  ];

  // Style header row
  const headerRow = worksheet.getRow(1);
  headerRow.font = { bold: true, color: { argb: "FFFFFFFF" } };
  headerRow.fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FF2563EB" },
  };
  headerRow.alignment = { horizontal: "center", vertical: "middle" };

  // Add data rows
  expenses.forEach((expense) => {
    worksheet.addRow({
      code: expense.code,
      department: expense.department?.nome || "-",
      empresa: expense.empresa?.nome || expense.empresa_nome || "-",
      category: CATEGORY_LABELS[expense.category] || expense.category,
      description: expense.description || "-",
      creator: expense.creator?.nome || "-",
      expense_date: expense.expense_date
        ? format(new Date(expense.expense_date), "dd/MM/yyyy", { locale: ptBR })
        : "-",
      valor_previsto: expense.valor_previsto || 0,
      valor_realizado: expense.valor_realizado || 0,
      status: STATUS_LABELS[expense.status] || expense.status,
      created_at: format(new Date(expense.created_at), "dd/MM/yyyy", { locale: ptBR }),
    });
  });

  // Format currency columns
  worksheet.getColumn("valor_previsto").numFmt = '"R$ "#,##0.00';
  worksheet.getColumn("valor_realizado").numFmt = '"R$ "#,##0.00';

  // Add totals row
  const totalRow = worksheet.addRow({
    code: "",
    department: "",
    empresa: "",
    category: "",
    description: "",
    creator: "",
    expense_date: "TOTAL:",
    valor_previsto: expenses.reduce((sum, e) => sum + (e.valor_previsto || 0), 0),
    valor_realizado: expenses.reduce((sum, e) => sum + (e.valor_realizado || 0), 0),
    status: "",
    created_at: "",
  });
  totalRow.font = { bold: true };

  // Generate and download
  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], { 
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" 
  });
  saveAs(blob, `${filename}-${format(new Date(), "yyyy-MM-dd")}.xlsx`);
}

export async function exportPaymentQueueToExcel(
  items: PaymentQueueItem[],
  filename: string = "central-pagamentos"
) {
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet("Pagamentos");

  const SOURCE_TYPE_LABELS: Record<string, string> = {
    trade_entry: "Trade - Lançamento",
    trade_investment: "Trade - Investimento",
    trade_campaign: "Trade - Campanha",
    event_expense: "Evento",
    department_expense: "Departamento",
  };

  worksheet.columns = [
    { header: "Código", key: "code", width: 15 },
    { header: "Origem", key: "source", width: 25 },
    { header: "Departamento", key: "department", width: 20 },
    { header: "Filial", key: "empresa", width: 20 },
    { header: "Fornecedor", key: "supplier", width: 25 },
    { header: "CNPJ/CPF", key: "document", width: 20 },
    { header: "Tipo Doc.", key: "doc_type", width: 15 },
    { header: "Nº Documento", key: "doc_number", width: 18 },
    { header: "Valor", key: "amount", width: 18 },
    { header: "Vencimento", key: "due_date", width: 15 },
    { header: "Status", key: "status", width: 15 },
    { header: "Data Solicitação", key: "requested_at", width: 18 },
  ];

  // Style header row
  const headerRow = worksheet.getRow(1);
  headerRow.font = { bold: true, color: { argb: "FFFFFFFF" } };
  headerRow.fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FF059669" },
  };
  headerRow.alignment = { horizontal: "center", vertical: "middle" };

  // Add data rows
  items.forEach((item) => {
    worksheet.addRow({
      code: item.code,
      source: SOURCE_TYPE_LABELS[item.source_type] || item.source_type,
      department: item.department_name || "-",
      empresa: item.empresa_nome || "-",
      supplier: item.supplier_name,
      document: item.supplier_document || "-",
      doc_type: item.document_type || "-",
      doc_number: item.document_number || "-",
      amount: item.amount,
      due_date: format(new Date(item.due_date), "dd/MM/yyyy", { locale: ptBR }),
      status: STATUS_LABELS[item.financial_status] || item.financial_status,
      requested_at: format(new Date(item.requested_at), "dd/MM/yyyy HH:mm", { locale: ptBR }),
    });
  });

  // Format currency column
  worksheet.getColumn("amount").numFmt = '"R$ "#,##0.00';

  // Add totals row
  const totalRow = worksheet.addRow({
    code: "",
    source: "",
    department: "",
    empresa: "",
    supplier: "",
    document: "",
    doc_type: "",
    doc_number: "TOTAL:",
    amount: items.reduce((sum, i) => sum + (i.amount || 0), 0),
    due_date: "",
    status: "",
    requested_at: "",
  });
  totalRow.font = { bold: true };

  // Generate and download
  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], { 
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" 
  });
  saveAs(blob, `${filename}-${format(new Date(), "yyyy-MM-dd")}.xlsx`);
}
