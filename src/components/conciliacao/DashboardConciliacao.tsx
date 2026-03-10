import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CheckCircle, Clock, AlertTriangle, ArrowUpDown } from "lucide-react";

interface DashboardProps {
  conciliacoes: any[];
  history: any[];
}

export function DashboardConciliacao({ conciliacoes, history }: DashboardProps) {
  const conciliados = conciliacoes.filter((c) => c.status_conciliacao === "conciliado").length;
  const pendentes = conciliacoes.filter((c) => c.status_conciliacao === "pendente").length;
  const divergentes = conciliacoes.filter((c) => c.status_conciliacao === "divergente").length;
  const total = conciliacoes.length;
  const lastSync = history[0];

  const cards = [
    {
      title: "Total Transações",
      value: total,
      icon: ArrowUpDown,
      color: "text-foreground",
      bg: "bg-muted/50",
    },
    {
      title: "Conciliados",
      value: conciliados,
      icon: CheckCircle,
      color: "text-green-600",
      bg: "bg-green-50 dark:bg-green-900/20",
    },
    {
      title: "Pendentes",
      value: pendentes,
      icon: Clock,
      color: "text-yellow-600",
      bg: "bg-yellow-50 dark:bg-yellow-900/20",
    },
    {
      title: "Divergentes",
      value: divergentes,
      icon: AlertTriangle,
      color: "text-red-600",
      bg: "bg-red-50 dark:bg-red-900/20",
    },
  ];

  return (
    <div className="space-y-4">
      <div className="grid gap-4 md:grid-cols-4">
        {cards.map((card) => (
          <Card key={card.title} className={card.bg}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">{card.title}</CardTitle>
              <card.icon className={`h-4 w-4 ${card.color}`} />
            </CardHeader>
            <CardContent>
              <div className={`text-2xl font-bold ${card.color}`}>{card.value}</div>
              {total > 0 && (
                <p className="text-xs text-muted-foreground mt-1">
                  {((card.value / total) * 100).toFixed(1)}% do total
                </p>
              )}
            </CardContent>
          </Card>
        ))}
      </div>
      {lastSync && (
        <p className="text-xs text-muted-foreground">
          Última sincronização: {new Date(lastSync.created_at).toLocaleString("pt-BR")} —{" "}
          {lastSync.duracao_ms ? `${(lastSync.duracao_ms / 1000).toFixed(1)}s` : ""}
        </p>
      )}
    </div>
  );
}
