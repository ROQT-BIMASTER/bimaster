import { Card, CardContent } from "@/components/ui/card";
import { Users, UserCheck, UserX, TrendingUp, DollarSign, Target, ShieldAlert, AlertTriangle } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import type { PortfolioKPIs } from "@/hooks/useClienteAnalytics";

interface Props {
  kpis: PortfolioKPIs | undefined;
  isLoading: boolean;
}

const formatCurrency = (v: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 }).format(v);

const formatPct = (v: number) => `${v.toFixed(1)}%`;

export function PortfolioHealthCards({ kpis, isLoading }: Props) {
  if (isLoading) {
    return (
      <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
        {[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-[100px] rounded-xl" />)}
      </div>
    );
  }

  if (!kpis) return null;

  const cards = [
    {
      label: "Taxa de Conversão",
      value: formatPct(kpis.taxaConversao),
      subtitle: `${kpis.clientesComCompra} de ${kpis.totalClientes} compraram`,
      icon: Target,
      iconBg: "bg-blue-100 dark:bg-blue-900/50",
      iconColor: "text-blue-600 dark:text-blue-400",
      borderColor: "border-l-blue-500",
    },
    {
      label: "Ticket Médio (Última)",
      value: formatCurrency(kpis.ticketMedio),
      subtitle: `Maior histórico: ${formatCurrency(kpis.ticketMaiorMedio)}`,
      icon: DollarSign,
      iconBg: "bg-green-100 dark:bg-green-900/50",
      iconColor: "text-green-600 dark:text-green-400",
      borderColor: "border-l-green-500",
    },
    {
      label: "Clientes Ativos",
      value: `${kpis.ativos}`,
      subtitle: `${kpis.emRisco} em risco · ${kpis.inativos} inativos`,
      icon: UserCheck,
      iconBg: "bg-emerald-100 dark:bg-emerald-900/50",
      iconColor: "text-emerald-600 dark:text-emerald-400",
      borderColor: "border-l-emerald-500",
    },
    {
      label: "Sem Compra",
      value: `${kpis.clientesSemCompra}`,
      subtitle: `${formatPct(100 - kpis.taxaConversao)} da base nunca comprou`,
      icon: UserX,
      iconBg: "bg-red-100 dark:bg-red-900/50",
      iconColor: "text-red-600 dark:text-red-400",
      borderColor: "border-l-red-500",
    },
  ];

  return (
    <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
      {cards.map((card) => {
        const Icon = card.icon;
        return (
          <Card key={card.label} className={`border-l-4 ${card.borderColor}`}>
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-2">
                <div className={`p-1.5 rounded-lg ${card.iconBg}`}>
                  <Icon className={`h-4 w-4 ${card.iconColor}`} />
                </div>
                <span className="text-xs text-muted-foreground font-medium">{card.label}</span>
              </div>
              <p className="text-2xl font-bold">{card.value}</p>
              <p className="text-xs text-muted-foreground mt-0.5">{card.subtitle}</p>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
