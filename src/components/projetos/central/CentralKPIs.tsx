import { useMemo } from "react";
import { KpiCard } from "@/components/ui/kpi-card";
import {
  ListTodo,
  AlertTriangle,
  CalendarDays,
  Bell,
  CheckCircle2,
  Clock,
  Inbox,
  CalendarOff,
} from "lucide-react";
import { useMinhasTarefas } from "@/hooks/useMinhasTarefas";
import { useProjetoAtividades } from "@/hooks/useProjetoAtividades";
import { isToday, isBefore, startOfDay } from "date-fns";
import { parseLocalDate } from "@/lib/utils/parseLocalDate";

type TabKey = "hoje" | "tarefas" | "delegadas" | "inbox";

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

    const pendentes = tarefas.filter((t) => t.status !== "concluida");
    const hoje = pendentes.filter((t) => {
      const p = parseLocalDate(t.data_prazo);
      return p && isToday(p);
    });
    const atrasadas = pendentes.filter((t) => {
      const p = parseLocalDate(t.data_prazo);
      return p && isBefore(startOfDay(p), now);
    });
    const semPrazo = pendentes.filter((t) => !t.data_prazo);
    const concluidasHoje = tarefas.filter((t) => {
      if (t.status !== "concluida") return false;
      const c = parseLocalDate(t.data_conclusao);
      return c && isToday(c);
    });

    const splitByRole = (list: typeof tarefas) => ({
      responsavel: list.filter((t) => t.papel === "responsavel").length,
      colaborador: list.filter((t) => t.papel === "colaborador").length,
    });

    return {
      pendentes: pendentes.length,
      hoje: hoje.length,
      atrasadas: atrasadas.length,
      semPrazo: semPrazo.length,
      concluidasHoje: concluidasHoje.length,
      hojeSplit: splitByRole(hoje),
      pendentesSplit: splitByRole(pendentes),
    };
  }, [tarefas]);

  const roleSubtitle = (s: { responsavel: number; colaborador: number }, base: string) => {
    if (s.responsavel === 0 || s.colaborador === 0) return base;
    return `${s.responsavel} suas · ${s.colaborador} colaborando`;
  };

  if (activeTab === "hoje") {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <KpiCard
          title="Para hoje"
          value={metrics.hoje}
          icon={CalendarDays}
          variant="info"
          subtitle={roleSubtitle(metrics.hojeSplit, "com prazo hoje")}
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
          title="Sem prazo"
          value={metrics.semPrazo}
          icon={CalendarOff}
          variant={metrics.semPrazo > 0 ? "warning" : "default"}
          subtitle="defina início e prazo"
          loading={isLoading}
          onClick={() => onNavigate("tarefas", "sem_data")}
          className={metrics.semPrazo > 0 ? "animate-pulse-slow" : undefined}
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
          title="Sem prazo"
          value={metrics.semPrazo}
          icon={CalendarOff}
          variant={metrics.semPrazo > 0 ? "warning" : "default"}
          subtitle="defina início e prazo"
          loading={isLoading}
          onClick={() => onNavigate("tarefas", "sem_data")}
          className={metrics.semPrazo > 0 ? "animate-pulse-slow" : undefined}
        />
        <KpiCard
          title="Para hoje"
          value={metrics.hoje}
          icon={CalendarDays}
          variant="info"
          subtitle={roleSubtitle(metrics.hojeSplit, "com prazo hoje")}
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
        subtitle={roleSubtitle(metrics.hojeSplit, "com prazo hoje")}
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
        subtitle={roleSubtitle(metrics.pendentesSplit, "tarefas ativas")}
        loading={isLoading}
        onClick={() => onNavigate("tarefas")}
      />
    </div>
  );
}
