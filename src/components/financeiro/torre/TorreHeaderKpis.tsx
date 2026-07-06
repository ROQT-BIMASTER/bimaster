// Header de KPIs da Torre de Despesas — 4 tiles uniformes (modelo v1 aprovado).
// Total | MoM | YoY | Maior anomalia |z|. Tokens semânticos, sem cores literais.
import { AlertTriangle } from "lucide-react";
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

/** Formato compacto R$ 172k / R$ 1,2M para chip de delta. */
function fmtDeltaAbs(v: number): string {
  const sinal = v > 0 ? "+ " : v < 0 ? "− " : "";
  const abs = Math.abs(v);
  if (abs >= 1_000_000) return `${sinal}R$ ${(abs / 1_000_000).toLocaleString("pt-BR", { maximumFractionDigits: 1 })}M`;
  if (abs >= 1_000) return `${sinal}R$ ${Math.round(abs / 1_000).toLocaleString("pt-BR")}k`;
  return `${sinal}${formatCurrency(abs)}`;
}

type Tone = "muted" | "success" | "destructive";

function pctTone(v: number | null): Tone {
  // Despesa: subir é ruim (destructive), cair é bom (success)
  if (v === null || v === undefined) return "muted";
  if (v > 0) return "destructive";
  if (v < 0) return "success";
  return "muted";
}

const toneText = (t: Tone) =>
  t === "success" ? "text-success" : t === "destructive" ? "text-destructive" : "text-foreground";

const toneChip = (t: Tone) =>
  t === "success"
    ? "bg-success/10 text-success"
    : t === "destructive"
      ? "bg-destructive/10 text-destructive"
      : "bg-muted text-muted-foreground";

export function TorreHeaderKpis({ payload, isLoading }: Props) {
  if (isLoading || !payload) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-24 rounded-xl border border-border bg-card animate-pulse" />
        ))}
      </div>
    );
  }

  const { totais, qualidade, meta, departamentos } = payload;

  // Delta absoluto MoM: total_mes_ref − valor do mês imediatamente anterior na série
  const serie = totais.serie ?? [];
  const prevMoM = serie.length >= 2 ? serie[serie.length - 2].valor : null;
  const deltaMoM = prevMoM !== null ? totais.total_mes_ref - prevMoM : null;

  // Delta absoluto YoY: total_mes_ref − valor 12 meses atrás na série (se existir)
  const prevYoY = serie.length >= 13 ? serie[serie.length - 13].valor : null;
  const deltaYoY = prevYoY !== null ? totais.total_mes_ref - prevYoY : null;

  // Maior anomalia do mês de referência (|z| máximo entre departamentos)
  const anomalia = departamentos.reduce<{ nome: string; z: number } | null>((acc, d) => {
    if (d.z_mes_ref === null) return acc;
    if (!acc || Math.abs(d.z_mes_ref) > Math.abs(acc.z)) {
      return { nome: d.departamento_nome, z: d.z_mes_ref };
    }
    return acc;
  }, null);

  const absZ = anomalia ? Math.abs(anomalia.z) : 0;
  const anomaliaTone: Tone = absZ >= 3 ? "destructive" : absZ >= 2 ? "muted" : "muted";
  const anomaliaCritico = absZ >= 3;

  const mesRefLabel = format(parseISO(meta.mes_ref), "MMMM 'de' yyyy", { locale: ptBR });
  const mesRefCap = mesRefLabel.charAt(0).toUpperCase() + mesRefLabel.slice(1);

  const momTone = pctTone(totais.mom_pct);
  const yoyTone = pctTone(totais.yoy_pct);

  const mostrarBanner = qualidade.pct_valor_sem_depto > 1;

  return (
    <div className="space-y-3">
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

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total de Despesas */}
        <div className="bg-card p-4 rounded-xl border border-border shadow-sm">
          <p className="text-[11px] font-semibold text-muted-foreground mb-1 uppercase tracking-wider">
            Total de despesas
          </p>
          <h3 className="text-2xl font-bold text-foreground tabular-nums font-mono">
            {num(totais.total_mes_ref)}
          </h3>
          <p className="text-[11px] text-muted-foreground mt-1 capitalize">{mesRefCap}</p>
        </div>

        {/* MoM */}
        <div className="bg-card p-4 rounded-xl border border-border shadow-sm">
          <p className="text-[11px] font-semibold text-muted-foreground mb-1 uppercase tracking-wider">
            Variação MoM
          </p>
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className={cn("text-2xl font-bold tabular-nums font-mono", toneText(momTone))}>
              {fmtPct(totais.mom_pct)}
            </h3>
            {deltaMoM !== null && (
              <span className={cn("px-1.5 py-0.5 rounded text-[10px] font-bold tabular-nums", toneChip(momTone))}>
                {fmtDeltaAbs(deltaMoM)}
              </span>
            )}
          </div>
          <p className="text-[11px] text-muted-foreground mt-1">vs. mês anterior</p>
        </div>

        {/* YoY */}
        <div className="bg-card p-4 rounded-xl border border-border shadow-sm">
          <p className="text-[11px] font-semibold text-muted-foreground mb-1 uppercase tracking-wider">
            Variação YoY
          </p>
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className={cn("text-2xl font-bold tabular-nums font-mono", toneText(yoyTone))}>
              {fmtPct(totais.yoy_pct)}
            </h3>
            {deltaYoY !== null && (
              <span className={cn("px-1.5 py-0.5 rounded text-[10px] font-bold tabular-nums", toneChip(yoyTone))}>
                {fmtDeltaAbs(deltaYoY)}
              </span>
            )}
          </div>
          <p className="text-[11px] text-muted-foreground mt-1">mesmo mês do ano passado</p>
        </div>

        {/* Maior Anomalia |z| */}
        <div
          className={cn(
            "bg-card p-4 rounded-xl border border-border shadow-sm",
            anomaliaCritico && "border-l-4 border-l-destructive",
          )}
        >
          <p className="text-[11px] font-semibold text-muted-foreground mb-1 uppercase tracking-wider">
            Maior anomalia |z|
          </p>
          <h3 className={cn("text-2xl font-bold tabular-nums font-mono", toneText(anomaliaTone))}>
            {anomalia
              ? `${anomalia.z > 0 ? "+" : ""}${anomalia.z.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
              : "—"}
          </h3>
          <p className="text-[11px] text-muted-foreground mt-1 truncate">
            {anomalia ? anomalia.nome : `janela de ${meta.meses} meses`}
          </p>
        </div>
      </div>
    </div>
  );
}
