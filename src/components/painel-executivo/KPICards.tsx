import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { TrendingUp, TrendingDown, DollarSign, ShoppingCart, Receipt, Users, Package, Target } from "lucide-react";
import { formatCurrencySmart } from "@/lib/formatters";
import { SmartValue } from "@/components/ui/smart-value";
import { cn } from "@/lib/utils";

interface KPICardData {
  title: string;
  value: string;
  rawValue?: number;
  isCurrency?: boolean;
  trend?: number;
  icon: React.ElementType;
  color: string;
}

interface Props {
  data: {
    receita_total: number;
    qtde_pedidos: number;
    ticket_medio: number;
    clientes_ativos: number;
    mix_medio: number;
    positivacao: number;
    receita_trend: number;
    pedidos_trend: number;
    ticket_trend: number;
    clientes_trend: number;
    mix_trend: number;
  } | undefined;
  isLoading: boolean;
}

function TrendBadge({ value }: { value: number }) {
  const isPositive = value >= 0;
  return (
    <div className={cn(
      "flex items-center gap-0.5 text-xs font-medium px-1.5 py-0.5 rounded-full",
      isPositive
        ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400"
        : "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400"
    )}>
      {isPositive ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
      {Math.abs(value).toFixed(1)}%
    </div>
  );
}

export function KPICards({ data, isLoading }: Props) {
  if (isLoading) {
    return (
      <div className="grid gap-4 grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        {[...Array(6)].map((_, i) => (
          <Card key={i}>
            <CardContent className="p-4">
              <Skeleton className="h-4 w-24 mb-3" />
              <Skeleton className="h-7 w-32 mb-2" />
              <Skeleton className="h-5 w-16" />
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  if (!data) return null;

  const cards: KPICardData[] = [
    {
      title: "Receita Total",
      value: "",
      rawValue: data.receita_total,
      isCurrency: true,
      trend: data.receita_trend,
      icon: DollarSign,
      color: "text-blue-600 dark:text-blue-400",
    },
    {
      title: "Qtde Pedidos",
      value: data.qtde_pedidos.toLocaleString("pt-BR"),
      trend: data.pedidos_trend,
      icon: ShoppingCart,
      color: "text-violet-600 dark:text-violet-400",
    },
    {
      title: "Ticket Médio",
      value: "",
      rawValue: data.ticket_medio,
      isCurrency: true,
      trend: data.ticket_trend,
      icon: Receipt,
      color: "text-amber-600 dark:text-amber-400",
    },
    {
      title: "Clientes Ativos",
      value: data.clientes_ativos.toLocaleString("pt-BR"),
      trend: data.clientes_trend,
      icon: Users,
      color: "text-emerald-600 dark:text-emerald-400",
    },
    {
      title: "Mix Médio",
      value: data.mix_medio.toFixed(1) + " itens/ped",
      trend: data.mix_trend,
      icon: Package,
      color: "text-cyan-600 dark:text-cyan-400",
    },
    {
      title: "Positivação",
      value: data.positivacao.toFixed(1) + "%",
      icon: Target,
      color: "text-rose-600 dark:text-rose-400",
    },
  ];

  return (
    <div className="grid gap-4 grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
      {cards.map((card, idx) => {
        const Icon = card.icon;
        return (
          <Card key={idx} className="relative overflow-hidden">
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                  {card.title}
                </span>
                <Icon className={cn("h-4 w-4", card.color)} />
              </div>
              <div className="text-xl font-bold tracking-tight mb-1">
                {card.isCurrency && card.rawValue !== undefined ? (
                  <SmartValue value={card.rawValue} />
                ) : (
                  card.value
                )}
              </div>
              {card.trend !== undefined && <TrendBadge value={card.trend} />}
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
