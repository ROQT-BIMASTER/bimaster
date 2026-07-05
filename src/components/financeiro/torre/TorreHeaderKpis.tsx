// Header de KPIs da Torre de Despesas — segue o padrão visual de ContasPagarHeaderKpis
// (hero col-span-4 text-4xl tabular-nums font-mono; cards rounded-xl; tons success/amber/destructive).
import { AlertTriangle, TrendingDown, TrendingUp } from "lucide-react";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { formatCurrency } from "@/lib/formatters";
import type { TorreDepartamentosPayload } from "@/types/financeiro/torre-despesas";

interface Props {
  payload: TorreDepartamentosPayload | undefined;
  isLoading: boolean;
}

const num = (v: number) => formatCurrency(v ?? 0);

const fmtPct = (v: number | null) =>
  v === null || v === undefined
    ? "—"
    : `${v > 0 ? "+" : ""}${v.toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%`;

function pctTone(v: number | null): "muted" | "emerald" | "destructive" {
  // Despesa: subir é ruim (destructive), cair é bom (success)
  if (v === null || v === undefined) return "muted";
  if (v > 0) return "destructive";
  if (v < 0) return "emerald";
  return "muted";
}

export function TorreHeaderKpis({ payload, isLoading }: Props) {
  if (isLoading || !payload) {
    return (
      <div className="grid grid-cols-12 gap-4">
        <div className="col-span-12 lg:col-span-4 h-36 rounded-2xl border border-border bg-card animate-pulse" />
        <div className="col-span-12 lg:col-span-8 h-36 rounded-2xl border border-border bg-card animate-pulse" />
      </div>
    );
  }

  const { totais, qualidade, meta, departamentos } = payload;

  // Maior anomalia do mês de referência (|z| máximo entre departamentos)
  const anomalia = departamentos.reduce<{ nome: string; z: number } | null>((acc, d) => {
    if (d.z_mes_ref === null) return acc;
    if (!acc || Math.abs(d.z_mes_ref) > Math.abs(acc.z)) {
      return { nome: d.departamento_nome, z: d.z_mes_ref };
    }
    return acc;
  }, null);

  const absZ = anomalia ? Math.abs(anomalia.z) : 0;
  const anomaliaTone =
    absZ >= 3 ? "text-destructive" : absZ >= 2 ? "text-amber-600 dark:text-amber-400" : "text-foreground";

  const mesRefLabel = format(parseISO(meta.mes_ref), "MMMM 'de' yyyy", { locale: ptBR });

  const momTone = pctTone(totais.mom_pct);
  const yoyTone = pctTone(totais.yoy_pct);
  const toneCls = (t: "muted" | "emerald" | "destructive") =>
    t === "emerald" ? "text-success" : t === "destructive" ? "text-destructive" : "text-foreground";

  const mostrarBanner = qualidade.pct_valor_sem_depto > 1;

  return (
    <div className="space-y-3">
      {/* Banner fino de qualidade */}
      {mostrarBanner && (
        <div className="flex items-center gap-2 rounded-lg border border-amber-500/30 bg-amber-500/5 px-4 py-2">
          <AlertTriangle className="h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" />
          <p className="text-xs text-amber-700 dark:text-amber-400">
            <span className="font-semibold tabular-nums">
              {qualidade.pct_valor_sem_depto.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%
            </span>{" "}
            do valor do mês está sem departamento ({num(qualidade.valor_sem_depto)}). Classificações de baixa
            confiança:{" "}
            <span className="font-semibold tabular-nums">
              {qualidade.pct_baixa_conf.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%
            </span>
            .
          </p>
        </div>
      )}

      <div className="grid grid-cols-12 gap-4">
        {/* Hero — Total do mês de referência */}
        <div className="col-span-12 lg:col-span-4 bg-card p-6 rounded-2xl border border-border shadow-sm flex flex-col justify-between">
          <div>
            <span className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
              Total de despesas
            </span>
            <div className="mt-1 text-4xl font-bold text-foreground tracking-tight tabular-nums font-mono">
              {num(totais.total_mes_ref)}
            </div>
            <p className="text-[11px] text-muted-foreground mt-1 capitalize">{mesRefLabel}</p>
          </div>
          <div className="mt-6 pt-6 border-t border-border/60 grid grid-cols-2 gap-4">
            <div>
              <span className="text-[10px] font-medium text-muted-foreground block mb-1 uppercase tracking-wide">
                Departamentos
              </span>
              <span className="text-sm font-semibold text-foreground tabular-nums">
                {departamentos.filter((d) => d.departamento_id !== null).length}
              </span>
            </div>
            <div>
              <span className="text-[10px] font-medium text-muted-foreground block mb-1 uppercase tracking-wide">
                Janela
              </span>
              <span className="text-sm font-semibold text-muted-foreground tabular-nums">{meta.meses} meses</span>
            </div>
          </div>
        </div>

        {/* MoM / YoY / Maior anomalia */}
        <div className="col-span-12 lg:col-span-8 grid grid-cols-1 md:grid-cols-3 gap-3">
          <div className="bg-card p-4 rounded-xl border border-border flex flex-col justify-between">
            <div>
              <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
                vs. mês anterior (MoM)
              </span>
              <div className={cn("text-xl font-bold mt-1 tabular-nums font-mono", toneCls(momTone))}>
                {fmtPct(totais.mom_pct)}
              </div>
            </div>
            <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground font-medium mt-2">
              {momTone === "destructive" ? (
                <TrendingUp className="h-3 w-3 text-destructive" />
              ) : momTone === "emerald" ? (
                <TrendingDown className="h-3 w-3 text-success" />
              ) : null}
              variação do total mensal
            </div>
          </div>

          <div className="bg-card p-4 rounded-xl border border-border flex flex-col justify-between">
            <div>
              <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
                vs. ano anterior (YoY)
              </span>
              <div className={cn("text-xl font-bold mt-1 tabular-nums font-mono", toneCls(yoyTone))}>
                {fmtPct(totais.yoy_pct)}
              </div>
            </div>
            <div className="text-[10px] text-muted-foreground font-medium mt-2">mesmo mês do ano passado</div>
          </div>

          <div
            className={cn(
              "p-4 rounded-xl border flex flex-col justify-between",
              absZ >= 3
                ? "bg-destructive/5 border-destructive/20"
                : absZ >= 2
                  ? "bg-amber-500/5 border-amber-500/30"
                  : "bg-card border-border",
            )}
          >
            <div>
              <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
                Maior anomalia |z|
              </span>
              <div className={cn("text-xl font-bold mt-1 tabular-nums font-mono", anomaliaTone)}>
                {anomalia
                  ? anomalia.z.toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 })
                  : "—"}
              </div>
            </div>
            <div className="text-[10px] text-muted-foreground font-medium mt-2 truncate">
              {anomalia ? anomalia.nome : "sem histórico suficiente"}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
