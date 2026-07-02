import { useMemo, useRef, useState } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import type { VendasYoyRow, YoyDim } from "@/hooks/vendas/useVendasYoy";
import { formatMi, formatVarPct, variacaoTone } from "@/lib/vendas/format";
import { formatCurrency } from "@/lib/formatters";

interface Props {
  open: boolean;
  onClose: () => void;
  rows: VendasYoyRow[];
  dim: YoyDim;
  ano: number;
}

export function RankingYoyFocoDialog({ open, onClose, rows, dim, ano }: Props) {
  const [q, setQ] = useState("");
  const filtered = useMemo(() => {
    const t = q.trim().toLowerCase();
    if (!t) return rows;
    return rows.filter((r) => r.nome.toLowerCase().includes(t));
  }, [rows, q]);

  const scrollRef = useRef<HTMLDivElement>(null);
  const virt = useVirtualizer({
    count: filtered.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => 40,
    overscan: 10,
  });

  const dimLabel = dim === "cliente" ? "Cliente" : "Vendedor";

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-[95vw] h-[90vh] flex flex-col bg-rv-bg border-rv-linha p-0">
        <DialogHeader className="px-6 pt-6 pb-4 border-b border-rv-linha">
          <DialogTitle className="font-display text-2xl text-rv-ink">
            Ranking · {dimLabel} · {ano} vs {ano - 1}
          </DialogTitle>
          <div className="pt-3 flex items-center gap-4 flex-wrap">
            <Input
              placeholder="Buscar por nome…"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              className="max-w-sm border-rv-linha bg-transparent rounded-none focus-visible:ring-0 focus-visible:border-rv-ink"
            />
            <div className="text-xs text-rv-text-suave">
              {filtered.length} de {rows.length} linhas
            </div>
          </div>
        </DialogHeader>

        <div className="flex-1 flex flex-col overflow-hidden px-6 pb-6">
          <div className="grid grid-cols-[48px_1fr_120px_120px_100px_80px_120px] gap-4 py-3 text-[10px] uppercase tracking-wider text-rv-text-suave border-b border-rv-linha">
            <div>#</div>
            <div>Nome</div>
            <div className="text-right">Fat. {ano}</div>
            <div className="text-right">Fat. {ano - 1}</div>
            <div className="text-right">Variação</div>
            <div className="text-right">Notas</div>
            <div className="text-right">Ticket</div>
          </div>
          <div ref={scrollRef} className="flex-1 overflow-y-auto">
            <div style={{ height: virt.getTotalSize(), position: "relative" }}>
              {virt.getVirtualItems().map((vi) => {
                const r = filtered[vi.index];
                const tone = variacaoTone(r.variacao);
                const varCls =
                  tone === "positivo" ? "text-rv-positivo"
                  : tone === "negativo" ? "text-rv-negativo"
                  : "text-rv-text-suave";
                const ticket = r.notas_atual > 0 ? r.fat_atual / r.notas_atual : 0;
                return (
                  <button
                    key={`${r.chave ?? "na"}-${vi.index}`}
                    type="button"
                    onClick={() => toast.info("Detalhe do cliente em breve.")}
                    style={{
                      position: "absolute", top: 0, left: 0, right: 0,
                      transform: `translateY(${vi.start}px)`, height: vi.size,
                    }}
                    className="grid grid-cols-[48px_1fr_120px_120px_100px_80px_120px] gap-4 items-center text-left border-b border-rv-linha/60 hover:bg-rv-faixa-verde/50 transition-colors"
                  >
                    <div className="text-xs text-rv-muted tabular-nums">{vi.index + 1}</div>
                    <div className="text-sm text-rv-ink truncate" title={r.nome}>{r.nome}</div>
                    <div className="text-right text-sm text-rv-ink tabular-nums">{formatMi(r.fat_atual)}</div>
                    <div className="text-right text-sm text-rv-text-suave tabular-nums">
                      {r.fat_anterior > 0 ? formatMi(r.fat_anterior) : "—"}
                    </div>
                    <div className={`text-right text-sm tabular-nums font-medium ${varCls}`}>
                      {r.novo ? "NOVO" : formatVarPct(r.variacao)}
                    </div>
                    <div className="text-right text-sm text-rv-muted tabular-nums">
                      {r.notas_atual.toLocaleString("pt-BR")}
                    </div>
                    <div className="text-right text-sm text-rv-text-suave tabular-nums">
                      {ticket > 0 ? formatCurrency(ticket) : "—"}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
