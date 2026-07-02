import { useMemo, useRef, useState } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import { ArrowUpDown, Maximize2 } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { useVendasYoy, type YoyDim, type VendasYoyRow } from "@/hooks/vendas/useVendasYoy";
import { formatMi, formatVarPct, variacaoTone } from "@/lib/vendas/format";
import { RankingYoyFocoDialog } from "./RankingYoyFocoDialog";

type SortKey = "faturamento" | "crescimento";
type SortDir = "asc" | "desc";

interface Props {
  ano: number;
  empresa: number | null;
}

/** barra divergente centrada no 0, escala ±120% */
function DivergingBar({ variacao, novo }: { variacao: number | null; novo: boolean }) {
  if (novo) {
    return (
      <div className="w-full flex justify-center">
        <span className="text-[10px] uppercase tracking-wider text-rv-positivo border border-rv-positivo/40 px-2 py-0.5">
          novo
        </span>
      </div>
    );
  }
  if (variacao == null) {
    return <div className="w-full text-center text-xs text-rv-text-suave">—</div>;
  }
  const clamp = Math.max(-1.2, Math.min(1.2, variacao));
  const pct = (Math.abs(clamp) / 1.2) * 50; // até 50% de cada lado
  const positivo = clamp >= 0;
  const color = positivo ? "hsl(var(--rv-positivo))" : "hsl(var(--rv-negativo))";
  const label = formatVarPct(variacao);
  return (
    <div className="relative w-full h-4">
      <div className="absolute inset-y-0 left-1/2 w-px bg-rv-linha" />
      <div
        className="absolute inset-y-0.5"
        style={{
          background: color,
          left: positivo ? "50%" : `${50 - pct}%`,
          width: `${pct}%`,
        }}
      />
      <span
        className="absolute top-1/2 -translate-y-1/2 text-[11px] tabular-nums font-medium whitespace-nowrap"
        style={{
          color,
          left: positivo ? `calc(50% + ${pct}% + 6px)` : undefined,
          right: positivo ? undefined : `calc(50% + ${pct}% + 6px)`,
        }}
      >
        {label}
      </span>
    </div>
  );
}

