import { useState } from "react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { formatCurrency } from "@/lib/formatters";
import { useVendasRankingVendedor, useVendasRankingCoordenador, type VendasFilters } from "@/hooks/useVendasAnalise";

type Mode = "vendedor" | "coordenador";

function fmtMi(n: number) {
  if (n >= 1_000_000) return `R$ ${(n / 1_000_000).toFixed(1).replace(".", ",")} mi`;
  if (n >= 1_000) return `R$ ${(n / 1_000).toFixed(1).replace(".", ",")} mil`;
  return formatCurrency(n);
}

function ListRow({ name, value, ratio }: { name: string; value: number; ratio: number }) {
  return (
    <div className="flex items-center gap-3 py-2">
      <div className="w-36 shrink-0 text-sm text-foreground truncate" title={name}>{name}</div>
      <div className="flex-1 h-2.5 rounded-full bg-muted/60 overflow-hidden">
        <div
          className="h-full rounded-full transition-all"
          style={{ width: `${Math.max(2, ratio * 100)}%`, background: "hsl(var(--vendas-accent-soft))" }}
        />
      </div>
      <div className="w-24 text-right text-sm font-semibold tabular-nums text-foreground">{fmtMi(value)}</div>
    </div>
  );
}

function PillToggle({ mode, onChange }: { mode: Mode; onChange: (m: Mode) => void }) {
  return (
    <div className="inline-flex items-center rounded-full bg-muted p-0.5 text-xs">
      {(["vendedor", "coordenador"] as Mode[]).map((m) => {
        const active = mode === m;
        return (
          <button
            key={m}
            onClick={() => onChange(m)}
            className={`px-3 py-1.5 rounded-full font-medium transition ${active ? "text-white shadow-sm" : "text-muted-foreground hover:text-foreground"}`}
            style={active ? { background: "hsl(var(--vendas-accent))" } : undefined}
          >
            {m === "vendedor" ? "Vendedor" : "Coordenador"}
          </button>
        );
      })}
    </div>
  );
}

export function RankingTabs({ filters }: { filters: VendasFilters }) {
  const [mode, setMode] = useState<Mode>("vendedor");
  const vend = useVendasRankingVendedor(filters);
  const coord = useVendasRankingCoordenador(filters);

  const isLoading = mode === "vendedor" ? vend.isLoading : coord.isLoading;
  const items =
    mode === "vendedor"
      ? (vend.data || []).slice(0, 10).map((r) => ({ id: r.vendedor_id || r.vendedor_nome, name: r.vendedor_nome, value: r.faturamento }))
      : (coord.data || []).slice(0, 10).map((r) => ({ id: r.coordenador_id || r.coordenador_nome, name: r.coordenador_nome, value: r.faturamento }));

  const max = items.reduce((m, r) => Math.max(m, r.value), 0) || 1;

  return (
    <Card className="rounded-2xl">
      <CardHeader className="pb-2 flex flex-row items-center justify-between">
        <div className="text-base font-semibold text-foreground">
          Ranking de {mode === "vendedor" ? "vendedores" : "coordenadores"}
        </div>
        <PillToggle mode={mode} onChange={setMode} />
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <Skeleton className="h-[320px] w-full" />
        ) : items.length === 0 ? (
          <div className="text-sm text-muted-foreground py-8 text-center">Sem vendas no período</div>
        ) : (
          <div className="divide-y divide-border/60">
            {items.map((r) => (
              <ListRow key={r.id} name={r.name} value={r.value} ratio={r.value / max} />
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
