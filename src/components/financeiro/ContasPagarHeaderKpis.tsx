import { RefreshCw } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { formatCurrency } from "@/lib/formatters";
import { useSyncControlRubysp } from "@/hooks/fornecedor/useSyncControlRubysp";
import type { CpDashboardPayload, CpKpisPayload } from "@/types/financeiro/cp-agregados";

interface Props {
  dashboard: CpDashboardPayload | undefined;
  kpis: CpKpisPayload | undefined;
  isLoading: boolean;
  onOpenVencidos?: () => void;
}

const num = (v: number) => formatCurrency(v ?? 0);

function Kpi({ label, value, tone = "muted", hint }: { label: string; value: string; tone?: "muted" | "emerald" | "amber" | "destructive"; hint?: string }) {
  const toneCls =
    tone === "emerald" ? "text-success"
    : tone === "amber" ? "text-amber-600 dark:text-amber-400"
    : tone === "destructive" ? "text-destructive"
    : "text-foreground";
  return (
    <div className="flex flex-col" title={hint}>
      <span className={cn("text-[10px] font-bold uppercase tracking-wider text-muted-foreground", hint && "cursor-help underline decoration-dotted decoration-muted-foreground/40 underline-offset-2")}>{label}</span>
      <span className={cn("text-sm font-semibold tabular-nums", toneCls)}>{value}</span>
    </div>
  );
}

