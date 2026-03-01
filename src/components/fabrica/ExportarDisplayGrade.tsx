import { useState } from "react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { FileSpreadsheet, Loader2, Printer } from "lucide-react";
import ExcelJS from "exceljs";
import { saveAs } from "file-saver";

interface ExportarDisplayGradeProps {
  produtoId: string;
  produtoNome: string;
  produtoCodigo: string;
}

async function carregarDadosGrade(produtoId: string) {
  const { data: displayProduto, error: prodError } = await supabase
    .from("fabrica_produtos")
    .select("id, nome, codigo, codigo_barras_ean, foto_url, ncm, processo_anvisa, tipo_rotulagem, itens_display")
    .eq("id", produtoId)
    .single();

  if (prodError || !displayProduto) throw new Error("Produto não encontrado");

  const { data: gradeItens, error: gradeError } = await supabase
    .from("fabrica_produto_grade_itens")
    .select("quantidade, ordem, cor_numero, produto_filho:fabrica_produtos!produto_filho_id(id, nome, codigo, codigo_barras_ean, foto_url, ncm, processo_anvisa, tipo_rotulagem)")
    .eq("produto_pai_id", produtoId)
    .order("ordem");

  if (gradeError) throw gradeError;

  if (!gradeItens || gradeItens.length === 0) {
    toast.warning("Este display não possui itens na grade.");
    return null;
  }

  return { displayProduto, gradeItens };
}

