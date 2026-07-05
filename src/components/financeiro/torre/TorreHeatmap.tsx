// Heatmap departamento × mês da Torre de Despesas.
// CSS grid puro (sem recharts): intensidade da célula por z-score, clique
// seleciona (departamento, mês) e alimenta a série + o drill.
import { useMemo } from "react";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { formatCurrency } from "@/lib/formatters";
import type { TorreDepartamentosPayload, TorreSelecao } from "@/types/financeiro/torre-despesas";

interface Props {
  payload: TorreDepartamentosPayload | undefined;
  isLoading: boolean;
  selecao: TorreSelecao | null;
  onSelect: (selecao: TorreSelecao) => void;
}

const SEM_DEPTO_NOME = "(sem classificação)";

const fmtPct = (v: number | null) =>
  v === null
    ? "—"
    : `${v > 0 ? "+" : ""}${v.toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%`;

const fmtZ = (v: number | null) =>
  v === null ? "—" : v.toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 });

/** Intensidade da célula por z-score (tokens do design system, dark ok) */
function zCellClass(z: number | null): string {
  if (z === null) return "bg-muted/20";
  if (z >= 3) return "bg-destructive/70 text-destructive-foreground";
  if (z >= 2) return "bg-destructive/40";
  if (z >= 1) return "bg-amber-500/20";
  if (z <= -2) return "bg-success/20";
  return "bg-muted/20";
}

/** Variação percentual simples com base nula protegida */
function pctChange(atual: number, base: number | undefined): number | null {
  if (base === undefined || base === 0) return null;
  return ((atual - base) / Math.abs(base)) * 100;
}

export function TorreHeatmap({ payload, isLoading, selecao, onSelect }: Props) {
  const linhas = useMemo(() => {
    if (!payload) return [];
    return [...payload.departamentos].sort((a, b) => b.total_mes_ref - a.total_mes_ref);
  }, [payload]);

  const meses = useMemo(() => {
    if (!payload) return [];
    // Séries são zero-filled com p_meses meses até mes_ref — a série dos totais dá o eixo
    return payload.totais.serie.map((p) => p.mes);
  }, [payload]);

  if (isLoading || !payload) {
    return <div className="h-64 rounded-2xl border border-border bg-card animate-pulse" />;
  }

  if (linhas.length === 0) {
    return (
      <div className="rounded-2xl border border-border bg-card p-8 text-center text-sm text-muted-foreground">
        Sem despesas no período com os filtros atuais.
      </div>
    );
  }

  const gridTemplate = `minmax(170px, 220px) repeat(${meses.length}, minmax(52px, 1fr))`;

  return (
    <div className="bg-card rounded-2xl border border-border shadow-sm p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-foreground">Mapa de calor — departamento × mês</h3>
        <div className="hidden md:flex items-center gap-3 text-[10px] text-muted-foreground">
          <span className="flex items-center gap-1">
            <span className="h-2.5 w-2.5 rounded-sm bg-destructive/70" /> z ≥ 3
          </span>
          <span className="flex items-center gap-1">
            <span className="h-2.5 w-2.5 rounded-sm bg-destructive/40" /> 2–3
          </span>
          <span className="flex items-center gap-1">
            <span className="h-2.5 w-2.5 rounded-sm bg-amber-500/20" /> 1–2
          </span>
          <span className="flex items-center gap-1">
            <span className="h-2.5 w-2.5 rounded-sm bg-success/20" /> z ≤ −2
          </span>
        </div>
      </div>

      <div className="overflow-x-auto">
        <div className="min-w-max">
          {/* Cabeçalho de meses */}
          <div className="grid" style={{ gridTemplateColumns: gridTemplate }}>
            <div className="sticky left-0 z-10 bg-card px-2 py-1.5 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
              Departamento
            </div>
            {meses.map((mes) => (
              <div
                key={mes}
                className="px-1 py-1.5 text-center text-[10px] font-medium text-muted-foreground tabular-nums"
              >
                {format(parseISO(mes), "MMM/yy", { locale: ptBR })}
              </div>
            ))}
          </div>

          {/* Linhas de departamentos */}
          {linhas.map((dept) => {
            const semDepto = dept.departamento_id === null;
            const valores = new Map(dept.serie.map((p) => [p.mes, p.valor]));
            return (
              <div
                key={dept.departamento_id ?? "sem-depto"}
                className="grid border-t border-border/40"
                style={{ gridTemplateColumns: gridTemplate }}
              >
                <div
                  className={cn(
                    "sticky left-0 z-10 bg-card px-2 py-1 flex items-center gap-1.5 min-w-0",
                    semDepto && "italic text-muted-foreground",
                  )}
                  title={`${dept.departamento_nome} — total ${formatCurrency(dept.total_mes_ref)} (${dept.share_pct.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}% do mês)`}
                >
                  <span className="text-xs font-medium truncate">{dept.departamento_nome}</span>
                  <span className="ml-auto text-[10px] text-muted-foreground tabular-nums shrink-0">
                    {dept.share_pct.toLocaleString("pt-BR", { maximumFractionDigits: 0 })}%
                  </span>
                </div>

                {meses.map((mes, idx) => {
                  const valor = valores.get(mes) ?? 0;
                  // z do mês de referência vem do servidor; demais meses usam média/desvio 12m do payload
                  const z =
                    mes === payload.meta.mes_ref
                      ? dept.z_mes_ref
                      : dept.desvio_12m > 0
                        ? (valor - dept.media_12m) / dept.desvio_12m
                        : null;
                  const mom = pctChange(valor, idx > 0 ? (valores.get(meses[idx - 1]) ?? 0) : undefined);
                  const yoy = pctChange(valor, idx >= 12 ? (valores.get(meses[idx - 12]) ?? 0) : undefined);
                  const selecionada =
                    !!selecao &&
                    selecao.mes === mes &&
                    selecao.departamentoId === dept.departamento_id &&
                    selecao.semDepto === semDepto;
                  return (
                    <button
                      key={mes}
                      type="button"
                      onClick={() =>
                        onSelect({
                          departamentoId: dept.departamento_id,
                          semDepto,
                          departamentoNome: dept.departamento_nome,
                          mes,
                        })
                      }
                      title={`${dept.departamento_nome} · ${format(parseISO(mes), "MMM/yyyy", { locale: ptBR })}\nValor: ${formatCurrency(valor)}\nMoM: ${fmtPct(mom)} · YoY: ${fmtPct(yoy)}\nz: ${fmtZ(z)}`}
                      className={cn(
                        "m-0.5 h-7 rounded-sm text-[10px] tabular-nums transition-colors",
                        zCellClass(z),
                        "hover:ring-1 hover:ring-ring",
                        selecionada && "ring-2 ring-ring",
                      )}
                      aria-label={`${dept.departamento_nome}, ${format(parseISO(mes), "MMMM 'de' yyyy", { locale: ptBR })}: ${formatCurrency(valor)}`}
                    />
                  );
                })}
              </div>
            );
          })}
        </div>
      </div>

      <p className="mt-2 text-[10px] text-muted-foreground">
        Clique numa célula para carregar a série e o detalhamento do departamento naquele mês. A linha{" "}
        <span className="italic">{SEM_DEPTO_NOME}</span> agrupa lançamentos sem departamento.
      </p>
    </div>
  );
}
