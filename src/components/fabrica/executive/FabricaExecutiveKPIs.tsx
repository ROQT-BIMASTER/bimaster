import { KpiCard } from "@/components/ui/kpi-card";
import {
  Factory,
  Package,
  Layers,
  ClipboardList,
  DollarSign,
  Percent,
  AlertTriangle,
  TableIcon,
} from "lucide-react";
import type { FabricaKPIs } from "@/hooks/useFabricaExecutiveDashboard";

interface Props {
  kpis: FabricaKPIs | undefined;
  isLoading: boolean;
}

export function FabricaExecutiveKPIs({ kpis, isLoading }: Props) {
  const formatCurrency = (value: number) =>
    new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);

  const cards = [
    { title: "Produtos Ativos", value: kpis?.totalProdutos ?? 0, subtitle: "Produtos acabados", icon: Factory, variant: "info" as const },
    { title: "Matérias-Primas", value: kpis?.totalMPs ?? 0, subtitle: "MPs ativas", icon: Package, variant: "warning" as const },
    { title: "Fórmulas BOM", value: kpis?.formulasAtivas ?? 0, subtitle: "Fórmulas ativas", icon: Layers, variant: "accent" as const },
    { title: "OPs em Andamento", value: kpis?.opsAtivas ?? 0, subtitle: "Ordens de produção", icon: ClipboardList, variant: "warning" as const },
    { title: "Custo Médio", value: formatCurrency(kpis?.custoMedioProducao ?? 0), subtitle: "Por produto", icon: DollarSign, variant: "success" as const },
    { title: "Margem Média", value: `${(kpis?.margemMediaGeral ?? 0).toFixed(1)}%`, subtitle: (kpis?.margemMediaGeral ?? 0) >= 25 ? "Saudável" : (kpis?.margemMediaGeral ?? 0) >= 15 ? "Moderada" : "Crítica", icon: Percent, variant: ((kpis?.margemMediaGeral ?? 0) >= 25 ? "success" : (kpis?.margemMediaGeral ?? 0) >= 15 ? "warning" : "destructive") as any },
    { title: "Margem Crítica", value: kpis?.produtosCriticos ?? 0, subtitle: 'Produtos < 10% margem', icon: AlertTriangle, variant: ((kpis?.produtosCriticos ?? 0) > 0 ? "destructive" : "success") as any },
    { title: "Tabelas de Preço", value: kpis?.tabelasAtivas ?? 0, subtitle: "Tabelas ativas", icon: TableIcon, variant: "accent" as const },
  ];

  return (
    <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
      {cards.map((card) => (
        <KpiCard
          key={card.title}
          title={card.title}
          value={card.value}
          subtitle={card.subtitle}
          icon={card.icon}
          variant={card.variant}
          loading={isLoading || !kpis}
        />
      ))}
    </div>
  );
}
