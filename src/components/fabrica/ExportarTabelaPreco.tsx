import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Download, FileSpreadsheet, FileText, File } from "lucide-react";
import { toast } from "sonner";
import * as XLSX from "xlsx";
import { formatarMoeda } from "@/lib/fabrica/pricing-calculator";

interface Props {
  tabelaId: string;
  tabelaNome: string;
  tabelaBaseId?: string | null;
}

export function ExportarTabelaPreco({ tabelaId, tabelaNome, tabelaBaseId }: Props) {
  const [exportando, setExportando] = useState(false);

  const buscarDadosExportacao = async () => {
    const { data: precos, error } = await supabase
      .from("fabrica_precos_produtos")
      .select(`
        *,
        produto:produto_id(codigo, nome, descricao)
      `)
      .eq("tabela_id", tabelaId)
      .eq("ativo", true)
      .order("produto(nome)");

    if (error) throw error;
    
    // Buscar preços da tabela base se existir
    let precosTabelaBase: Record<string, number> = {};
    if (tabelaBaseId) {
      const { data: precosBase } = await supabase
        .from("fabrica_precos_produtos")
        .select("produto_id, preco_final")
        .eq("tabela_id", tabelaBaseId)
        .eq("ativo", true);
      
      if (precosBase) {
        precosTabelaBase = Object.fromEntries(
          precosBase.map(p => [p.produto_id, p.preco_final || 0])
        );
      }
    }
    
    return { precos, precosTabelaBase };
  };

  const exportarExcelMutation = useMutation({
    mutationFn: async () => {
      setExportando(true);
      const { precos: dados, precosTabelaBase } = await buscarDadosExportacao();

      const linhas = dados.map((preco: any) => {
        const precoBase = precosTabelaBase[preco.produto_id];
        const referencia = precoBase && precoBase > 0 ? precoBase : (preco.custo_base || 0);
        const precoFinal = preco.preco_final || 0;
        const margemCalculada = precoFinal > 0 && referencia > 0
          ? ((precoFinal - referencia) / precoFinal) * 100
          : (preco.margem_lucro_percentual || 0);

        return {
          "Código": preco.produto.codigo,
          "Produto": preco.produto.nome,
          "Descrição": preco.produto.descricao || "",
          [tabelaBaseId ? "Preço Base" : "Custo Base"]: referencia,
          "Preço Calculado": preco.preco_calculado || 0,
          "Preço Final": precoFinal,
          "Margem (%)": margemCalculada.toFixed(2),
        };
      });

      const worksheet = XLSX.utils.json_to_sheet(linhas);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, "Preços");

      // Auto-ajustar largura das colunas
      const maxWidth = linhas.reduce((w, r) => Math.max(w, r.Produto.length), 10);
      worksheet["!cols"] = [
        { wch: 15 }, // Código
        { wch: maxWidth }, // Produto
        { wch: 30 }, // Descrição
        { wch: 12 }, // Custo Base
        { wch: 15 }, // Preço Calculado
        { wch: 15 }, // Preço Final
        { wch: 10 }, // Margem
      ];

      XLSX.writeFile(workbook, `tabela_preco_${tabelaNome.replace(/\s/g, "_")}.xlsx`);
      setExportando(false);
      toast.success("Planilha exportada com sucesso!");
    },
    onError: (error: any) => {
      setExportando(false);
      toast.error("Erro ao exportar: " + error.message);
    },
  });

  const exportarCSVMutation = useMutation({
    mutationFn: async () => {
      setExportando(true);
      const { precos: dados, precosTabelaBase } = await buscarDadosExportacao();

      const linhas = dados.map((preco: any) => {
        const precoBase = precosTabelaBase[preco.produto_id];
        const referencia = precoBase && precoBase > 0 ? precoBase : (preco.custo_base || 0);
        const precoFinal = preco.preco_final || 0;
        const margemCalculada = precoFinal > 0 && referencia > 0
          ? ((precoFinal - referencia) / precoFinal) * 100
          : (preco.margem_lucro_percentual || 0);

        return {
          "Código": preco.produto.codigo,
          "Produto": preco.produto.nome,
          [tabelaBaseId ? "Preço Base" : "Custo Base"]: referencia,
          "Preço Final": precoFinal,
          "Margem": margemCalculada.toFixed(2),
        };
      });

      const worksheet = XLSX.utils.json_to_sheet(linhas);
      const csv = XLSX.utils.sheet_to_csv(worksheet);

      const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
      const link = document.createElement("a");
      link.href = URL.createObjectURL(blob);
      link.download = `tabela_preco_${tabelaNome.replace(/\s/g, "_")}.csv`;
      link.click();

      setExportando(false);
      toast.success("CSV exportado com sucesso!");
    },
    onError: (error: any) => {
      setExportando(false);
      toast.error("Erro ao exportar: " + error.message);
    },
  });

  const exportarPDFMutation = useMutation({
    mutationFn: async () => {
      setExportando(true);
      const { precos: dados, precosTabelaBase } = await buscarDadosExportacao();

      // Criar HTML para impressão
      const html = `
        <!DOCTYPE html>
        <html>
        <head>
          <title>Tabela de Preço - ${tabelaNome}</title>
          <style>
            body { font-family: Arial, sans-serif; margin: 20px; }
            h1 { text-align: center; color: #333; }
            table { width: 100%; border-collapse: collapse; margin-top: 20px; }
            th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
            th { background-color: #f4f4f4; font-weight: bold; }
            .right { text-align: right; }
            @media print {
              body { margin: 0; }
            }
          </style>
        </head>
        <body>
          <h1>Tabela de Preço: ${tabelaNome}</h1>
          <p>Data: ${new Date().toLocaleDateString("pt-BR")}</p>
          <table>
            <thead>
              <tr>
                <th>Código</th>
                <th>Produto</th>
                <th class="right">${tabelaBaseId ? "Preço Base" : "Custo Base"}</th>
                <th class="right">Preço Final</th>
                <th class="right">Margem (%)</th>
              </tr>
            </thead>
            <tbody>
              ${dados
                .map((preco: any) => {
                  const precoBase = precosTabelaBase[preco.produto_id];
                  const referencia = precoBase && precoBase > 0 ? precoBase : (preco.custo_base || 0);
                  const precoFinal = preco.preco_final || 0;
                  const margemCalculada = precoFinal > 0 && referencia > 0
                    ? ((precoFinal - referencia) / precoFinal) * 100
                    : (preco.margem_lucro_percentual || 0);

                  return `
                <tr>
                  <td>${preco.produto.codigo}</td>
                  <td>${preco.produto.nome}</td>
                  <td class="right">${formatarMoeda(referencia)}</td>
                  <td class="right"><strong>${formatarMoeda(precoFinal)}</strong></td>
                  <td class="right">${margemCalculada.toFixed(2)}%</td>
                </tr>
              `;
                })
                .join("")}
            </tbody>
          </table>
        </body>
        </html>
      `;

      const printWindow = window.open("", "_blank");
      if (printWindow) {
        printWindow.document.write(html);
        printWindow.document.close();
        printWindow.focus();
        setTimeout(() => {
          printWindow.print();
          printWindow.close();
        }, 250);
      }

      setExportando(false);
      toast.success("Abrindo visualização para impressão...");
    },
    onError: (error: any) => {
      setExportando(false);
      toast.error("Erro ao exportar: " + error.message);
    },
  });

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" disabled={exportando}>
          <Download className="h-4 w-4 mr-2" />
          {exportando ? "Exportando..." : "Exportar"}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={() => exportarExcelMutation.mutate()}>
          <FileSpreadsheet className="h-4 w-4 mr-2" />
          Excel (.xlsx)
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => exportarCSVMutation.mutate()}>
          <File className="h-4 w-4 mr-2" />
          CSV
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => exportarPDFMutation.mutate()}>
          <FileText className="h-4 w-4 mr-2" />
          PDF / Impressão
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
