import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import type { VendasYoyRow, YoyDim } from "@/hooks/vendas/useVendasYoy";
import { formatCurrency } from "@/lib/formatters";
import { formatVarPct, variacaoTone } from "@/lib/vendas/format";

interface Props {
  open: boolean;
  onClose: () => void;
  row: VendasYoyRow | null;
  dim: YoyDim;
  ano: number;
}

function KPI({ label, value, tone }: { label: string; value: string; tone?: "positivo" | "negativo" | "neutro" }) {
  const cls =
    tone === "positivo" ? "text-rv-positivo"
    : tone === "negativo" ? "text-rv-negativo"
    : "text-rv-ink";
  return (
    <div className="border border-rv-linha p-4">
      <div className="text-[10px] uppercase tracking-wider text-rv-text-suave">{label}</div>
      <div className={`mt-2 font-display text-2xl tabular-nums ${cls}`}>{value}</div>
    </div>
  );
}

export function ClienteDetalheDialog({ open, onClose, row, dim, ano }: Props) {
  if (!row) return null;
  const tone = variacaoTone(row.variacao);
  const ticket = row.notas_atual > 0 ? row.fat_atual / row.notas_atual : 0;
  const dimLabel = dim === "cliente" ? "Cliente" : "Vendedor";

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl bg-rv-bg border-rv-linha p-0">
        <DialogHeader className="px-6 pt-6 pb-4 border-b border-rv-linha">
          <div className="text-[10px] uppercase tracking-wider text-rv-text-suave">{dimLabel}</div>
          <DialogTitle className="font-display text-2xl text-rv-ink">{row.nome}</DialogTitle>
        </DialogHeader>

        <div className="p-6 grid grid-cols-2 gap-4">
          <KPI label={`Faturamento ${ano}`} value={formatCurrency(row.fat_atual)} />
          <KPI
            label={`Faturamento ${ano - 1}`}
            value={row.fat_anterior > 0 ? formatCurrency(row.fat_anterior) : "—"}
          />
          <KPI
            label={`Variação vs ${ano - 1}`}
            value={row.novo ? "NOVO" : formatVarPct(row.variacao)}
            tone={tone}
          />
          <KPI label="Ticket médio" value={ticket > 0 ? formatCurrency(ticket) : "—"} />
          <div className="col-span-2">
            <KPI label="Nº de notas" value={row.notas_atual.toLocaleString("pt-BR")} />
          </div>
        </div>

        <div className="px-6 pb-6 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-[11px] uppercase tracking-wider border border-rv-ink text-rv-ink hover:bg-rv-ink hover:text-rv-bg transition-colors"
          >
            Fechar
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
