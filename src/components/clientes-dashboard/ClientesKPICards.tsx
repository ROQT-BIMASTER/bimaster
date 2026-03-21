import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Users, UserCheck, UserX, RefreshCcw, TrendingDown } from "lucide-react";

interface KPIs {
  totalCadastrados: number;
  clientesAtivos: number;
  clientesInativos: number;
  taxaRecompra: number;
  churnRate: number;
}

interface Props {
  data: KPIs | null;
  isLoading: boolean;
}

const fmt = (n: number) => n.toLocaleString("pt-BR", { maximumFractionDigits: 0 });
const fmtPct = (n: number) => n.toLocaleString("pt-BR", { maximumFractionDigits: 1 }) + "%";

export function ClientesKPICards({ data, isLoading }: Props) {
  if (isLoading) {
    return (
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        {Array.from({ length: 5 }).map((_, i) => (
          <Card key={i}><CardContent className="p-4"><Skeleton className="h-16 w-full" /></CardContent></Card>
        ))}
      </div>
    );
  }

  const cards = [
    { title: "Total Cadastrados", value: fmt(data?.totalCadastrados || 0), icon: Users, color: "text-blue-600 dark:text-blue-400", bg: "bg-blue-50 dark:bg-blue-900/20" },
    { title: "Clientes Ativos", value: fmt(data?.clientesAtivos || 0), icon: UserCheck, color: "text-emerald-600 dark:text-emerald-400", bg: "bg-emerald-50 dark:bg-emerald-900/20" },
    { title: "Clientes Inativos", value: fmt(data?.clientesInativos || 0), icon: UserX, color: "text-red-600 dark:text-red-400", bg: "bg-red-50 dark:bg-red-900/20" },
    { title: "Taxa de Recompra", value: fmtPct(data?.taxaRecompra || 0), icon: RefreshCcw, color: "text-amber-600 dark:text-amber-400", bg: "bg-amber-50 dark:bg-amber-900/20" },
    { title: "Churn Rate", value: fmtPct(data?.churnRate || 0), icon: TrendingDown, color: "text-rose-600 dark:text-rose-400", bg: "bg-rose-50 dark:bg-rose-900/20" },
  ];

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
      {cards.map((c) => (
        <Card key={c.title} className="shadow-sm">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className={`flex items-center justify-center h-10 w-10 rounded-lg ${c.bg}`}>
                <c.icon className={`h-5 w-5 ${c.color}`} />
              </div>
              <div>
                <p className="text-xs font-medium text-muted-foreground">{c.title}</p>
                <p className="text-xl font-bold">{c.value}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