export function ContasPagarHeaderKpis({ dashboard, kpis, isLoading, onOpenVencidos }: Props) {
  const sync = useSyncControlRubysp();
  const syncStatus = sync.data?.status_contas_pagar ?? null;
  const rodando = syncStatus === "rodando" || sync.isSyncing;
  const ultima = sync.data?.ultima_exec_contas_pagar
    ? formatDistanceToNow(new Date(sync.data.ultima_exec_contas_pagar), { locale: ptBR, addSuffix: true })
    : "nunca";
  const dotClass =
    syncStatus === "ok" ? "bg-success"
    : rodando ? "bg-amber-500 animate-pulse"
    : syncStatus === "erro" ? "bg-destructive"
    : "bg-muted-foreground/40";
  const syncLabel =
    rodando ? "Sincronizando"
    : syncStatus === "ok" ? "Atualizado"
    : syncStatus === "erro" ? "Erro na última execução"
    : "Aguardando";

  const totalAberto = dashboard?.total_aberto ?? 0;
  const dividaFirme = dashboard?.lancado_aberto ?? 0;
  const provisao = dashboard?.provisionado_aberto ?? 0;
  const qtdAberto = dashboard?.qtd_aberto ?? 0;

  const vencido30 = dashboard?.vencido_30_mais;
  const vencidoTotal = dashboard?.vencido_total;
  const venceHoje = dashboard?.vence_hoje;
  const vence7d = dashboard?.vence_7d;
  const vence30d = dashboard?.vence_30d;

  const pagasMes = dashboard?.pago_mes_atual ?? 0;
  const mesAtual = kpis?.total_mes_atual ?? 0;
  const pmp = kpis?.pmp_dias_aprox ?? 0;
  const pontualidade = Math.round(kpis?.pontualidade_pct_aprox ?? 0);
  const aproximado = kpis?.aproximado ?? true;

  if (isLoading) {
    return (
      <div className="grid grid-cols-12 gap-4">
        <div className="col-span-12 lg:col-span-4 h-40 rounded-2xl border border-border bg-card animate-pulse" />
        <div className="col-span-12 lg:col-span-8 h-40 rounded-2xl border border-border bg-card animate-pulse" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Barra superior de performance */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-end gap-3">
        <div className="flex items-center gap-6 rounded-xl border border-border bg-card px-5 py-2.5 shadow-sm">
          <Kpi label="Pagas no Mês" value={num(pagasMes)} tone="emerald" />
          <div className="h-8 w-px bg-border" />
          <Kpi label="PMP" value={`${pmp} dias${aproximado ? " ≈" : ""}`} hint="Prazo médio dos pagamentos concluídos em até 180 dias (exclui adiantamentos e títulos muito antigos)." />
          <div className="h-8 w-px bg-border" />
          <Kpi
            label="Pontualidade"
            value={`${pontualidade}%${aproximado ? " ≈" : ""}`}
            tone={pontualidade >= 80 ? "emerald" : pontualidade >= 50 ? "amber" : "destructive"}
            hint="% dos títulos quitados pagos até o vencimento."
          />
        </div>
      </div>

      {/* KPIs principais */}
      <div className="grid grid-cols-12 gap-4">
        {/* Hero — Total em Aberto */}
        <div className="col-span-12 lg:col-span-4 bg-card p-6 rounded-2xl border border-border shadow-sm flex flex-col justify-between">
          <div>
            <span className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Total em Aberto</span>
            <div className="mt-1 text-4xl font-bold text-foreground tracking-tight tabular-nums font-mono">
              {num(totalAberto)}
            </div>
            <p className="text-[11px] text-muted-foreground mt-1">{qtdAberto.toLocaleString("pt-BR")} títulos</p>
          </div>

          <div className="mt-6 pt-6 border-t border-border/60 grid grid-cols-2 gap-4">
            <div>
              <span className="text-[10px] font-medium text-muted-foreground block mb-1 uppercase tracking-wide">Dívida Firme</span>
              <span className="text-sm font-semibold text-foreground tabular-nums">{num(dividaFirme)}</span>
            </div>
            <div>
              <span className="text-[10px] font-medium text-muted-foreground block mb-1 uppercase tracking-wide">Provisão</span>
              <span className="text-sm font-semibold text-muted-foreground tabular-nums">{num(provisao)}</span>
            </div>
          </div>
        </div>

        {/* Aging + próximos */}
        <div className="col-span-12 lg:col-span-8 grid grid-cols-2 md:grid-cols-4 gap-3">
          {/* Vencido +30d */}
          <div className="bg-destructive/5 p-4 rounded-xl border border-destructive/20 flex flex-col justify-between">
            <div>
              <span className="text-[10px] font-bold text-destructive uppercase tracking-wider">Vencido +30d</span>
              <div className="text-xl font-bold text-destructive mt-1 tabular-nums font-mono">
                {num(vencido30?.valor ?? 0)}
              </div>
            </div>
            <div className="text-[10px] text-destructive/80 font-medium mt-2">
              {(vencido30?.qtd ?? 0).toLocaleString("pt-BR")} títulos · crítico
            </div>
          </div>

          {/* Total Vencido */}
          <div className="bg-card p-4 rounded-xl border border-border flex flex-col justify-between">
            <div>
              <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Total Vencido</span>
              <div className="text-xl font-bold text-foreground mt-1 tabular-nums font-mono">
                {num(vencidoTotal?.valor ?? 0)}
              </div>
            </div>
            <button
              type="button"
              onClick={onOpenVencidos}
              className="text-[10px] text-destructive font-medium mt-2 underline underline-offset-2 hover:text-destructive/80 text-left"
            >
              Ver {(vencidoTotal?.qtd ?? 0).toLocaleString("pt-BR")} títulos
            </button>
          </div>

          {/* Vencendo Hoje */}
          <div className="bg-amber-500/5 p-4 rounded-xl border border-amber-500/30 flex flex-col justify-between">
            <div>
              <span className="text-[10px] font-bold text-amber-700 dark:text-amber-400 uppercase tracking-wider">Vencendo Hoje</span>
              <div className="text-xl font-bold text-amber-700 dark:text-amber-400 mt-1 tabular-nums font-mono">
                {num(venceHoje?.valor ?? 0)}
              </div>
            </div>
            <div className="text-[10px] text-amber-700/80 dark:text-amber-400/80 font-medium mt-2">
              {(venceHoje?.qtd ?? 0).toLocaleString("pt-BR")} títulos hoje
            </div>
          </div>

          {/* Próximos 7 Dias */}
          <div className="bg-card p-4 rounded-xl border border-border flex flex-col justify-between">
            <div>
              <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Próximos 7 Dias</span>
              <div className="text-xl font-bold text-foreground mt-1 tabular-nums font-mono">
                {num(vence7d?.valor ?? 0)}
              </div>
            </div>
            <div className="text-[10px] text-muted-foreground font-medium mt-2">
              {(vence7d?.qtd ?? 0).toLocaleString("pt-BR")} títulos no período
            </div>
          </div>

          {/* Próximos 30 dias (destaque escuro) */}
          <div className="col-span-2 bg-foreground/95 dark:bg-card p-4 rounded-xl flex items-center justify-between border border-border">
            <div>
              <span className="text-[10px] font-bold text-background/70 dark:text-muted-foreground uppercase tracking-wider">Próximos 30 dias</span>
              <div className="text-xl font-bold text-background dark:text-foreground mt-0.5 tabular-nums font-mono">
                {num(vence30d?.valor ?? 0)}
              </div>
            </div>
            <div className="text-right">
              <div className="text-[10px] text-background/60 dark:text-muted-foreground font-medium uppercase">Mês Atual</div>
              <div className="text-sm font-semibold text-background/90 dark:text-foreground tabular-nums">{num(mesAtual)}</div>
            </div>
          </div>

          {/* Frescor / sync */}
          <div className="col-span-2 bg-card p-4 rounded-xl border border-border flex items-center justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <span className={cn("h-2.5 w-2.5 rounded-full shrink-0", dotClass)} aria-hidden />
              <div className="flex flex-col leading-tight min-w-0">
                <span className="text-xs font-medium text-foreground">{syncLabel}</span>
                <span className="text-[11px] text-muted-foreground truncate">
                  {sync.isLoading ? "Carregando…" : `Atualizado ${ultima}`}
                </span>
              </div>
            </div>
            <Button
              size="sm"
              variant="outline"
              className="h-8 gap-1.5 shrink-0"
              onClick={() => sync.solicitarSync("contas_pagar")}
              disabled={rodando}
            >
              <RefreshCw className={cn("h-3.5 w-3.5", rodando && "animate-spin")} />
              {rodando ? "Rodando…" : "Atualizar"}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
