import { useMemo } from "react";
import { KpiCard } from "@/components/ui/kpi-card";
import {
  ListTodo,
  AlertTriangle,
  CalendarDays,
  Bell,
  CheckCircle2,
  TrendingUp,
  Clock,
  Inbox,
} from "lucide-react";
import { useMinhasTarefas } from "@/hooks/useMinhasTarefas";
import { useProjetoAtividades } from "@/hooks/useProjetoAtividades";
import {
  isToday,
  isBefore,
  startOfDay,
  startOfWeek,
  endOfWeek,
  isWithinInterval,
} from "date-fns";

type TabKey = "hoje" | "tarefas" | "inbox";

interface Props {
  activeTab?: TabKey;
  onNavigate: (tab: TabKey, filter?: string, extras?: { sort?: string }) => void;
}

/**
 * Contextual KPI strip for the Central de Trabalho.
 *
 * Each tab shows a different lens on the same dataset to avoid duplicating
 * information with the tab-specific content below.
 */
export function CentralKPIs({ activeTab = "hoje", onNavigate }: Props) {
  const { data: tarefas = [], isLoading } = useMinhasTarefas();
  const { naoLidas } = useProjetoAtividades();

  const metrics = useMemo(() => {
    const now = startOfDay(new Date());
    const weekStart = startOfWeek(now, { weekStartsOn: 1 });
    const weekEnd = endOfWeek(now, { weekStartsOn: 1 });

    const pendentes = tarefas.filter((t) => t.status !== "concluida");
    const hoje = pendentes.filter(
      (t) => t.data_prazo && isToday(new Date(t.data_prazo)),
    );
    const atrasadas = pendentes.filter(
      (t) =>
        t.data_prazo && isBefore(startOfDay(new Date(t.data_prazo)), now),
    );
    const concluidasHoje = tarefas.filter(
      (t) =>
        t.status === "concluida" &&
        t.data_conclusao &&
        isToday(new Date(t.data_conclusao)),
    );

    const tarefasSemana = tarefas.filter((t) => {
      if (!t.data_prazo) return false;
      const d = startOfDay(new Date(t.data_prazo));
      return isWithinInterval(d, { start: weekStart, end: weekEnd });
    });
    const concluidasSemana = tarefasSemana.filter(
      (t) => t.status === "concluida",
    );
    const produtividade =
      tarefasSemana.length > 0
        ? Math.round((concluidasSemana.length / tarefasSemana.length) * 100)
        : 0;

    return {
      pendentes: pendentes.length,
      hoje: hoje.length,
      atrasadas: atrasadas.length,
      concluidasHoje: concluidasHoje.length,
      produtividade,
      concluidasSemana: concluidasSemana.length,
      totalSemana: tarefasSemana.length,
    };
  }, [tarefas]);

  if (activeTab === "hoje") {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <KpiCard
          title="Para hoje"
          value={metrics.hoje}
          icon={CalendarDays}
          variant="info"
          subtitle="com prazo hoje"
          loading={isLoading}
          onClick={() => onNavigate("tarefas", "hoje")}
        />
        <KpiCard
          title="Atrasadas"
          value={metrics.atrasadas}
          icon={AlertTriangle}
          variant={metrics.atrasadas > 0 ? "destructive" : "default"}
          subtitle="por urgência e prazo"
          loading={isLoading}
          onClick={() => onNavigate("tarefas", "atrasadas", { sort: "urgent" })}
        />
        <KpiCard
          title="Concluídas hoje"
          value={metrics.concluidasHoje}
          icon={CheckCircle2}
          variant="success"
          subtitle="bom trabalho"
          loading={isLoading}
        />
        <KpiCard
          title="Não lidas"
          value={naoLidas}
          icon={Bell}
          variant="warning"
          subtitle="notificações"
          onClick={() => onNavigate("inbox")}
        />
      </div>
    );
  }

  if (activeTab === "tarefas") {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <KpiCard
          title="Pendentes"
          value={metrics.pendentes}
          icon={ListTodo}
          variant="info"
          subtitle="tarefas ativas"
          loading={isLoading}
        />
        <KpiCard
          title="Para hoje"
          value={metrics.hoje}
          icon={CalendarDays}
          variant="info"
          subtitle="com prazo hoje"
          loading={isLoading}
          onClick={() => onNavigate("tarefas", "hoje")}
        />
        <KpiCard
          title="Atrasadas"
          value={metrics.atrasadas}
          icon={AlertTriangle}
          variant={metrics.atrasadas > 0 ? "destructive" : "default"}
          subtitle="por urgência e prazo"
          loading={isLoading}
          onClick={() => onNavigate("tarefas", "atrasadas", { sort: "urgent" })}
        />
        <KpiCard
          title="Concluídas hoje"
          value={metrics.concluidasHoje}
          icon={CheckCircle2}
          variant="success"
          subtitle="bom trabalho"
          loading={isLoading}
        />
      </div>
    );
  }

  // inbox
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
      <KpiCard
        title="Não lidas"
        value={naoLidas}
        icon={Inbox}
        variant="warning"
        subtitle="notificações"
      />
      <KpiCard
        title="Para hoje"
        value={metrics.hoje}
        icon={Clock}
        variant="info"
        subtitle="com prazo hoje"
        loading={isLoading}
        onClick={() => onNavigate("tarefas", "hoje")}
      />
      <KpiCard
        title="Atrasadas"
        value={metrics.atrasadas}
        icon={AlertTriangle}
        variant={metrics.atrasadas > 0 ? "destructive" : "default"}
        subtitle="por urgência e prazo"
        loading={isLoading}
        onClick={() => onNavigate("tarefas", "atrasadas", { sort: "urgent" })}
      />
      <KpiCard
        title="Pendentes"
        value={metrics.pendentes}
        icon={ListTodo}
        variant="default"
        subtitle="tarefas ativas"
        loading={isLoading}
        onClick={() => onNavigate("tarefas")}
      />
    </div>
  );
}
