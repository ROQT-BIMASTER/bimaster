import { KpiCard } from "@/components/ui/kpi-card";
import { ListTodo, AlertTriangle, CalendarDays, Bell } from "lucide-react";
import { useMinhasTarefas } from "@/hooks/useMinhasTarefas";
import { useProjetoAtividades } from "@/hooks/useProjetoAtividades";
import { isToday, isBefore, startOfDay } from "date-fns";

interface Props {
  onNavigate: (tab: "hoje" | "tarefas" | "inbox", filter?: string) => void;
}

export function CentralKPIs({ onNavigate }: Props) {
  const { data: tarefas = [], isLoading } = useMinhasTarefas();
  const { naoLidas } = useProjetoAtividades();

  const now = startOfDay(new Date());
  const pendentes = tarefas.filter(t => t.status !== "concluida");
  const hoje = pendentes.filter(t => t.data_prazo && isToday(new Date(t.data_prazo)));
  const atrasadas = pendentes.filter(
    t => t.data_prazo && isBefore(startOfDay(new Date(t.data_prazo)), now)
  );

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
      <KpiCard
        title="Total pendentes"
        value={pendentes.length}
        icon={ListTodo}
        variant="info"
        loading={isLoading}
        onClick={() => onNavigate("tarefas")}
      />
      <KpiCard
        title="Para hoje"
        value={hoje.length}
        icon={CalendarDays}
        variant="success"
        loading={isLoading}
        onClick={() => onNavigate("tarefas", "hoje")}
      />
      <KpiCard
        title="Atrasadas"
        value={atrasadas.length}
        icon={AlertTriangle}
        variant="destructive"
        loading={isLoading}
        onClick={() => onNavigate("tarefas", "atrasadas")}
      />
      <KpiCard
        title="Não lidas"
        value={naoLidas}
        icon={Bell}
        variant="warning"
        onClick={() => onNavigate("inbox")}
      />
    </div>
  );
}
