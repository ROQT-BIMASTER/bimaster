import { KpiCard } from "@/components/ui/kpi-card";
import { Clock, CheckCircle2, XCircle, Wallet, DollarSign } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { formatCurrency } from "@/lib/formatters";

interface PaymentQueueKPIsProps {
  kpis: {
    pendingCount: number;
    pendingAmount: number;
    acceptedCount: number;
    acceptedAmount: number;
    rejectedCount: number;
    rejectedAmount: number;
    paidCount: number;
    paidAmount: number;
    totalAmount: number;
    totalCount: number;
  };
}

const formatCurrencyNoDecimals = (value: number) => formatCurrency(value, false);

export function PaymentQueueKPIs({ kpis }: PaymentQueueKPIsProps) {
  const { t } = useLanguage();

  const cards = [
    { title: t("pq.pending"), value: kpis.pendingCount, subtitle: formatCurrencyNoDecimals(kpis.pendingAmount), icon: Clock, variant: "warning" as const },
    { title: t("pq.accepted"), value: kpis.acceptedCount, subtitle: formatCurrencyNoDecimals(kpis.acceptedAmount), icon: CheckCircle2, variant: "success" as const },
    { title: t("pq.rejected"), value: kpis.rejectedCount, subtitle: formatCurrencyNoDecimals(kpis.rejectedAmount), icon: XCircle, variant: "destructive" as const },
    { title: t("pq.paid"), value: kpis.paidCount, subtitle: formatCurrencyNoDecimals(kpis.paidAmount), icon: Wallet, variant: "info" as const },
    { title: t("pq.total"), value: formatCurrencyNoDecimals(kpis.totalAmount), subtitle: `${kpis.totalCount} ${t("pq.requests")}`, icon: DollarSign, variant: "default" as const },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
      {cards.map((card) => (
        <KpiCard
          key={card.title}
          title={card.title}
          value={card.value}
          subtitle={card.subtitle}
          icon={card.icon}
          variant={card.variant}
        />
      ))}
    </div>
  );
}
