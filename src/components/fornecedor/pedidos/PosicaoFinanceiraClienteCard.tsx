import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { CircleDollarSign } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatCurrency } from "@/lib/formatters";
import { parseLocalDate } from "@/lib/utils/parseLocalDate";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { computeSemaforo } from "@/lib/financeiro/semaforoCliente";
import { usePosicaoFinanceiraCliente } from "@/hooks/financeiro/usePosicaoFinanceiraCliente";

function fmtDate(s: string | null): string {
  const d = parseLocalDate(s);
  return d ? format(d, "dd/MM/yyyy", { locale: ptBR }) : "—";
}

function Metric({ label, value, valueClass }: { label: string; value: React.ReactNode; valueClass?: string }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</span>
      <span className={cn("text-sm font-medium text-foreground tabular-nums", valueClass)}>{value}</span>
    </div>
  );
}

interface Props {
  clienteFuturaId: number | null | undefined;
}

/**
 * Card resumo (semáforo) da posição financeira do cliente.
 * Dados vêm de `cliente_financeiro`, populada por snapshot do Sistema Futura.
 */
export function PosicaoFinanceiraClienteCard({ clienteFuturaId }: Props) {
  const { data, isLoading, error } = usePosicaoFinanceiraCliente(clienteFuturaId);

  if (clienteFuturaId == null) return null;

  if (isLoading) {
    return (
      <section className="rounded-md border border-border p-3 space-y-3">
        <Skeleton className="h-4 w-56" />
        <div className="grid grid-cols-3 gap-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-9 w-full" />
          ))}
        </div>
      </section>
    );
  }

  if (error) {
    return (
      <section className="rounded-md border border-border p-3 text-xs text-muted-foreground">
        Posição financeira indisponível no momento.
      </section>
    );
  }

  // Sem linha na tabela = cliente sem títulos em aberto → verde.
  const sem = computeSemaforo({
    vencido: data?.vencido ?? 0,
    maior_atraso_dias: data?.maior_atraso_dias ?? 0,
  });

  const atualizadoEm = data?.sincronizado_em ? new Date(data.sincronizado_em) : null;
  const tooltipTxt = atualizadoEm
    ? `Contas a receber do Sistema Futura, atualizado em ${format(atualizadoEm, "dd/MM/yyyy HH:mm", { locale: ptBR })}.`
    : "Contas a receber do Sistema Futura.";

  return (
    <TooltipProvider delayDuration={200}>
      <section className={cn("rounded-md border p-3 space-y-3", sem.borderClass, sem.bgSoftClass)}>
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-2 min-w-0">
            <CircleDollarSign className="h-4 w-4 text-muted-foreground shrink-0" />
            <h3 className="text-sm font-semibold text-foreground">Posição financeira do cliente</h3>
            <div className="flex items-center gap-1.5 pl-2">
              <span className={cn("h-2 w-2 rounded-full", sem.dotClass)} aria-hidden />
              <span className={cn("text-xs font-medium", sem.textClass)}>{sem.label}</span>
              {sem.legado && (
                <Badge variant="outline" className="ml-1 h-4 px-1.5 text-[10px] uppercase tracking-wider">
                  legado
                </Badge>
              )}
            </div>
          </div>
          <Tooltip>
            <TooltipTrigger asChild>
              <span className="text-[10px] uppercase tracking-wider text-muted-foreground cursor-help">
                fonte: Futura
              </span>
            </TooltipTrigger>
            <TooltipContent side="left" className="max-w-xs text-xs">{tooltipTxt}</TooltipContent>
          </Tooltip>
        </div>

        {!data ? (
          <p className="text-sm text-muted-foreground">Cliente sem títulos em aberto.</p>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            <Metric label="Em aberto" value={formatCurrency(data.em_aberto)} />
            <Metric
              label="Vencido"
              value={formatCurrency(data.vencido)}
              valueClass={cn("font-semibold", sem.tone !== "verde" && sem.textClass)}
            />
            <Metric label="A vencer" value={formatCurrency(data.a_vencer)} />
            <Metric label="Pedidos em aberto" value={data.n_pedidos_abertos.toLocaleString("pt-BR")} />
            <Metric label="Próximo vencimento" value={fmtDate(data.proximo_vencimento)} />
            <Metric
              label="Maior atraso"
              value={data.maior_atraso_dias > 0 ? `${data.maior_atraso_dias.toLocaleString("pt-BR")} d` : "—"}
              valueClass={sem.tone === "vermelho" ? sem.textClass : undefined}
            />
          </div>
        )}
      </section>
    </TooltipProvider>
  );
}
