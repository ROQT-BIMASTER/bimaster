import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Printer, Loader2 } from "lucide-react";
import { formatLocalDate } from "@/utils/dateUtils";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import type { PaymentQueueItem } from "@/hooks/useFinancialPaymentQueue";

interface PaymentBankPrintSummaryProps {
  item: PaymentQueueItem;
}

// formatCurrency importado abaixo

export function PaymentBankPrintSummary({ item }: PaymentBankPrintSummaryProps) {
  const [loading, setLoading] = useState(false);

  const handlePrint = async () => {
    setLoading(true);

    // Fetch supplier bank/PIX data
    let pixChave = "";
    let pixTipo = "";
    let banco = "";
    let agencia = "";
    let conta = "";
    let tipoConta = "";
    let favorecido = "";
    let linhaDigitavel = "";

    try {
      const cnpjClean = item.supplier_document?.replace(/\D/g, "") || "";
      if (cnpjClean.length >= 11) {
        const { data } = await supabase
          .from("fabrica_fornecedores")
          .select("pix_chave, pix_tipo, banco, agencia, conta, tipo_conta, favorecido, linha_digitavel")
          .eq("cnpj", cnpjClean)
          .eq("ativo", true)
          .maybeSingle();

        if (data) {
          pixChave = data.pix_chave || "";
          pixTipo = data.pix_tipo || "";
          banco = data.banco || "";
          agencia = data.agencia || "";
          conta = data.conta || "";
          tipoConta = data.tipo_conta || "";
          favorecido = data.favorecido || "";
          linhaDigitavel = data.linha_digitavel || "";
        }
      }
    } catch (err) {
      console.error("Erro ao buscar dados bancários:", err);
    }

    setLoading(false);

    const printWindow = window.open("", "_blank", "width=700,height=600");
    if (!printWindow) {
      toast.error("Não foi possível abrir a janela de impressão. Verifique o bloqueador de pop-ups.");
      return;
    }

    const hasBankData = banco || agencia || conta;
    const hasPixData = pixChave;
    const boletoBarcode = (item as any).boleto_barcode || linhaDigitavel;

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
    .pix-highlight { background: #fffbeb; font-weight: bold; font-family: monospace; letter-spacing: 0.5px; }
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
    ${favorecido ? `<tr><th>Favorecido</th><td>${favorecido}</td></tr>` : ""}
  </table>

  ${hasPixData ? `
  <p class="section-title">🔑 Dados PIX para Pagamento</p>
  <table>
    <tr><th>Tipo da Chave</th><td>${pixTipo || "—"}</td></tr>
    <tr><th>Chave PIX</th><td class="pix-highlight">${pixChave}</td></tr>
    ${favorecido ? `<tr><th>Favorecido</th><td>${favorecido}</td></tr>` : ""}
  </table>
  ` : ""}

  ${hasBankData ? `
  <p class="section-title">Dados Bancários</p>
  <table>
    ${banco ? `<tr><th>Banco</th><td>${banco}</td></tr>` : ""}
    ${agencia ? `<tr><th>Agência</th><td>${agencia}</td></tr>` : ""}
    ${conta ? `<tr><th>Conta</th><td>${conta}${tipoConta ? ` (${tipoConta})` : ""}</td></tr>` : ""}
    ${favorecido ? `<tr><th>Favorecido</th><td>${favorecido}</td></tr>` : ""}
  </table>
  ` : ""}

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

  ${boletoBarcode ? `
  <p class="section-title">Linha Digitável</p>
  <table>
    <tr><td style="font-family: monospace; letter-spacing: 1px;">${boletoBarcode}</td></tr>
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
    <Button variant="outline" size="sm" onClick={handlePrint} disabled={loading} className="gap-1.5">
      {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Printer className="h-3.5 w-3.5" />}
      Imprimir p/ Banco
    </Button>
  );
}
