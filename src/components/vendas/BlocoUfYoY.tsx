import { useMemo } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { useVendasUfYoy, type UfYoyRow } from "@/hooks/vendas/useVendasUfYoy";
import { formatMi, formatVarPct } from "@/lib/vendas/format";
import { agruparPorRegiao, type GrupoRegiao } from "@/lib/vendas/regioes";

interface Props {
  ano: number;
  mes?: number | null;
  empresa: number | null;
  tabelaPrecoId?: number | null;
  clienteId?: number | null;
  vendedorId?: number | null;
}

/** Barra divergente centrada no zero: verde à direita, terracota à esquerda. */
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
        {formatVarPct(variacao)}
      </span>
    </div>
  );
}

function UfRow({ row }: { row: UfYoyRow }) {
  return (
    <div className="grid grid-cols-[48px_1fr_130px] items-center gap-4 py-2.5 border-b border-rv-linha/60">
      <div className="text-sm font-medium text-rv-ink tracking-wide">{row.uf}</div>
      <div className="text-sm text-rv-ink tabular-nums text-right pr-2">{formatMi(row.fat_atual)}</div>
      <DivergingBar variacao={row.variacao} novo={row.novo} />
    </div>
  );
}

function GrupoRegiaoBlock({ grupo, ano }: { grupo: GrupoRegiao; ano: number }) {
  return (
    <div className="break-inside-avoid mb-8">
      <div className="flex items-baseline justify-between gap-4 pb-2 border-b border-rv-linha">
        <div className="flex items-baseline gap-3">
          <h3 className="text-[13px] uppercase tracking-[0.14em] text-rv-ink font-medium">
            {grupo.regiao}
          </h3>
          <span className="text-[10px] uppercase tracking-wider text-rv-text-suave">
            {grupo.rows.length} {grupo.rows.length === 1 ? "UF" : "UFs"}
          </span>
        </div>
        <div className="flex items-baseline gap-3">
          <span className="text-sm text-rv-ink tabular-nums">{formatMi(grupo.total_atual)}</span>
          {grupo.variacao != null && (
            <span
              className="text-[11px] tabular-nums font-medium"
              style={{
                color:
                  grupo.variacao >= 0
                    ? "hsl(var(--rv-positivo))"
                    : "hsl(var(--rv-negativo))",
              }}
            >
              {formatVarPct(grupo.variacao)}
            </span>
          )}
        </div>
      </div>
      <div className="grid grid-cols-[48px_1fr_130px] gap-4 pt-3 pb-2 text-[10px] uppercase tracking-wider text-rv-text-suave">
        <div>UF</div>
        <div className="text-right pr-2">Faturamento</div>
        <div className="text-center">vs {ano - 1}</div>
      </div>
      {grupo.rows.map((r) => (
        <UfRow key={r.uf} row={r} />
      ))}
    </div>
  );
}

export function BlocoUfYoY({ ano, mes, empresa, tabelaPrecoId, clienteId, vendedorId }: Props) {
  const { data, isLoading } = useVendasUfYoy({ ano, mes: mes ?? null, empresa, tabelaPrecoId, clienteId, vendedorId });

  const grupos = useMemo(() => agruparPorRegiao(data ?? []), [data]);

  return (
    <section className="pt-14">
      <div className="mb-6">
        <h2 className="font-display text-xl text-rv-ink">Vendas por região e UF — faturamento &amp; YoY</h2>
        <p className="text-xs text-rv-text-suave mt-1">
          Faturamento acumulado por região e estado no mesmo período de {ano - 1} e {ano}. Barra divergente ± até 120%.
        </p>
      </div>

      {isLoading ? (
        <Skeleton className="h-[280px] w-full" />
      ) : grupos.length === 0 ? (
        <div className="h-[240px] flex items-center justify-center text-sm text-rv-text-suave border-t border-rv-linha">
          Sem vendas no período.
        </div>
      ) : (
        <div className="md:columns-2 md:gap-x-12 border-t border-rv-linha pt-4">
          {grupos.map((g) => (
            <GrupoRegiaoBlock key={g.regiao} grupo={g} ano={ano} />
          ))}
        </div>
      )}
    </section>
  );
}
