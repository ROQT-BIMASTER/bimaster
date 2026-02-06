import { Card, CardContent } from "@/components/ui/card";
import { MarketKPIs } from "@/hooks/useMarketCoverage";
import {
  Globe,
  MapPin,
  Users,
  Target,
  TrendingUp,
  Building2,
  Pickaxe,
  BarChart3,
} from "lucide-react";

interface MarketKPICardsProps {
  kpis: MarketKPIs;
  isLoading: boolean;
}

const formatNumber = (n: number) =>
  new Intl.NumberFormat("pt-BR").format(n);

const formatPopulation = (n: number) => {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)} mi`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(0)} mil`;
  return formatNumber(n);
};

export function MarketKPICards({ kpis, isLoading }: MarketKPICardsProps) {
  const cards = [
    {
      title: "Penetração Nacional",
      value: `${kpis.penetracaoNacional}%`,
      subtitle: `${formatNumber(kpis.municipiosAtendidos)} de ${formatNumber(kpis.totalMunicipios)} municípios`,
      icon: Target,
      color: "text-blue-600 dark:text-blue-400",
      bg: "bg-blue-100 dark:bg-blue-900/50",
      border: "border-l-blue-500",
    },
    {
      title: "UFs Atendidas",
      value: `${kpis.ufsAtendidas}/${kpis.totalUFs}`,
      subtitle: `Estados com clientes ativos`,
      icon: Globe,
      color: "text-emerald-600 dark:text-emerald-400",
      bg: "bg-emerald-100 dark:bg-emerald-900/50",
      border: "border-l-emerald-500",
    },
    {
      title: "Clientes ERP",
      value: formatNumber(kpis.totalClientesERP),
      subtitle: `Em ${formatNumber(kpis.municipiosAtendidos)} cidades`,
      icon: Building2,
      color: "text-violet-600 dark:text-violet-400",
      bg: "bg-violet-100 dark:bg-violet-900/50",
      border: "border-l-violet-500",
    },
    {
      title: "Prospects Ativos",
      value: formatNumber(kpis.totalProspects),
      subtitle: `Em ${formatNumber(kpis.municipiosProspectados)} municípios`,
      icon: Users,
      color: "text-amber-600 dark:text-amber-400",
      bg: "bg-amber-100 dark:bg-amber-900/50",
      border: "border-l-amber-500",
    },
    {
      title: "Leads Minerados",
      value: formatNumber(kpis.totalLeads),
      subtitle: `Em ${formatNumber(kpis.municipiosMinerados)} cidades`,
      icon: Pickaxe,
      color: "text-orange-600 dark:text-orange-400",
      bg: "bg-orange-100 dark:bg-orange-900/50",
      border: "border-l-orange-500",
    },
    {
      title: "População Alcançada",
      value: formatPopulation(kpis.populacaoAtendida),
      subtitle: `de ${formatPopulation(kpis.populacaoTotal)} total`,
      icon: BarChart3,
      color: "text-rose-600 dark:text-rose-400",
      bg: "bg-rose-100 dark:bg-rose-900/50",
      border: "border-l-rose-500",
    },
  ];

  if (isLoading) {
    return (
      <div className="grid gap-4 grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        {Array.from({ length: 6 }).map((_, i) => (
          <Card key={i} className="animate-pulse">
            <CardContent className="p-4">
              <div className="h-16 bg-muted rounded" />
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  return (
    <div className="grid gap-4 grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
      {cards.map((card) => (
        <Card
          key={card.title}
          className={`border-l-4 ${card.border} hover:shadow-lg transition-shadow`}
        >
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <div className={`p-1.5 rounded-lg ${card.bg}`}>
                <card.icon className={`h-4 w-4 ${card.color}`} />
              </div>
            </div>
            <p className={`text-2xl font-bold ${card.color}`}>{card.value}</p>
            <p className="text-xs font-medium text-foreground mt-1">{card.title}</p>
            <p className="text-xs text-muted-foreground mt-0.5">{card.subtitle}</p>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
