import { useRef } from "react";
import { Button } from "@/components/ui/button";
import { Printer } from "lucide-react";
import { formatLocalDate } from "@/utils/dateUtils";
import type { PaymentQueueItem } from "@/hooks/useFinancialPaymentQueue";

interface PaymentBankPrintSummaryProps {
  item: PaymentQueueItem;
}

const formatCurrency = (value: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);

export function PaymentBankPrintSummary({ item }: PaymentBankPrintSummaryProps) {
  const handlePrint = () => {
    const printWindow = window.open("", "_blank", "width=700,height=500");
    if (!printWindow) return;

    const html = `
<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <title>Lançamento Bancário - ${item.code}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: Arial, Helvetica, sans-serif; padding: 24px; color: #111; font-size: 13px; }
    h1 { font-size: 16px; text-align: center; margin-bottom: 4px; text-transform: uppercase; letter-spacing: 1px; }
    .subtitle { text-align: center; font-size: 11px; color: #666; margin-bottom: 16px; border-bottom: 2px solid #333; padding-bottom: 8px; }
    table { width: 100%; border-collapse: collapse; margin-bottom: 12px; }
    th, td { border: 1px solid #ccc; padding: 6px 10px; text-align: left; }
    th { background: #f0f0f0; font-size: 11px; text-transform: uppercase; color: #555; width: 140px; }
    td { font-size: 13px; }
    .amount { font-size: 18px; font-weight: bold; color: #d97706; }
    .section-title { font-size: 12px; font-weight: bold; text-transform: uppercase; color: #333; margin: 12px 0 6px; padding: 4px 0; border-bottom: 1px solid #ddd; }
    .footer { margin-top: 24px; font-size: 10px; color: #999; text-align: center; border-top: 1px solid #ddd; padding-top: 8px; }
    .sig-area { margin-top: 40px; display: flex; justify-content: space-between; }
    .sig-line { width: 200px; border-top: 1px solid #333; padding-top: 4px; text-align: center; font-size: 11px; color: #555; }
    @media print { body { padding: 12px; } }
  </style>
</head>
<body>
  <h1>Resumo para Lançamento Bancário</h1>
  <p class="subtitle">${item.code} • ${item.empresa_nome || "—"}</p>

  <p class="section-title">Fornecedor</p>
  <table>
    <tr><th>Razão Social</th><td>${item.supplier_name}</td></tr>
    <tr><th>CNPJ / CPF</th><td>${item.supplier_document || "—"}</td></tr>
  </table>

  <p class="section-title">Dados do Pagamento</p>
  <table>
    <tr><th>Valor</th><td class="amount">${formatCurrency(item.amount)}</td></tr>
    <tr><th>Vencimento</th><td>${formatLocalDate(item.due_date, "dd/MM/yyyy")}</td></tr>
    <tr><th>Portador</th><td>${item.portador || "—"}</td></tr>
    <tr><th>Tipo Documento</th><td>${(item.document_type || "—").toUpperCase()}</td></tr>
    <tr><th>Nº Documento</th><td>${item.document_number || "—"}</td></tr>
  </table>

  ${item.description ? `
  <p class="section-title">Descrição</p>
  <table>
    <tr><td>${item.description}</td></tr>
  </table>
  ` : ""}

  ${item.boleto_barcode ? `
  <p class="section-title">Linha Digitável</p>
  <table>
    <tr><td style="font-family: monospace; letter-spacing: 1px;">${item.boleto_barcode}</td></tr>
  </table>
  ` : ""}

  <div class="sig-area">
    <div class="sig-line">Preparado por</div>
    <div class="sig-line">Autorizado por</div>
  </div>

  <p class="footer">Impresso em ${new Date().toLocaleDateString("pt-BR")} às ${new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })} • Sistema BiMaster</p>

  <script>window.onload = function() { window.print(); }</script>
</body>
</html>`;

    printWindow.document.write(html);
    printWindow.document.close();
  };

  return (
    <Button variant="outline" size="sm" onClick={handlePrint} className="gap-1.5">
      <Printer className="h-3.5 w-3.5" />
      Imprimir p/ Banco
    </Button>
  );
}
