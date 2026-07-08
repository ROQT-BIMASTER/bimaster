import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { formatDuracaoCurta } from "@/lib/formatters";
import type { PedidoRubyspExt } from "@/hooks/fornecedor/useRubyspPedidos";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface Props {
  pedido: PedidoRubyspExt;
  etapaAtual: string;
}

type StepId =
  | "digitacao"
  | "liberacao"
  | "separacao"
  | "conferencia"
  | "expedicao"
  | "faturamento"
  | "entrega";

interface StepDef {
  id: StepId;
  short: string;
  label: string;
  tempoKey: keyof NonNullable<PedidoRubyspExt["tempos"]>;
  /** etapa canônica (etapa do pedido) que corresponde ao PERÍODO em que este passo está em curso. */
  etapaMatch: string[];
  color: string; // tailwind bg tint (5-10% opacity) para etapa concluída
  fg: string; // tailwind text
  ring: string; // ring color quando ativo
}

const STEPS: StepDef[] = [
  {
    id: "digitacao",
    short: "Dig",
    label: "Digitação → Liberação",
    tempoKey: "digitacao_lib_min",
    etapaMatch: ["digitacao", "aberto"],
    color: "bg-sky-500/15",
    fg: "text-sky-700 dark:text-sky-300",
    ring: "ring-sky-500/40",
  },
  {
    id: "liberacao",
    short: "Lib",
    label: "Aguard. separação",
    tempoKey: "aguard_separacao_min",
    etapaMatch: [],
    color: "bg-sky-400/15",
    fg: "text-sky-700 dark:text-sky-300",
    ring: "ring-sky-500/40",
  },
  {
    id: "separacao",
    short: "Sep",
    label: "Separação",
    tempoKey: "separacao_min",
    etapaMatch: ["separacao"],
    color: "bg-amber-500/15",
    fg: "text-amber-700 dark:text-amber-300",
    ring: "ring-amber-500/40",
  },
  {
    id: "conferencia",
    short: "Conf",
    label: "Aguard. expedição",
    tempoKey: "aguard_expedicao_min",
    etapaMatch: ["separado", "conferido"],
    color: "bg-violet-500/15",
    fg: "text-violet-700 dark:text-violet-300",
    ring: "ring-violet-500/40",
  },
  {
    id: "expedicao",
    short: "Exp",
    label: "Expedição → Faturamento",
    tempoKey: "faturamento_min",
    etapaMatch: [],
    color: "bg-violet-400/15",
    fg: "text-violet-700 dark:text-violet-300",
    ring: "ring-violet-500/40",
  },
  {
    id: "faturamento",
    short: "Fat",
    label: "Faturamento",
    tempoKey: "entrega_min",
    etapaMatch: ["faturado"],
    color: "bg-emerald-500/15",
    fg: "text-emerald-700 dark:text-emerald-300",
    ring: "ring-emerald-500/40",
  },
  {
    id: "entrega",
    short: "Entr",
    label: "Entregue",
    tempoKey: "entrega_min",
    etapaMatch: ["entregue"],
    color: "bg-emerald-600/20",
    fg: "text-emerald-700 dark:text-emerald-300",
    ring: "ring-emerald-600/50",
  },
];

/** Retorna o timestamp do marco correspondente ao INÍCIO da etapa (fim do passo anterior). */
function marcoDe(pedido: PedidoRubyspExt, id: StepId): string | null {
  const m = pedido.marcos;
  if (!m) return null;
  switch (id) {
    case "digitacao":
      return m.digitacao ?? null;
    case "liberacao":
      return m.liberacao ?? null;
    case "separacao":
      return m.separacao ?? null;
    case "conferencia":
      return m.conferencia ?? null;
    case "expedicao":
      return m.expedicao ?? null;
    case "faturamento":
      return m.faturamento ?? null;
    case "entrega":
      return m.entrega ?? null;
  }
}

/** Ordem dos marcos para caminho concluído. */
const ORDEM_MARCOS: StepId[] = [
  "digitacao",
  "liberacao",
  "separacao",
  "conferencia",
  "expedicao",
  "faturamento",
  "entrega",
];

export function PedidoTimelineChip({ pedido, etapaAtual }: Props) {
  const tempos = pedido.tempos ?? null;
  const etapaAtualIdx = STEPS.findIndex((s) => s.etapaMatch.includes(etapaAtual));

  // Determina, para cada passo: concluído (tem marco), em curso (etapa atual bate), ou futuro.
  const now = Date.now();
  const items = STEPS.map((step, idx) => {
    const marcoInicio = marcoDe(pedido, step.id);
    const proximoId = ORDEM_MARCOS[ORDEM_MARCOS.indexOf(step.id) + 1] as StepId | undefined;
    const marcoFim = proximoId ? marcoDe(pedido, proximoId) : null;
    const concluido = Boolean(marcoInicio && marcoFim);
    const emCurso =
      !concluido &&
      Boolean(marcoInicio) &&
      (etapaAtualIdx === -1 ? false : idx === etapaAtualIdx);

    let minutos: number | null = tempos ? (tempos[step.tempoKey] ?? null) : null;
    if (minutos == null && marcoInicio && marcoFim) {
      minutos = (new Date(marcoFim).getTime() - new Date(marcoInicio).getTime()) / 60_000;
    }
    if (minutos == null && emCurso && marcoInicio) {
      minutos = (now - new Date(marcoInicio).getTime()) / 60_000;
    }

    return {
      step,
      idx,
      concluido,
      emCurso,
      marcoInicio,
      marcoFim,
      minutos,
    };
  });

  return (
    <div className="flex items-stretch gap-0.5">
      {items.map(({ step, concluido, emCurso, marcoInicio, marcoFim, minutos }) => {
        const isFuture = !concluido && !emCurso;
        const label = formatDuracaoCurta(minutos);
        return (
          <Tooltip key={step.id} delayDuration={150}>
            <TooltipTrigger asChild>
              <div
                className={cn(
                  "flex-1 min-w-0 rounded-sm px-1 py-1 text-[9px] leading-tight text-center border border-transparent transition-colors",
                  concluido && `${step.color} ${step.fg}`,
                  emCurso && `${step.color} ${step.fg} ring-1 ${step.ring} animate-pulse`,
                  isFuture && "bg-muted/40 text-muted-foreground/60",
                )}
              >
                <div className="font-medium">{step.short}</div>
                <div className="font-semibold tabular-nums">{isFuture ? "—" : label}</div>
              </div>
            </TooltipTrigger>
            <TooltipContent side="bottom" className="max-w-[220px]">
              <div className="text-[11px] font-semibold">{step.label}</div>
              {marcoInicio && (
                <div className="text-[10px] text-muted-foreground">
                  Início:{" "}
                  {format(new Date(marcoInicio), "dd/MM HH:mm", { locale: ptBR })}
                </div>
              )}
              {marcoFim && (
                <div className="text-[10px] text-muted-foreground">
                  Fim: {format(new Date(marcoFim), "dd/MM HH:mm", { locale: ptBR })}
                </div>
              )}
              <div className="text-[11px] mt-0.5">
                {concluido && `Duração: ${label}`}
                {emCurso && `Em curso · ${label} até agora`}
                {isFuture && "Etapa ainda não iniciada"}
              </div>
            </TooltipContent>
          </Tooltip>
        );
      })}
    </div>
  );
}
