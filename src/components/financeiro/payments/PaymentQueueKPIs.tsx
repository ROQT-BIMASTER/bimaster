import { Card, CardContent } from "@/components/ui/card";
import { Clock, CheckCircle2, XCircle, Wallet, DollarSign } from "lucide-react";
import { cn } from "@/lib/utils";

interface PaymentQueueKPIsProps {
  kpis: {
    pendingCount: number;
    pendingAmount: number;
    acceptedCount: number;
    acceptedAmount: number;
    rejectedCount: number;
    paidCount: number;
    paidAmount: number;
    totalAmount: number;
    totalCount: number;
  };
}

const formatCurrency = (value: number) => {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
};

export function PaymentQueueKPIs({ kpis }: PaymentQueueKPIsProps) {
  const cards = [
    {
      title: "Pendentes",
      value: kpis.pendingCount,
      subtitle: formatCurrency(kpis.pendingAmount),
      icon: Clock,
      color: "text-amber-500",
      bgColor: "bg-amber-500/10",
      borderColor: "border-amber-500/30",
    },
    {
      title: "Aceitos",
      value: kpis.acceptedCount,
      subtitle: formatCurrency(kpis.acceptedAmount),
      icon: CheckCircle2,
      color: "text-emerald-500",
      bgColor: "bg-emerald-500/10",
      borderColor: "border-emerald-500/30",
    },
    {
      title: "Rejeitados",
      value: kpis.rejectedCount,
      subtitle: "itens",
      icon: XCircle,
      color: "text-red-500",
      bgColor: "bg-red-500/10",
      borderColor: "border-red-500/30",
    },
    {
      title: "Pagos",
      value: kpis.paidCount,
      subtitle: formatCurrency(kpis.paidAmount),
      icon: Wallet,
      color: "text-blue-500",
      bgColor: "bg-blue-500/10",
      borderColor: "border-blue-500/30",
    },
    {
      title: "Total Geral",
      value: formatCurrency(kpis.totalAmount),
      subtitle: `${kpis.totalCount} solicitações`,
      icon: DollarSign,
      color: "text-primary",
      bgColor: "bg-primary/10",
      borderColor: "border-primary/30",
      isLarge: true,
    },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
      {cards.map((card) => (
        <Card key={card.title} className={cn("border", card.borderColor)}>
          <CardContent className="p-4">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm text-muted-foreground">{card.title}</p>
                <p className={cn("text-2xl font-bold mt-1", card.isLarge ? "" : card.color)}>
                  {card.value}
                </p>
                <p className="text-xs text-muted-foreground mt-1">{card.subtitle}</p>
              </div>
              <div className={cn("p-2 rounded-lg", card.bgColor)}>
                <card.icon className={cn("h-5 w-5", card.color)} />
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
