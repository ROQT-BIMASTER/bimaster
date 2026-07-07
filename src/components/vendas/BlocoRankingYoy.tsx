import { useEffect, useMemo, useRef, useState } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import { ArrowDown, ArrowUp, ArrowUpDown, Maximize2 } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { useVendasYoy, type YoyDim, type VendasYoyRow } from "@/hooks/vendas/useVendasYoy";
import { formatMi, formatVarPct, variacaoTone } from "@/lib/vendas/format";
import { RankingYoyFocoDialog } from "./RankingYoyFocoDialog";
import { ClienteDetalheDialog } from "./ClienteDetalheDialog";
import { usePosicaoFinanceiraClientesBulk } from "@/hooks/financeiro/usePosicaoFinanceiraCliente";
import { computeSemaforo } from "@/lib/financeiro/semaforoCliente";
import { formatCurrency } from "@/lib/formatters";
import { cn } from "@/lib/utils";

export type SortKey = "faturamento" | "crescimento";
export type SortDir = "asc" | "desc";
export type SortState = { key: SortKey; dir: SortDir };

interface Props {
  ano: number;
  empresa: number | null;
  tabelaPrecoId?: number | null;
  uf?: string | null;
  clienteId?: number | null;
  vendedorId?: number | null;
  source?: "futura" | "rubysp";
}

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
  const pct = (Math.abs(clamp) / 1.2) * 50;
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

export function sortYoyRows(rows: VendasYoyRow[], sort: SortState): VendasYoyRow[] {
  const arr = [...rows];
  arr.sort((a, b) => {
    if (sort.key === "faturamento") {
      return sort.dir === "desc" ? b.fat_atual - a.fat_atual : a.fat_atual - b.fat_atual;
    }
    // crescimento: sempre empurrar null/novo para o final
    const aNull = a.variacao == null;
    const bNull = b.variacao == null;
    if (aNull && bNull) return 0;
    if (aNull) return 1;
    if (bNull) return -1;
    return sort.dir === "desc"
      ? (b.variacao as number) - (a.variacao as number)
      : (a.variacao as number) - (b.variacao as number);
  });
  return arr;
}

function SortIcon({ active, dir }: { active: boolean; dir: SortDir }) {
  if (!active) return <ArrowUpDown className="w-3 h-3" />;
  return dir === "desc" ? <ArrowDown className="w-3 h-3" /> : <ArrowUp className="w-3 h-3" />;
}

