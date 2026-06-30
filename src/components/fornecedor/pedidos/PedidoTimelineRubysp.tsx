import { Check, CircleDot, Circle } from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import type { RubyspMarcos, RubyspTempos } from "@/hooks/fornecedor/useRubyspPedidos";

interface Props {
  marcos: RubyspMarcos | undefined;
  tempos?: RubyspTempos | undefined;
}

type Step = {
  key: keyof RubyspMarcos;
  label: string;
  /** Campo de tempo no `tempos` que representa o intervalo ATÉ este marco (a partir do anterior). */
  tempoField?: keyof RubyspTempos;
};

// Ordem cronológica real do ERP Result:
const STEPS: Step[] = [
  { key: "digitacao", label: "Digitação" },
  { key: "liberacao", label: "Liberação", tempoField: "digitacao_lib_min" },
  { key: "separacao", label: "Separação", tempoField: "aguard_separacao_min" },
  { key: "conferencia", label: "Conferência", tempoField: "separacao_min" },
  { key: "expedicao", label: "Expedição", tempoField: "aguard_expedicao_min" },
  { key: "faturamento", label: "Faturamento", tempoField: "faturamento_min" },
  { key: "entrega", label: "Entregue", tempoField: "entrega_min" },
];

function fmtTs(iso: string | null | undefined): string {
  if (!iso) return "—";
  try {
    return format(new Date(iso), "dd/MM/yyyy HH:mm");
  } catch {
    return "—";
  }
}

function fmtDelta(min: number | null | undefined): string | null {
  if (min == null || min <= 0) return null;
  if (min < 60) return `+${Math.round(min)}min`;
  const horas = min / 60;
  if (horas < 24) return `+${horas.toFixed(1)}h`;
  const dias = Math.floor(horas / 24);
  const restoH = Math.round(horas - dias * 24);
  return restoH > 0 ? `+${dias}d ${restoH}h` : `+${dias}d`;
}

export function PedidoTimelineRubysp({ marcos, tempos }: Props) {
  if (!marcos) return null;

  // Determina o índice do último marco preenchido
  const lastDoneIdx = STEPS.reduce(
    (acc, s, i) => (marcos[s.key] ? i : acc),
    -1,
  );

  return (
    <section className="rounded-md border border-border bg-card p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-foreground">Linha do tempo</h3>
        {tempos?.lead_time_entrega_min != null && tempos.lead_time_entrega_min > 0 ? (
          <span className="text-xs text-muted-foreground">
            Porta-a-porta: <span className="font-medium text-foreground">
              {fmtDelta(tempos.lead_time_entrega_min)?.replace("+", "") ?? "—"}
            </span>
          </span>
        ) : tempos?.lead_time_min != null && tempos.lead_time_min > 0 ? (
          <span className="text-xs text-muted-foreground">
            Até faturamento: <span className="font-medium text-foreground">
              {fmtDelta(tempos.lead_time_min)?.replace("+", "") ?? "—"}
            </span>
          </span>
        ) : null}
      </div>

      <ol className="space-y-3">
        {STEPS.map((s, i) => {
          const ts = marcos[s.key];
          const done = !!ts;
          const current = !done && i === lastDoneIdx + 1;
          const delta = s.tempoField ? fmtDelta(tempos?.[s.tempoField]) : null;

          return (
            <li key={s.key} className="flex items-start gap-3">
              <div
                className={cn(
                  "mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border",
                  done
                    ? "bg-emerald-500/10 text-emerald-600 border-emerald-500/40 dark:text-emerald-300"
                    : current
                      ? "bg-primary/10 text-primary border-primary/40"
                      : "bg-muted text-muted-foreground border-border",
                )}
                aria-hidden
              >
                {done ? (
                  <Check className="h-3.5 w-3.5" />
                ) : current ? (
                  <CircleDot className="h-3.5 w-3.5" />
                ) : (
                  <Circle className="h-3 w-3" />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2">
                  <span
                    className={cn(
                      "text-sm",
                      done
                        ? "font-medium text-foreground"
                        : current
                          ? "font-medium text-primary"
                          : "text-muted-foreground",
                    )}
                  >
                    {s.label}
                  </span>
                  {delta && done ? (
                    <span className="text-[11px] text-muted-foreground">{delta}</span>
                  ) : null}
                </div>
                <div className="text-xs text-muted-foreground tabular-nums">{fmtTs(ts)}</div>
              </div>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
