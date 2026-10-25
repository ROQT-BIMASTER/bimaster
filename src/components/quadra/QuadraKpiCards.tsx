import { AlertTriangle, ArrowDownCircle, ArrowUpCircle, Clock, Wallet } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { formatCurrency } from "@/lib/formatters";
import { cn } from "@/lib/utils";
import type { ResumoFinanceiro } from "@/lib/quadra/resumoFinanceiro";

interface Props {
  resumo: ResumoFinanceiro;
  loading?: boolean;
}

interface KpiProps {
  titulo: string;
  valor: number;
  icon: React.ElementType;
  tom?: "positivo" | "negativo" | "neutro" | "alerta";
  detalhe?: string;
  loading?: boolean;
}

function Kpi({ titulo, valor, icon: Icon, tom = "neutro", detalhe, loading }: KpiProps) {
  const cor =
    tom === "positivo"
      ? "text-success"
      : tom === "negativo"
        ? "text-destructive"
        : tom === "alerta"
          ? "text-warning"
          : "text-foreground";
  return (
    <Card className="bg-card/70 backdrop-blur-sm">
      <CardContent className="p-4">
        <div className="flex items-center justify-between">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{titulo}</p>
          <Icon className={cn("h-4 w-4", cor)} />
        </div>
        {loading ? (
          <Skeleton className="mt-2 h-7 w-28" />
        ) : (
          <p className={cn("mt-1 text-2xl font-semibold tabular-nums", cor)}>{formatCurrency(valor)}</p>
        )}
        {detalhe && !loading && <p className="mt-1 text-xs text-muted-foreground">{detalhe}</p>}
      </CardContent>
    </Card>
  );
}

export function QuadraKpiCards({ resumo, loading }: Props) {
  const saldoTom = resumo.saldoRealizado >= 0 ? "positivo" : "negativo";
  const atrasadosQtd = resumo.qtdReceitasAtrasadas + resumo.qtdDespesasAtrasadas;
  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
      <Kpi
        titulo="Receitas recebidas"
        valor={resumo.receitasRecebidas}
        icon={ArrowUpCircle}
        tom="positivo"
        detalhe={`A receber: ${formatCurrency(resumo.receitasPendentes)}`}
        loading={loading}
      />
      <Kpi
        titulo="Despesas pagas"
        valor={resumo.despesasPagas}
        icon={ArrowDownCircle}
        tom="negativo"
        detalhe={`A pagar: ${formatCurrency(resumo.despesasPendentes)}`}
        loading={loading}
      />
      <Kpi
        titulo="Saldo realizado"
        valor={resumo.saldoRealizado}
        icon={Wallet}
        tom={saldoTom}
        detalhe="Recebido menos pago"
        loading={loading}
      />
      <Kpi
        titulo="Saldo previsto"
        valor={resumo.saldoPrevisto}
        icon={Clock}
        tom={resumo.saldoPrevisto >= 0 ? "neutro" : "negativo"}
        detalhe="Inclui pendências do mês"
        loading={loading}
      />
      <Kpi
        titulo="Em atraso"
        valor={resumo.receitasAtrasadas + resumo.despesasAtrasadas}
        icon={AlertTriangle}
        tom={atrasadosQtd > 0 ? "alerta" : "neutro"}
        detalhe={
          atrasadosQtd > 0
            ? `${resumo.qtdReceitasAtrasadas} a receber, ${resumo.qtdDespesasAtrasadas} a pagar`
            : "Nenhum lançamento vencido"
        }
        loading={loading}
      />
    </div>
  );
}
