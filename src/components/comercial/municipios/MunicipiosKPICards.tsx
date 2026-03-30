import { KpiCard } from "@/components/ui/kpi-card";
import { Building2, Users, TrendingUp, BarChart3, Globe } from "lucide-react";
import { MunicipiosKPIs } from "@/hooks/useMunicipiosIntelligence";

interface MunicipiosKPICardsProps {
  kpis: MunicipiosKPIs | undefined;
  loading: boolean;
}

function formatNumber(n: number): string {
  if (n >= 1_000_000_000) return `${(n / 1_000_000_000).toFixed(1)}B`;
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toLocaleString("pt-BR");
}

const cards = [
  { key: "total_municipios", title: "Total de Municípios", icon: Building2, variant: "info" as const, format: (v: number) => formatNumber(v) },
  { key: "municipios_atendidos", title: "Municípios Atendidos", icon: Users, variant: "success" as const, format: (v: number) => formatNumber(v) },
  { key: "taxa_penetracao", title: "Taxa de Penetração", icon: TrendingUp, variant: "warning" as const, format: (v: number) => `${v.toFixed(1)}%` },
  { key: "densidade_media", title: "Densidade Comercial Média", icon: BarChart3, variant: "accent" as const, format: (v: number) => `${v.toFixed(2)} / 10K hab`, subtitle: "Clientes por 10 mil habitantes" },
  { key: "pib_total", title: "PIB Total Filtrado", icon: Globe, variant: "info" as const, format: (v: number) => `R$ ${formatNumber(v * 1000)}`, subtitle: "em milhares de reais" },
];

export function MunicipiosKPICards({ kpis, loading }: MunicipiosKPICardsProps) {
  return (
    <div className="grid gap-4 grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
      {cards.map((card) => {
        const value = kpis ? (kpis as any)[card.key] : 0;
        return (
          <KpiCard
            key={card.key}
            title={card.title}
            value={card.format(value)}
            subtitle={card.subtitle}
            icon={card.icon}
            variant={card.variant}
            loading={loading}
          />
        );
      })}
    </div>
  );
}