export function ExportarDisplayGrade({ produtoId, produtoNome, produtoCodigo }: ExportarDisplayGradeProps) {
  const [exportandoExcel, setExportandoExcel] = useState(false);
  const [exportandoPdf, setExportandoPdf] = useState(false);

  const exportarExcel = async () => {
    setExportandoExcel(true);
    try {
      const dados = await carregarDadosGrade(produtoId);
      if (!dados) return;
      const { displayProduto, gradeItens } = dados;

      const workbook = new ExcelJS.Workbook();
      workbook.creator = "BiMaster";
      workbook.created = new Date();

      const ws = workbook.addWorksheet("Display Grade");

      ws.columns = [
        { header: "Item No.", key: "item_no", width: 18 },
        { header: "Color No.", key: "cor_numero", width: 12 },
        { header: "Color/Commercial Name", key: "cor_nome", width: 30 },
        { header: "Picture", key: "picture", width: 15 },
        { header: "Picture of box", key: "picture_box", width: 15 },
        { header: "Item Name", key: "item_name", width: 35 },
        { header: "Qty per item", key: "qty_per_item", width: 14 },
        { header: "Qty per box", key: "qty_per_box", width: 14 },
        { header: "Type", key: "type", width: 14 },
        { header: "Barcode NO.", key: "barcode", width: 20 },
        { header: "Batch NO.", key: "batch", width: 14 },
        { header: "Production date", key: "production_date", width: 16 },
        { header: "Expiry date", key: "expiry_date", width: 14 },
        { header: "Proc Anvisa", key: "proc_anvisa", width: 18 },
        { header: "NCM", key: "ncm", width: 14 },
      ];

      const headerRow = ws.getRow(1);
      headerRow.height = 32;
      headerRow.font = { bold: true, color: { argb: "FFFFFFFF" }, size: 10 };
      headerRow.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF4472C4" } };
      headerRow.alignment = { horizontal: "center", vertical: "middle", wrapText: true };

      const totalQty = gradeItens.reduce((s: number, i: any) => s + (i.quantidade || 0), 0);

      gradeItens.forEach((item: any, index: number) => {
        const filho = item.produto_filho;
        const row = ws.addRow({
          item_no: displayProduto.codigo,
          cor_numero: item.cor_numero || String(index + 1),
          cor_nome: filho?.nome || "",
          picture: filho?.foto_url ? "Ver foto" : "",
          picture_box: "",
          item_name: "",
          qty_per_item: item.quantidade || 1,
          qty_per_box: "",
          type: filho?.tipo_rotulagem || displayProduto.tipo_rotulagem || "",
          barcode: filho?.codigo_barras_ean || "",
          batch: "",
          production_date: "",
          expiry_date: "",
          proc_anvisa: filho?.processo_anvisa || displayProduto.processo_anvisa || "",
          ncm: filho?.ncm || displayProduto.ncm || "",
        });
        row.height = 22;
        row.font = { size: 10 };
        row.alignment = { vertical: "middle" };

        if (filho?.foto_url) {
          const cell = row.getCell("picture");
          cell.value = { text: "Ver foto", hyperlink: filho.foto_url };
          cell.font = { size: 10, color: { argb: "FF0563C1" }, underline: true };
        }
      });

      const totalRow = ws.addRow({
        item_no: displayProduto.codigo,
        cor_numero: "",
        cor_nome: "",
        picture: "",
        picture_box: displayProduto.foto_url ? "Ver foto" : "",
        item_name: displayProduto.nome,
        qty_per_item: "",
        qty_per_box: totalQty,
        type: displayProduto.tipo_rotulagem || "",
        barcode: displayProduto.codigo_barras_ean || "",
        batch: "",
        production_date: "",
        expiry_date: "",
        proc_anvisa: displayProduto.processo_anvisa || "",
        ncm: displayProduto.ncm || "",
      });

      totalRow.height = 26;
      totalRow.font = { bold: true, size: 10 };
      totalRow.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFD9E2F3" } };
      totalRow.alignment = { vertical: "middle" };

      if (displayProduto.foto_url) {
        const cell = totalRow.getCell("picture_box");
        cell.value = { text: "Ver foto", hyperlink: displayProduto.foto_url };
        cell.font = { bold: true, size: 10, color: { argb: "FF0563C1" }, underline: true };
      }

      ws.eachRow((row) => {
        row.eachCell((cell) => {
          cell.border = {
            top: { style: "thin" },
            left: { style: "thin" },
            bottom: { style: "thin" },
            right: { style: "thin" },
          };
        });
      });

      const timestamp = new Date().toISOString().split("T")[0];
      const filename = `Grade_${produtoCodigo}_${timestamp}.xlsx`;

      const buffer = await workbook.xlsx.writeBuffer();
      const blob = new Blob([buffer], {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      });
      saveAs(blob, filename);
      toast.success("Planilha exportada com sucesso!");
    } catch (error: any) {
      console.error("Erro ao exportar grade:", error);
      toast.error("Erro ao exportar: " + (error.message || "Erro desconhecido"));
    } finally {
      setExportandoExcel(false);
    }
  };

  const imprimirPdf = async () => {
    setExportandoPdf(true);
    try {
      const dados = await carregarDadosGrade(produtoId);
      if (!dados) return;
      const { displayProduto, gradeItens } = dados;

      const totalQty = gradeItens.reduce((s: number, i: any) => s + (i.quantidade || 0), 0);

      const linhasHtml = gradeItens.map((item: any, index: number) => {
        const filho = item.produto_filho;
        return `<tr>
          <td>${displayProduto.codigo}</td>
          <td style="text-align:center">${item.cor_numero || index + 1}</td>
          <td>${filho?.nome || ""}</td>
          <td style="text-align:center">${item.quantidade || 1}</td>
          <td>${filho?.tipo_rotulagem || displayProduto.tipo_rotulagem || ""}</td>
          <td style="font-family:monospace">${filho?.codigo_barras_ean || ""}</td>
          <td>${filho?.processo_anvisa || displayProduto.processo_anvisa || ""}</td>
          <td>${filho?.ncm || displayProduto.ncm || ""}</td>
        </tr>`;
      }).join("");

      const html = `<!DOCTYPE html>
<html><head><title>Grade - ${displayProduto.codigo}</title>
<style>
  @media print { @page { size: landscape; margin: 10mm; } }
  body { font-family: Arial, sans-serif; font-size: 11px; margin: 20px; }
  h2 { margin: 0 0 4px; font-size: 16px; }
  p.sub { color: #666; margin: 0 0 12px; font-size: 11px; }
  table { width: 100%; border-collapse: collapse; }
  th { background: #4472C4; color: #fff; padding: 6px 8px; text-align: left; font-size: 10px; }
  td { border: 1px solid #ccc; padding: 5px 8px; font-size: 11px; }
  tr:nth-child(even) { background: #f5f7fa; }
  tr.total { background: #D9E2F3; font-weight: bold; }
  .footer { margin-top: 12px; font-size: 9px; color: #999; }
</style></head><body>
<h2>Grade do Display: ${displayProduto.nome}</h2>
<p class="sub">Código: ${displayProduto.codigo} | EAN: ${displayProduto.codigo_barras_ean || "—"} | Gerado em: ${new Date().toLocaleDateString("pt-BR")}</p>
<table>
  <thead><tr>
    <th>Item No.</th><th>Color No.</th><th>Nome</th><th>Qtd</th><th>Tipo</th><th>Barcode</th><th>Proc. Anvisa</th><th>NCM</th>
  </tr></thead>
  <tbody>
    ${linhasHtml}
    <tr class="total">
      <td>${displayProduto.codigo}</td>
      <td style="text-align:center">—</td>
      <td>${displayProduto.nome} (TOTAL)</td>
      <td style="text-align:center">${totalQty}</td>
      <td>${displayProduto.tipo_rotulagem || ""}</td>
      <td style="font-family:monospace">${displayProduto.codigo_barras_ean || ""}</td>
      <td>${displayProduto.processo_anvisa || ""}</td>
      <td>${displayProduto.ncm || ""}</td>
    </tr>
  </tbody>
</table>
<p class="footer">BiMaster — Composição de Grade</p>
</body></html>`;

      const printWindow = window.open("", "_blank");
      if (printWindow) {
        printWindow.document.write(html);
        printWindow.document.close();
        printWindow.focus();
        setTimeout(() => printWindow.print(), 400);
      }
      toast.success("Janela de impressão aberta!");
    } catch (error: any) {
      console.error("Erro ao gerar PDF:", error);
      toast.error("Erro ao gerar PDF: " + (error.message || "Erro desconhecido"));
    } finally {
      setExportandoPdf(false);
    }
  };

  return (
    <div className="flex gap-2">
      <Button
        variant="outline"
        size="sm"
        className="flex-1"
        onClick={exportarExcel}
        disabled={exportandoExcel}
      >
        {exportandoExcel ? (
          <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
        ) : (
          <FileSpreadsheet className="h-3.5 w-3.5 mr-1.5" />
        )}
        Excel
      </Button>
      <Button
        variant="outline"
        size="sm"
        className="flex-1"
        onClick={imprimirPdf}
        disabled={exportandoPdf}
      >
        {exportandoPdf ? (
          <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
        ) : (
          <Printer className="h-3.5 w-3.5 mr-1.5" />
        )}
        Imprimir PDF
      </Button>
    </div>
  );
}
