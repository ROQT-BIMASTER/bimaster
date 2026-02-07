import { Card, CardContent } from "@/components/ui/card";
import { MapPin, DollarSign, Users, Globe, TrendingUp } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import type { WhitespaceKPIs } from "@/hooks/useWhitespaceAnalysis";

interface Props {
  kpis: WhitespaceKPIs | undefined;
  loading: boolean;
}

const formatNumber = (n: number) =>
  new Intl.NumberFormat("pt-BR").format(n);

const formatCurrency = (n: number) => {
  if (n >= 1e9) return `R$ ${(n / 1e6).toFixed(0)} mi`;
  if (n >= 1e6) return `R$ ${(n / 1e6).toFixed(1)} mi`;
  if (n >= 1e3) return `R$ ${(n / 1e3).toFixed(0)} mil`;
  return `R$ ${n.toFixed(0)}`;
};

const cards = [
  {
    key: "municipios",
    label: "Municípios Whitespace",
    icon: MapPin,
    color: "text-blue-600 dark:text-blue-400",
    bg: "bg-blue-100 dark:bg-blue-900/50",
    border: "border-l-blue-500",
    getValue: (k: WhitespaceKPIs) => formatNumber(k.total_municipios_whitespace),
    sub: "Alvos de expansão",
  },
  {
    key: "pib",
    label: "PIB Inexplorado",
    icon: DollarSign,
    color: "text-emerald-600 dark:text-emerald-400",
    bg: "bg-emerald-100 dark:bg-emerald-900/50",
    border: "border-l-emerald-500",
    getValue: (k: WhitespaceKPIs) => formatCurrency(k.pib_total_inexplorado),
    sub: "em mil R$",
  },
  {
    key: "pop",
    label: "População Descoberta",
    icon: Users,
    color: "text-violet-600 dark:text-violet-400",
    bg: "bg-violet-100 dark:bg-violet-900/50",
    border: "border-l-violet-500",
    getValue: (k: WhitespaceKPIs) => formatNumber(k.populacao_total_inexplorada),
    sub: "Potenciais consumidores",
  },
  {
    key: "micro",
    label: "Microrregiões",
    icon: Globe,
    color: "text-amber-600 dark:text-amber-400",
    bg: "bg-amber-100 dark:bg-amber-900/50",
    border: "border-l-amber-500",
    getValue: (k: WhitespaceKPIs) => formatNumber(k.microrregioes_com_oportunidade),
    sub: "Com oportunidade",
  },
  {
    key: "score",
    label: "Score Médio",
    icon: TrendingUp,
    color: "text-rose-600 dark:text-rose-400",
    bg: "bg-rose-100 dark:bg-rose-900/50",
    border: "border-l-rose-500",
    getValue: (k: WhitespaceKPIs) => formatNumber(Math.round(k.score_medio_expansao)),
    sub: "De expansão",
  },
];

export function WhitespaceKPICards({ kpis, loading }: Props) {
  return (
    <div className="grid gap-4 grid-cols-2 lg:grid-cols-5">
      {cards.map((c) => (
        <Card key={c.key} className={`border-l-4 ${c.border}`}>
          <CardContent className="p-4">
            <div className={`p-2 rounded-lg ${c.bg} w-fit mb-3`}>
              <c.icon className={`h-5 w-5 ${c.color}`} />
            </div>
            {loading ? (
              <Skeleton className="h-8 w-24 mb-1" />
            ) : (
              <p className={`text-2xl font-bold ${c.color}`}>
                {kpis ? c.getValue(kpis) : "—"}
              </p>
            )}
            <h3 className="text-xs font-medium text-foreground mt-1">{c.label}</h3>
            <p className="text-[10px] text-muted-foreground">{c.sub}</p>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