export function BlocoRankingYoy({ ano, empresa, tabelaPrecoId, uf, clienteId, vendedorId, source = "futura" }: Props) {
  const [dim, setDim] = useState<YoyDim>("cliente");
  const [sort, setSort] = useState<SortState>({ key: "faturamento", dir: "desc" });
  const [foco, setFoco] = useState(false);
  const [query, setQuery] = useState("");
  const [selecionada, setSelecionada] = useState<VendasYoyRow | null>(null);
  const { data, isLoading } = useVendasYoy({ dim, ano, empresa, tabelaPrecoId, uf, clienteId, vendedorId, source });

  // reset sort ao trocar dimensão
  useEffect(() => {
    setSort({ key: "faturamento", dir: "desc" });
    setQuery("");
  }, [dim]);

  const rows = useMemo(() => sortYoyRows(data ?? [], sort), [data, sort]);

  // Semáforo financeiro (só faz sentido para clientes)
  const clienteIds = useMemo(
    () => (dim === "cliente" ? rows.map((r) => r.chave).filter((x): x is number => x != null) : []),
    [dim, rows],
  );
  const { data: finMap } = usePosicaoFinanceiraClientesBulk(clienteIds);
  const showSituacao = dim === "cliente";
  const gridCols = showSituacao
    ? "grid-cols-[36px_1fr_140px_1fr_130px_80px]"
    : "grid-cols-[36px_1fr_140px_1fr_100px]";

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

  const sortLabel = sort.key === "faturamento" ? "Faturamento" : "Crescimento";
  const total = data?.length ?? 0;

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
        <div className={cn("grid gap-4 py-3 pl-1 pr-4 text-[10px] uppercase tracking-wider text-rv-text-suave border-b border-rv-linha", gridCols)}>
          <div>#</div>
          <div>Nome</div>
          <button
            type="button"
            onClick={() => toggleSort("faturamento")}
            className={`flex items-center justify-end gap-1 transition-colors ${
              sort.key === "faturamento" ? "text-rv-ink font-medium" : "hover:text-rv-ink"
            }`}
          >
            Faturamento <SortIcon active={sort.key === "faturamento"} dir={sort.dir} />
          </button>
          <button
            type="button"
            onClick={() => toggleSort("crescimento")}
            className={`flex items-center justify-center gap-1 transition-colors ${
              sort.key === "crescimento" ? "text-rv-ink font-medium" : "hover:text-rv-ink"
            }`}
          >
            Crescimento vs {ano - 1} <SortIcon active={sort.key === "crescimento"} dir={sort.dir} />
          </button>
          {showSituacao && <div className="text-right">Situação</div>}
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
            <div ref={scrollRef} className="max-h-[70vh] overflow-y-auto">
              <div style={{ height: virt.getTotalSize(), position: "relative" }}>
                {virt.getVirtualItems().map((vi) => {
                  const r: VendasYoyRow = rows[vi.index];
                  const tone = variacaoTone(r.variacao);
                  const varCls =
                    tone === "positivo" ? "text-rv-positivo"
                    : tone === "negativo" ? "text-rv-negativo"
                    : "text-rv-text-suave";
                  const quedaForte = r.variacao != null && r.variacao <= -0.2;
                  const altaForte = r.variacao != null && r.variacao >= 0.2;
                  const borderCls = quedaForte
                    ? "border-l-2 border-l-rv-negativo"
                    : altaForte
                      ? "border-l-2 border-l-rv-positivo"
                      : "border-l-2 border-l-transparent";
                  const nomeCls = quedaForte ? "text-rv-negativo" : "text-rv-ink";
                  const fatCls = quedaForte ? "text-rv-negativo" : "text-rv-ink";
                  const fin = showSituacao && r.chave != null ? finMap?.get(r.chave) : undefined;
                  const sem = showSituacao
                    ? computeSemaforo({
                        vencido: fin?.vencido ?? 0,
                        maior_atraso_dias: fin?.maior_atraso_dias ?? 0,
                      })
                    : null;
                  return (
                    <button
                      key={`${r.chave ?? "na"}-${vi.index}`}
                      type="button"
                      onClick={() => setSelecionada(r)}
                      style={{
                        position: "absolute", top: 0, left: 0, right: 0,
                        transform: `translateY(${vi.start}px)`, height: vi.size,
                      }}
                      className={cn(
                        "grid gap-4 items-center pl-1 pr-4 border-b border-rv-linha/60 hover:bg-rv-faixa-verde/40 transition-colors text-left",
                        gridCols,
                        borderCls,
                      )}
                    >
                      <div className="text-xs text-rv-muted tabular-nums">{vi.index + 1}</div>
                      <div className={`text-sm truncate ${nomeCls}`} title={r.nome}>{r.nome}</div>
                      <div className={`text-right text-sm tabular-nums ${fatCls}`}>{formatMi(r.fat_atual)}</div>
                      <div className={`${varCls}`}>
                        <DivergingBar variacao={r.variacao} novo={r.novo} />
                      </div>
                      {showSituacao && sem && (
                        <div className="flex items-center justify-end gap-1.5 min-w-0" title={sem.label}>
                          <span className={cn("h-2 w-2 rounded-full shrink-0", sem.dotClass)} aria-hidden />
                          <span className={cn("text-xs tabular-nums truncate", sem.textClass)}>
                            {sem.tone === "verde"
                              ? "em dia"
                              : formatCurrency(fin?.vencido ?? 0)}
                          </span>
                        </div>
                      )}
                      <div className="text-right text-sm text-rv-muted tabular-nums">
                        {r.notas_atual.toLocaleString("pt-BR")}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
            <div className="py-2 px-1 text-[11px] text-rv-text-suave border-t border-rv-linha flex items-center justify-between">
              <span>mostrando {rows.length} de {total} {dim === "cliente" ? "clientes" : "vendedores"}</span>
              <span>ordenado por {sortLabel} ({sort.dir === "desc" ? "maior → menor" : "menor → maior"})</span>
            </div>
          </>
        )}
      </div>

      <RankingYoyFocoDialog
        open={foco}
        onClose={() => setFoco(false)}
        rows={rows}
        total={total}
        dim={dim}
        ano={ano}
        query={query}
        onQueryChange={setQuery}
        sort={sort}
        onSortChange={setSort}
        onRowClick={(r) => setSelecionada(r)}
      />

      <ClienteDetalheDialog
        open={!!selecionada}
        onClose={() => setSelecionada(null)}
        row={selecionada}
        dim={dim}
        ano={ano}
      />
    </section>
  );
}
