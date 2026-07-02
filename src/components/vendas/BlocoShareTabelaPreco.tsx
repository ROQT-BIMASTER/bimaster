import { Skeleton } from "@/components/ui/skeleton";
import { useVendasShareTabela } from "@/hooks/vendas/useVendasShareTabela";
import { formatMi } from "@/lib/vendas/format";

const COLORS = [
  "hsl(var(--rv-sage))",
  "hsl(var(--rv-steel))",
  "hsl(var(--rv-tan))",
  "hsl(var(--rv-ink))",
  "hsl(var(--rv-khaki))",
  "hsl(var(--rv-steel2))",
];

interface Props {
  de: string;
  ate: string;
  empresa: number | null;
  ano: number;
}

export function BlocoShareTabelaPreco({ de, ate, empresa, ano }: Props) {
  const { data, isLoading } = useVendasShareTabela({ de, ate, empresa });
  const rows = data ?? [];
  const max = rows.reduce((m, r) => Math.max(m, r.share_pct), 0);

  return (
    <section className="pt-14">
      <div className="mb-6">
        <h2 className="font-display text-xl text-rv-ink">Vendas por tabela de preço</h2>
        <p className="text-xs text-rv-text-suave mt-1">Share do faturamento no ano {ano}.</p>
      </div>

      {isLoading ? (
        <Skeleton className="h-[280px] w-full" />
      ) : rows.length === 0 ? (
        <div className="h-[240px] flex items-center justify-center text-sm text-rv-text-suave border-t border-rv-linha">
          Sem vendas no período.
        </div>
      ) : (
        <div className="border-t border-rv-linha pt-6 space-y-5">
          {rows.map((r, i) => {
            const color = COLORS[i % COLORS.length];
            const width = max > 0 ? Math.max((r.share_pct / max) * 100, 2) : 0;
            return (
              <div key={`${r.tabela_preco_id ?? "n"}-${r.tabela_preco_nome}`} className="space-y-1.5">
                <div className="flex items-baseline justify-between text-sm text-rv-ink">
                  <span className="truncate pr-3">{r.tabela_preco_nome}</span>
                  <span className="tabular-nums font-medium">
                    {r.share_pct.toFixed(1).replace(".", ",")}%
                  </span>
                </div>
                <div className="h-2.5 bg-rv-linha/60">
                  <div className="h-full" style={{ width: `${width}%`, background: color }} />
                </div>
                <div className="text-[11px] text-rv-text-suave tabular-nums">
                  {formatMi(r.faturamento)} · {r.notas.toLocaleString("pt-BR")} notas
                </div>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
