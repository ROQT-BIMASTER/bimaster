import { useMemo } from "react";
import { KpiCard } from "@/components/ui/kpi-card";
import { CheckCircle2, AlertTriangle, Clock, TrendingUp } from "lucide-react";
import { isToday, startOfWeek, isWithinInterval, endOfWeek, startOfDay } from "date-fns";
import type { MinaTarefa } from "@/hooks/useMinhasTarefas";

interface Props {
  tarefas: MinaTarefa[];
  loading?: boolean;
}

export function MinhasTarefasKPIs({ tarefas, loading }: Props) {
  const metrics = useMemo(() => {
    const now = startOfDay(new Date());
    const weekStart = startOfWeek(now, { weekStartsOn: 1 });
    const weekEnd = endOfWeek(now, { weekStartsOn: 1 });

    const pendentes = tarefas.filter(t => t.status !== "concluida");
    const atrasadas = pendentes.filter(t => t.data_prazo && startOfDay(new Date(t.data_prazo)) < now);
    const concluidasHoje = tarefas.filter(t => t.status === "concluida" && t.data_conclusao && isToday(new Date(t.data_conclusao)));
    
    const tarefasSemana = tarefas.filter(t => {
      if (!t.data_prazo) return false;
      const d = startOfDay(new Date(t.data_prazo));
      return isWithinInterval(d, { start: weekStart, end: weekEnd });
    });
    const concluidasSemana = tarefasSemana.filter(t => t.status === "concluida");
    const produtividade = tarefasSemana.length > 0 
      ? Math.round((concluidasSemana.length / tarefasSemana.length) * 100) 
      : 0;

    return {
      pendentes: pendentes.length,
      atrasadas: atrasadas.length,
      concluidasHoje: concluidasHoje.length,
      produtividade,
      concluidasSemana: concluidasSemana.length,
      totalSemana: tarefasSemana.length,
    };
  }, [tarefas]);

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
      <KpiCard
        title="Pendentes"
        value={metrics.pendentes}
        icon={Clock}
        variant="info"
        subtitle="tarefas ativas"
        loading={loading}
      />
      <KpiCard
        title="Atrasadas"
        value={metrics.atrasadas}
        icon={AlertTriangle}
        variant={metrics.atrasadas > 0 ? "destructive" : "default"}
        subtitle="precisam de atenção"
        loading={loading}
      />
      <KpiCard
        title="Concluídas hoje"
        value={metrics.concluidasHoje}
        icon={CheckCircle2}
        variant="success"
        subtitle="bom trabalho!"
        loading={loading}
      />
      <KpiCard
        title="Produtividade semanal"
        value={`${metrics.produtividade}%`}
        icon={TrendingUp}
        variant={metrics.produtividade >= 70 ? "success" : metrics.produtividade >= 40 ? "warning" : "destructive"}
        subtitle={`${metrics.concluidasSemana} de ${metrics.totalSemana} esta semana`}
        loading={loading}
      />
    </div>
  );
}
