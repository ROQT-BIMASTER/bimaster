import { Button } from "@/components/ui/button";
import { Download, Mail, Phone, X } from "lucide-react";
import type { ClienteReativacao } from "@/hooks/useClienteReativacao";
import { toast } from "sonner";
import ExcelJS from "exceljs";
import { saveAs } from "file-saver";
import { format } from "date-fns";

interface Props {
  selecionados: ClienteReativacao[];
  onClearSelection: () => void;
}

const riskColors: Record<string, string> = {
  atencao: "FFF59E0B",
  alerta: "FFF97316",
  critico: "FFEF4444",
  inativo: "FF6B7280",
};

export function BulkActionsBar({ selecionados, onClearSelection }: Props) {
  if (selecionados.length === 0) return null;

  const formatCurrency = (v: number) =>
    new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);

  const totalValor = selecionados.reduce((s, c) => s + (c.valor_ultima_compra || 0), 0);

  const copiarEmails = () => {
    const emails = selecionados.map((c) => c.email).filter(Boolean);
    if (emails.length === 0) {
      toast.warning("Nenhum cliente selecionado possui email cadastrado");
      return;
    }
    navigator.clipboard.writeText(emails.join("; "));
    toast.success(`${emails.length} emails copiados!`);
  };

  const copiarTelefones = () => {
    const phones = selecionados.map((c) => c.celular || c.telefone).filter(Boolean);
    if (phones.length === 0) {
      toast.warning("Nenhum cliente selecionado possui telefone cadastrado");
      return;
    }
    navigator.clipboard.writeText(phones.join("; "));
    toast.success(`${phones.length} telefones copiados!`);
  };

  const exportarExcel = async () => {
    try {
      const wb = new ExcelJS.Workbook();
      const ws = wb.addWorksheet("Reativação");

      const columns = [
        { header: "Nome", key: "nome", width: 35 },
        { header: "Código", key: "codigo", width: 12 },
        { header: "CNPJ", key: "cnpj", width: 20 },
        { header: "Telefone", key: "telefone", width: 16 },
        { header: "Celular", key: "celular", width: 16 },
        { header: "Email", key: "email", width: 30 },
        { header: "Comprador", key: "comprador", width: 25 },
        { header: "Cidade", key: "cidade", width: 20 },
        { header: "UF", key: "uf", width: 6 },
        { header: "Dias s/ Compra", key: "dias_sem_compra", width: 15 },
        { header: "Última Compra", key: "data_ultima_compra", width: 14 },
        { header: "Valor Última", key: "valor_ultima_compra", width: 16 },
        { header: "Valor Maior", key: "valor_maior_compra", width: 16 },
        { header: "Limite Crédito", key: "limite_credito", width: 16 },
        { header: "Nível Risco", key: "nivel_risco", width: 12 },
        { header: "Status", key: "status_bloqueio", width: 12 },
      ];

      ws.columns = columns;

      // Header styling
      const headerRow = ws.getRow(1);
      headerRow.font = { bold: true, color: { argb: "FFFFFFFF" } };
      headerRow.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1F2937" } };
      headerRow.alignment = { vertical: "middle", horizontal: "center" };
      headerRow.height = 24;

      for (const c of selecionados) {
        const row = ws.addRow({
          nome: c.nome,
          codigo: c.codigo,
          cnpj: c.cnpj || "",
          telefone: c.telefone || "",
          celular: c.celular || "",
          email: c.email || "",
          comprador: c.comprador || "",
          cidade: c.cidade || "",
          uf: c.uf || "",
          dias_sem_compra: c.dias_sem_compra,
          data_ultima_compra: c.data_ultima_compra ? format(new Date(c.data_ultima_compra), "dd/MM/yyyy") : "",
          valor_ultima_compra: c.valor_ultima_compra || 0,
          valor_maior_compra: c.valor_maior_compra || 0,
          limite_credito: c.limite_credito || 0,
          nivel_risco: c.nivel_risco,
          status_bloqueio: c.status_bloqueio || "Ativo",
        });

        // Color-code risk level
        const riskCell = row.getCell("nivel_risco");
        const color = riskColors[c.nivel_risco];
        if (color) {
          riskCell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: color } };
          riskCell.font = { color: { argb: "FFFFFFFF" }, bold: true };
        }
      }

      // Currency format
      ["valor_ultima_compra", "valor_maior_compra", "limite_credito"].forEach((key) => {
        ws.getColumn(key).numFmt = '#,##0.00';
      });

      const buf = await wb.xlsx.writeBuffer();
      const dateStr = format(new Date(), "yyyy-MM-dd");
      saveAs(new Blob([buf]), `reativacao_clientes_${dateStr}.xlsx`);
      toast.success(`${selecionados.length} clientes exportados!`);
    } catch (err) {
      console.error("Export error:", err);
      toast.error("Erro ao exportar planilha");
    }
  };

  return (
    <div className="sticky bottom-4 z-40 mx-auto max-w-3xl">
      <div className="flex items-center justify-between gap-3 rounded-xl border bg-background/95 backdrop-blur-sm shadow-lg px-4 py-3">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onClearSelection}>
            <X className="h-4 w-4" />
          </Button>
          <div className="text-sm">
            <span className="font-bold">{selecionados.length}</span>
            <span className="text-muted-foreground"> selecionados</span>
            <span className="mx-1.5 text-muted-foreground">•</span>
            <span className="font-semibold">{formatCurrency(totalValor)}</span>
          </div>
        </div>
        <div className="flex items-center gap-1.5">
          <Button variant="outline" size="sm" className="gap-1.5 text-xs" onClick={copiarEmails}>
            <Mail className="h-3.5 w-3.5" />Emails
          </Button>
          <Button variant="outline" size="sm" className="gap-1.5 text-xs" onClick={copiarTelefones}>
            <Phone className="h-3.5 w-3.5" />Fones
          </Button>
          <Button size="sm" className="gap-1.5 text-xs" onClick={exportarExcel}>
            <Download className="h-3.5 w-3.5" />Excel
          </Button>
        </div>
      </div>
    </div>
  );
}
