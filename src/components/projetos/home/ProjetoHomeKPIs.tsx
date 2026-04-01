import { KpiCard } from "@/components/ui/kpi-card";
import { ListTodo, AlertTriangle, CheckCircle2, TrendingUp } from "lucide-react";
import { MinaTarefa } from "@/hooks/useMinhasTarefas";
import { startOfWeek, endOfWeek, isWithinInterval } from "date-fns";

interface Props {
  tarefas: MinaTarefa[];
  loading?: boolean;
}

export function ProjetoHomeKPIs({ tarefas, loading }: Props) {
  const now = new Date();
  const pendentes = tarefas.filter(t => t.status !== "concluida");
  const atrasadas = pendentes.filter(t => t.data_prazo && new Date(t.data_prazo) < now);
  const concluidasHoje = tarefas.filter(
    t => t.status === "concluida" && t.data_conclusao && new Date(t.data_conclusao).toDateString() === now.toDateString()
  );

  // Weekly productivity
  const weekStart = startOfWeek(now, { weekStartsOn: 1 });
  const weekEnd = endOfWeek(now, { weekStartsOn: 1 });
  const semana = tarefas.filter(t => {
    if (!t.data_prazo && !t.data_conclusao) return false;
    const ref = t.data_conclusao ? new Date(t.data_conclusao) : new Date(t.data_prazo!);
    return isWithinInterval(ref, { start: weekStart, end: weekEnd });
  });
  const semanaConcluidas = semana.filter(t => t.status === "concluida").length;
  const produtividade = semana.length > 0 ? Math.round((semanaConcluidas / semana.length) * 100) : 0;

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
      <KpiCard
        title="Pendentes"
        value={pendentes.length}
        icon={ListTodo}
        variant="info"
        loading={loading}
      />
      <KpiCard
        title="Atrasadas"
        value={atrasadas.length}
        icon={AlertTriangle}
        variant="destructive"
        loading={loading}
      />
      <KpiCard
        title="Concluídas hoje"
        value={concluidasHoje.length}
        icon={CheckCircle2}
        variant="success"
        loading={loading}
      />
      <KpiCard
        title="Produtividade semanal"
        value={`${produtividade}%`}
        subtitle={`${semanaConcluidas} de ${semana.length} tarefas`}
        icon={TrendingUp}
        variant="warning"
        loading={loading}
      />
    </div>
  );
}
