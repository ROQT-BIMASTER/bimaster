import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Building2, Users, TrendingUp, DollarSign, BarChart3, Globe } from "lucide-react";
import { MunicipiosKPIs } from "@/hooks/useMunicipiosIntelligence";

interface MunicipiosKPICardsProps {
  kpis: MunicipiosKPIs | undefined;
  loading: boolean;
}

function formatNumber(n: number): string {
  if (n >= 1_000_000_000) return `${(n / 1_000_000_000).toFixed(1)}B`;
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toLocaleString('pt-BR');
}

function formatCurrency(n: number): string {
  if (n >= 1_000_000) return `R$ ${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `R$ ${(n / 1_000).toFixed(0)}K`;
  return `R$ ${n.toLocaleString('pt-BR', { minimumFractionDigits: 0 })}`;
}

const cards = [
  {
    key: 'total_municipios',
    title: 'Total de Municípios',
    icon: Building2,
    color: 'text-blue-600 dark:text-blue-400',
    bgColor: 'bg-blue-100 dark:bg-blue-900/50',
    borderColor: 'border-l-blue-500',
    format: (v: number) => formatNumber(v),
  },
  {
    key: 'municipios_atendidos',
    title: 'Municípios Atendidos',
    icon: Users,
    color: 'text-green-600 dark:text-green-400',
    bgColor: 'bg-green-100 dark:bg-green-900/50',
    borderColor: 'border-l-green-500',
    format: (v: number) => formatNumber(v),
  },
  {
    key: 'taxa_penetracao',
    title: 'Taxa de Penetração',
    icon: TrendingUp,
    color: 'text-amber-600 dark:text-amber-400',
    bgColor: 'bg-amber-100 dark:bg-amber-900/50',
    borderColor: 'border-l-amber-500',
    format: (v: number) => `${v.toFixed(1)}%`,
  },
  {
    key: 'densidade_media',
    title: 'Densidade Comercial Média',
    icon: BarChart3,
    color: 'text-purple-600 dark:text-purple-400',
    bgColor: 'bg-purple-100 dark:bg-purple-900/50',
    borderColor: 'border-l-purple-500',
    format: (v: number) => `${v.toFixed(2)} / 10K hab`,
    subtitle: 'Clientes por 10 mil habitantes',
  },
  {
    key: 'pib_total',
    title: 'PIB Total Filtrado',
    icon: Globe,
    color: 'text-indigo-600 dark:text-indigo-400',
    bgColor: 'bg-indigo-100 dark:bg-indigo-900/50',
    borderColor: 'border-l-indigo-500',
    format: (v: number) => `R$ ${formatNumber(v * 1000)}`,
    subtitle: 'em milhares de reais',
  },
];

export function MunicipiosKPICards({ kpis, loading }: MunicipiosKPICardsProps) {
  if (loading) {
    return (
      <div className="grid gap-4 grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
        {Array.from({ length: 5 }).map((_, i) => (
          <Card key={i} className="border-l-4">
            <CardContent className="p-4">
              <Skeleton className="h-4 w-20 mb-3" />
              <Skeleton className="h-8 w-24 mb-1" />
              <Skeleton className="h-3 w-16" />
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  return (
    <div className="grid gap-4 grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
      {cards.map(card => {
        const value = kpis ? (kpis as any)[card.key] : 0;
        const Icon = card.icon;
        return (
          <Card key={card.key} className={`${card.borderColor} border-l-4`}>
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-2">
                <div className={`p-1.5 rounded-lg ${card.bgColor}`}>
                  <Icon className={`h-4 w-4 ${card.color}`} />
                </div>
              </div>
              <p className={`text-2xl font-bold ${card.color}`}>
                {card.format(value)}
              </p>
              <p className="text-xs text-muted-foreground mt-1">{card.title}</p>
              {card.subtitle && (
                <p className="text-[10px] text-muted-foreground/70">{card.subtitle}</p>
              )}
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
