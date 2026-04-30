import { KpiCard } from "@/components/ui/kpi-card";
import { ListTodo, AlertTriangle, CheckCircle2, TrendingUp } from "lucide-react";
import { MinaTarefa } from "@/hooks/useMinhasTarefas";
import { startOfWeek, endOfWeek, isWithinInterval, isSameDay } from "date-fns";
import { parseLocalDate } from "@/lib/utils/parseLocalDate";

interface Props {
  tarefas: MinaTarefa[];
  loading?: boolean;
}

export function ProjetoHomeKPIs({ tarefas, loading }: Props) {
  const now = new Date();
  const pendentes = tarefas.filter(t => t.status !== "concluida");
  const atrasadas = pendentes.filter(t => {
    const d = parseLocalDate(t.data_prazo);
    return d ? d < now : false;
  });
  const concluidasHoje = tarefas.filter(t => {
    if (t.status !== "concluida") return false;
    const d = parseLocalDate(t.data_conclusao);
    return d ? isSameDay(d, now) : false;
  });

  // Weekly productivity
  const weekStart = startOfWeek(now, { weekStartsOn: 1 });
  const weekEnd = endOfWeek(now, { weekStartsOn: 1 });
  const semana = tarefas.filter(t => {
    if (!t.data_prazo && !t.data_conclusao) return false;
    const ref = parseLocalDate(t.data_conclusao) ?? parseLocalDate(t.data_prazo);
    return ref ? isWithinInterval(ref, { start: weekStart, end: weekEnd }) : false;
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
