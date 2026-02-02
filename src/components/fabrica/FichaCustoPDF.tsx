import { Button } from "@/components/ui/button";
import { FileDown } from "lucide-react";
import { 
  CustoItem, 
  FichaCustoConfig,
  calcularCustosTotais,
  formatCurrency,
  getTipoInsumoLabel
} from "@/lib/fabrica/custo-types";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface FichaCustoPDFProps {
  produto: {
    nome: string;
    codigo: string;
  };
  itens: CustoItem[];
  config: FichaCustoConfig;
}

export function FichaCustoPDF({ produto, itens, config }: FichaCustoPDFProps) {
  const totais = calcularCustosTotais(itens, config);

  const handleExportPDF = () => {
    // Criar conteúdo HTML para impressão
    const printContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Ficha de Custos - ${produto.nome}</title>
        <style>
          * { margin: 0; padding: 0; box-sizing: border-box; }
          body { font-family: Arial, sans-serif; font-size: 10px; padding: 20px; }
          .header { text-align: center; margin-bottom: 20px; border-bottom: 2px solid #333; padding-bottom: 10px; }
          .header h1 { font-size: 16px; margin-bottom: 5px; }
          .header p { color: #666; }
          table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
          th, td { border: 1px solid #ddd; padding: 6px 8px; text-align: left; }
          th { background: #f5f5f5; font-weight: bold; }
          .text-right { text-align: right; }
          .text-center { text-align: center; }
          .font-bold { font-weight: bold; }
          .bg-highlight { background: #e8f4ff; }
          .bg-total { background: #d4edda; }
          .bg-markup { background: #fff3cd; }
          .footer { margin-top: 20px; text-align: center; font-size: 9px; color: #666; }
          .summary { display: flex; justify-content: space-between; margin-top: 15px; }
          .summary-item { text-align: center; padding: 10px; background: #f8f9fa; border-radius: 4px; }
          .summary-item .value { font-size: 14px; font-weight: bold; color: #0066cc; }
          @media print {
            body { print-color-adjust: exact; -webkit-print-color-adjust: exact; }
          }
        </style>
      </head>
      <body>
        <div class="header">
          <h1>FICHA TÉCNICA DE CUSTOS</h1>
          <p><strong>${produto.nome}</strong> | Código: ${produto.codigo}</p>
          ${config.fornecedor_mao_obra ? `<p>Fornecedor de Serviço: ${config.fornecedor_mao_obra}</p>` : ''}
        </div>

        <table>
          <thead>
            <tr>
              <th style="width: 60px;">Código</th>
              <th>Insumo</th>
              <th style="width: 100px;">Tipo</th>
              <th style="width: 80px;" class="text-right">NF (R$)</th>
              <th style="width: 80px;" class="text-right">Serviço (R$)</th>
              <th style="width: 80px;" class="text-right">Condição (R$)</th>
              <th style="width: 80px;">NF Ref.</th>
            </tr>
          </thead>
          <tbody>
            <tr class="bg-highlight">
              <td class="text-center">-</td>
              <td class="font-bold">Mão de Obra</td>
              <td>Serviço</td>
              <td class="text-right font-bold">${formatCurrency(config.custo_mao_obra_nf)}</td>
              <td class="text-right font-bold">${formatCurrency(config.custo_mao_obra_servico)}</td>
              <td class="text-center">-</td>
              <td class="text-center">-</td>
            </tr>
            ${itens.map(item => `
              <tr>
                <td class="text-center">${item.codigo || '-'}</td>
                <td>
                  ${item.nome}
                  ${item.fornecedor ? `<br><small style="color: #666;">${item.fornecedor}</small>` : ''}
                </td>
                <td>${getTipoInsumoLabel(item.tipo_insumo)}</td>
                <td class="text-right">${formatCurrency(item.custo_nf)}</td>
                <td class="text-right">${formatCurrency(item.custo_servico)}</td>
                <td class="text-right">${formatCurrency(item.custo_condicao)}</td>
                <td>${item.nf_referencia || '-'}</td>
              </tr>
            `).join('')}
            <tr class="bg-markup">
              <td colspan="3" class="font-bold">${config.percentual_markup}% sobre o custo</td>
              <td class="text-right font-bold">${formatCurrency(totais.custoNfTotal * (config.percentual_markup / 100))}</td>
              <td class="text-right font-bold">${formatCurrency(totais.custoServicoTotal * (config.percentual_markup / 100))}</td>
              <td class="text-right font-bold">${formatCurrency(totais.custoCondicaoTotal * (config.percentual_markup / 100))}</td>
              <td></td>
            </tr>
            <tr class="bg-total font-bold">
              <td colspan="3" class="font-bold">TOTAIS</td>
              <td class="text-right">${formatCurrency(totais.custoNfTotal + config.custo_mao_obra_nf)}</td>
              <td class="text-right">${formatCurrency(totais.custoServicoTotal + config.custo_mao_obra_servico)}</td>
              <td class="text-right">${formatCurrency(totais.custoCondicaoTotal)}</td>
              <td class="text-right font-bold" style="font-size: 12px; color: #0066cc;">${formatCurrency(totais.custoFinalTotal)}</td>
            </tr>
          </tbody>
        </table>

        <div class="summary" style="display: grid; grid-template-columns: repeat(5, 1fr); gap: 10px;">
          <div class="summary-item">
            <div>Custo NF</div>
            <div class="value">${formatCurrency(totais.custoNfTotal + config.custo_mao_obra_nf)}</div>
          </div>
          <div class="summary-item">
            <div>Custo Serviço</div>
            <div class="value">${formatCurrency(totais.custoServicoTotal + config.custo_mao_obra_servico)}</div>
          </div>
          <div class="summary-item">
            <div>Custo Condição</div>
            <div class="value">${formatCurrency(totais.custoCondicaoTotal)}</div>
          </div>
          <div class="summary-item">
            <div>Markup (${config.percentual_markup}%)</div>
            <div class="value">${formatCurrency(totais.markupValor)}</div>
          </div>
          <div class="summary-item" style="background: #d4edda;">
            <div>CUSTO TOTAL</div>
            <div class="value" style="font-size: 16px;">${formatCurrency(totais.custoFinalTotal)}</div>
          </div>
        </div>

        <div class="footer">
          <p>Gerado em ${format(new Date(), "dd 'de' MMMM 'de' yyyy 'às' HH:mm", { locale: ptBR })}</p>
        </div>
      </body>
      </html>
    `;

    // Abrir janela de impressão
    const printWindow = window.open('', '_blank');
    if (printWindow) {
      printWindow.document.write(printContent);
      printWindow.document.close();
      printWindow.focus();
      setTimeout(() => {
        printWindow.print();
      }, 250);
    }
  };

  return (
    <Button variant="outline" size="sm" onClick={handleExportPDF}>
      <FileDown className="h-4 w-4 mr-2" />
      Exportar PDF
    </Button>
  );
}