export function BlocoRankingYoy({ ano, empresa }: Props) {
  const [dim, setDim] = useState<YoyDim>("cliente");
  const [sort, setSort] = useState<{ key: SortKey; dir: SortDir }>({ key: "faturamento", dir: "desc" });
  const [foco, setFoco] = useState(false);
  const { data, isLoading } = useVendasYoy({ dim, ano, empresa });

  const rows = useMemo(() => {
    const arr = [...(data ?? [])];
    arr.sort((a, b) => {
      const av = sort.key === "faturamento" ? a.fat_atual : (a.variacao ?? -Infinity);
      const bv = sort.key === "faturamento" ? b.fat_atual : (b.variacao ?? -Infinity);
      return sort.dir === "desc" ? bv - av : av - bv;
    });
    return arr;
  }, [data, sort]);

  const scrollRef = useRef<HTMLDivElement>(null);
  const virt = useVirtualizer({
    count: rows.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => 44,
    overscan: 8,
  });

  const toggleSort = (key: SortKey) => {
    setSort((s) => (s.key === key ? { key, dir: s.dir === "desc" ? "asc" : "desc" } : { key, dir: "desc" }));
  };

  const dims: { v: YoyDim | "produto"; label: string; disabled?: boolean }[] = [
    { v: "cliente", label: "Cliente" },
    { v: "vendedor", label: "Vendedor" },
    { v: "produto", label: "Produto (em breve)", disabled: true },
  ];

  return (
    <section className="pt-14">
      <div className="flex items-baseline justify-between mb-6 gap-4 flex-wrap">
        <div>
          <h2 className="font-display text-xl text-rv-ink">Ranking & crescimento vs {ano - 1}</h2>
          <p className="text-xs text-rv-text-suave mt-1">
            Barra divergente ± até 120%. Ordene por faturamento ou crescimento.
          </p>
        </div>
        <div className="flex items-stretch gap-3">
          <div className="flex items-stretch border border-rv-linha">
            {dims.map((d) => (
              <button
                key={d.v}
                type="button"
                disabled={d.disabled}
                onClick={() => !d.disabled && setDim(d.v as YoyDim)}
                className={`px-4 py-1.5 text-[11px] uppercase tracking-wider transition-colors ${
                  d.v === dim && !d.disabled
                    ? "bg-rv-ink text-rv-bg"
                    : d.disabled
                      ? "text-rv-muted cursor-not-allowed"
                      : "text-rv-text-suave hover:text-rv-ink"
                }`}
              >
                {d.label}
              </button>
            ))}
          </div>
          <button
            type="button"
            onClick={() => setFoco(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 text-[11px] uppercase tracking-wider border border-rv-linha text-rv-ink hover:bg-rv-faixa-verde/60 transition-colors"
          >
            <Maximize2 className="w-3 h-3" /> Focar
          </button>
        </div>
      </div>

      <div className="border-t border-rv-linha">
        <div className="grid grid-cols-[36px_1fr_120px_1fr_80px] gap-4 py-3 px-1 text-[10px] uppercase tracking-wider text-rv-text-suave border-b border-rv-linha">
          <div>#</div>
          <div>Nome</div>
          <button
            type="button"
            onClick={() => toggleSort("faturamento")}
            className="flex items-center justify-end gap-1 hover:text-rv-ink transition-colors"
          >
            Faturamento <ArrowUpDown className="w-3 h-3" />
          </button>
          <button
            type="button"
            onClick={() => toggleSort("crescimento")}
            className="flex items-center justify-center gap-1 hover:text-rv-ink transition-colors"
          >
            Crescimento vs {ano - 1} <ArrowUpDown className="w-3 h-3" />
          </button>
          <div className="text-right">Notas</div>
        </div>

        {isLoading ? (
          <div className="py-6 space-y-2">
            {Array.from({ length: 8 }).map((_, i) => (
              <Skeleton key={i} className="h-8 w-full" />
            ))}
          </div>
        ) : rows.length === 0 ? (
          <div className="py-12 text-center text-sm text-rv-text-suave">Sem dados no período.</div>
        ) : (
          <>
            <div ref={scrollRef} className="max-h-[560px] overflow-y-auto">
              <div style={{ height: virt.getTotalSize(), position: "relative" }}>
                {virt.getVirtualItems().map((vi) => {
                  const r: VendasYoyRow = rows[vi.index];
                  const tone = variacaoTone(r.variacao);
                  const varCls =
                    tone === "positivo" ? "text-rv-positivo"
                    : tone === "negativo" ? "text-rv-negativo"
                    : "text-rv-text-suave";
                  return (
                    <div
                      key={`${r.chave ?? "na"}-${vi.index}`}
                      style={{
                        position: "absolute", top: 0, left: 0, right: 0,
                        transform: `translateY(${vi.start}px)`, height: vi.size,
                      }}
                      className="grid grid-cols-[36px_1fr_120px_1fr_80px] gap-4 items-center px-1 border-b border-rv-linha/60 hover:bg-rv-faixa-verde/40 transition-colors"
                    >
                      <div className="text-xs text-rv-muted tabular-nums">{vi.index + 1}</div>
                      <div className="text-sm text-rv-ink truncate" title={r.nome}>{r.nome}</div>
                      <div className="text-right text-sm text-rv-ink tabular-nums">{formatMi(r.fat_atual)}</div>
                      <div className={`${varCls}`}>
                        <DivergingBar variacao={r.variacao} novo={r.novo} />
                      </div>
                      <div className="text-right text-sm text-rv-muted tabular-nums">
                        {r.notas_atual.toLocaleString("pt-BR")}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
            <div className="py-2 px-1 text-[11px] text-rv-text-suave border-t border-rv-linha">
              mostrando {rows.length} de {rows.length}
            </div>
          </>
        )}
      </div>

      <RankingYoyFocoDialog
        open={foco}
        onClose={() => setFoco(false)}
        rows={rows}
        dim={dim}
        ano={ano}
      />
    </section>
  );
}
