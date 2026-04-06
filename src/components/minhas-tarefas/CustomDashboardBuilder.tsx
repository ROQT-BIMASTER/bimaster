import { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  Plus, Pencil, Trash2, X, Check, GripVertical, LayoutDashboard,
} from "lucide-react";
import { useCustomDashboards, type CustomDashboard } from "@/hooks/useCustomDashboards";
import {
  WIDGET_REGISTRY, getWidgetMeta,
  type WidgetConfig,
} from "./widgets/WidgetRegistry";
import { KpiCard } from "@/components/ui/kpi-card";
import { Clock, AlertTriangle, CheckCircle2, TrendingUp } from "lucide-react";
import { isToday, startOfDay, startOfWeek, endOfWeek, isWithinInterval } from "date-fns";
import type { MinaTarefa } from "@/hooks/useMinhasTarefas";

// Widget renderers
import { WidgetTarefasPorProjeto } from "./widgets/WidgetTarefasPorProjeto";
import { WidgetTarefasPorPrioridade } from "./widgets/WidgetTarefasPorPrioridade";
import { WidgetTarefasPorStatus } from "./widgets/WidgetTarefasPorStatus";
import { WidgetTimelineConclusoes } from "./widgets/WidgetTimelineConclusoes";
import { WidgetListaAtrasadas } from "./widgets/WidgetListaAtrasadas";
import { WidgetListaProximas } from "./widgets/WidgetListaProximas";

interface Props {
  tarefas: MinaTarefa[];
}

function KpiWidget({ type, tarefas }: { type: string; tarefas: MinaTarefa[] }) {
  const now = startOfDay(new Date());
  const weekStart = startOfWeek(now, { weekStartsOn: 1 });
  const weekEnd = endOfWeek(now, { weekStartsOn: 1 });

  const pendentes = tarefas.filter((t) => t.status !== "concluida");
  const atrasadas = pendentes.filter(
    (t) => t.data_prazo && startOfDay(new Date(t.data_prazo)) < now
  );
  const concluidasHoje = tarefas.filter(
    (t) => t.status === "concluida" && t.data_conclusao && isToday(new Date(t.data_conclusao))
  );
  const tarefasSemana = tarefas.filter((t) => {
    if (!t.data_prazo) return false;
    return isWithinInterval(startOfDay(new Date(t.data_prazo)), { start: weekStart, end: weekEnd });
  });
  const concluidasSemana = tarefasSemana.filter((t) => t.status === "concluida");
  const produtividade = tarefasSemana.length > 0
    ? Math.round((concluidasSemana.length / tarefasSemana.length) * 100)
    : 0;

  switch (type) {
    case "kpi_pendentes":
      return <KpiCard title="Pendentes" value={pendentes.length} icon={Clock} variant="info" subtitle="tarefas ativas" />;
    case "kpi_atrasadas":
      return <KpiCard title="Atrasadas" value={atrasadas.length} icon={AlertTriangle} variant={atrasadas.length > 0 ? "destructive" : "default"} subtitle="precisam de atenção" />;
    case "kpi_concluidas_hoje":
      return <KpiCard title="Concluídas hoje" value={concluidasHoje.length} icon={CheckCircle2} variant="success" subtitle="bom trabalho!" />;
    case "kpi_produtividade":
      return <KpiCard title="Produtividade" value={`${produtividade}%`} icon={TrendingUp} variant={produtividade >= 70 ? "success" : produtividade >= 40 ? "warning" : "destructive"} subtitle={`${concluidasSemana.length}/${tarefasSemana.length} esta semana`} />;
    default:
      return null;
  }
}

function WidgetCard({
  widget,
  tarefas,
  editing,
  onRemove,
}: {
  widget: WidgetConfig;
  tarefas: MinaTarefa[];
  editing: boolean;
  onRemove: () => void;
}) {
  const meta = getWidgetMeta(widget.type);
  if (!meta) return null;

  const isKpi = meta.category === "kpi";

  const sizeClass = isKpi
    ? ""
    : widget.size === "lg"
    ? "col-span-2"
    : "";

  const content = (() => {
    switch (widget.type) {
      case "kpi_pendentes":
      case "kpi_atrasadas":
      case "kpi_concluidas_hoje":
      case "kpi_produtividade":
        return <KpiWidget type={widget.type} tarefas={tarefas} />;
      case "tarefas_por_projeto":
        return <WidgetTarefasPorProjeto tarefas={tarefas} />;
      case "tarefas_por_prioridade":
        return <WidgetTarefasPorPrioridade tarefas={tarefas} />;
      case "tarefas_por_status":
        return <WidgetTarefasPorStatus tarefas={tarefas} />;
      case "timeline_conclusoes":
        return <WidgetTimelineConclusoes tarefas={tarefas} />;
      case "lista_atrasadas":
        return <WidgetListaAtrasadas tarefas={tarefas} />;
      case "lista_proximas":
        return <WidgetListaProximas tarefas={tarefas} />;
      default:
        return null;
    }
  })();

  if (isKpi) {
    return (
      <div className="relative">
        {editing && (
          <button
            onClick={onRemove}
            className="absolute -top-1.5 -right-1.5 z-10 h-5 w-5 rounded-full bg-destructive text-destructive-foreground flex items-center justify-center hover:bg-destructive/80"
          >
            <X className="h-3 w-3" />
          </button>
        )}
        {content}
      </div>
    );
  }

  return (
    <Card className={`${sizeClass} relative`}>
      {editing && (
        <button
          onClick={onRemove}
          className="absolute -top-1.5 -right-1.5 z-10 h-5 w-5 rounded-full bg-destructive text-destructive-foreground flex items-center justify-center hover:bg-destructive/80"
        >
          <X className="h-3 w-3" />
        </button>
      )}
      <CardHeader className="pb-2 pt-4 px-4">
        <CardTitle className="text-sm font-medium flex items-center gap-1.5">
          <meta.icon className="h-3.5 w-3.5 text-muted-foreground" />
          {meta.label}
        </CardTitle>
      </CardHeader>
      <CardContent className="px-4 pb-4">{content}</CardContent>
    </Card>
  );
}

export function CustomDashboardBuilder({ tarefas }: Props) {
  const { dashboards, isLoading, createDashboard, updateWidgets, renameDashboard, deleteDashboard } =
    useCustomDashboards();

  const [activeDashId, setActiveDashId] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [newName, setNewName] = useState("Meu Dashboard");
  const [showAddWidget, setShowAddWidget] = useState(false);

  // Auto-select first dashboard
  const activeDash = useMemo(() => {
    if (activeDashId) return dashboards.find((d) => d.id === activeDashId) || dashboards[0] || null;
    return dashboards[0] || null;
  }, [dashboards, activeDashId]);

  const widgets = activeDash?.widgets || [];
  const kpiWidgets = widgets.filter((w) => getWidgetMeta(w.type)?.category === "kpi").sort((a, b) => a.order - b.order);
  const otherWidgets = widgets.filter((w) => getWidgetMeta(w.type)?.category !== "kpi").sort((a, b) => a.order - b.order);

  const handleCreateDashboard = () => {
    createDashboard.mutate(newName, {
      onSuccess: (data: any) => {
        setActiveDashId(data.id);
        setShowNew(false);
        setNewName("Meu Dashboard");
      },
    });
  };

  const handleRemoveWidget = (type: string) => {
    if (!activeDash) return;
    const updated = widgets.filter((w) => w.type !== type);
    updateWidgets.mutate({ id: activeDash.id, widgets: updated });
  };

  const handleAddWidget = (type: string) => {
    if (!activeDash) return;
    if (widgets.find((w) => w.type === type)) return;
    const meta = getWidgetMeta(type);
    const updated = [...widgets, { type, order: widgets.length, size: meta?.defaultSize || "md" as const }];
    updateWidgets.mutate({ id: activeDash.id, widgets: updated });
  };

  const availableToAdd = WIDGET_REGISTRY.filter((w) => !widgets.find((wc) => wc.type === w.type));

  // No dashboards yet
  if (!isLoading && dashboards.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center mb-4">
          <LayoutDashboard className="h-8 w-8 text-primary" />
        </div>
        <h3 className="font-semibold text-lg mb-1">Crie seu Dashboard</h3>
        <p className="text-sm text-muted-foreground mb-4 text-center max-w-md">
          Monte dashboards personalizados com KPIs, gráficos e listas para acompanhar suas tarefas.
        </p>
        <Button onClick={() => setShowNew(true)} className="gap-1.5">
          <Plus className="h-4 w-4" /> Criar Dashboard
        </Button>
        <Dialog open={showNew} onOpenChange={setShowNew}>
          <DialogContent className="max-w-sm">
            <DialogHeader>
              <DialogTitle>Novo Dashboard</DialogTitle>
            </DialogHeader>
            <Input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="Nome do dashboard" />
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowNew(false)}>Cancelar</Button>
              <Button onClick={handleCreateDashboard} disabled={!newName.trim()}>Criar</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Dashboard Selector */}
      <div className="flex items-center gap-3 flex-wrap">
        <Select value={activeDash?.id || ""} onValueChange={setActiveDashId}>
          <SelectTrigger className="w-[200px] h-8 text-sm">
            <SelectValue placeholder="Selecionar dashboard" />
          </SelectTrigger>
          <SelectContent>
            {dashboards.map((d) => (
              <SelectItem key={d.id} value={d.id}>{d.nome}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Button variant="outline" size="sm" className="h-8 gap-1 text-xs" onClick={() => setShowNew(true)}>
          <Plus className="h-3.5 w-3.5" /> Novo
        </Button>

        {activeDash && (
          <>
            <Button
              variant={editing ? "default" : "outline"}
              size="sm"
              className="h-8 gap-1 text-xs"
              onClick={() => setEditing(!editing)}
            >
              {editing ? <><Check className="h-3.5 w-3.5" /> Salvar</> : <><Pencil className="h-3.5 w-3.5" /> Editar</>}
            </Button>

            {editing && (
              <>
                <Button variant="outline" size="sm" className="h-8 gap-1 text-xs" onClick={() => setShowAddWidget(true)}>
                  <Plus className="h-3.5 w-3.5" /> Widget
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 gap-1 text-xs text-destructive hover:text-destructive"
                  onClick={() => {
                    if (confirm("Excluir este dashboard?")) {
                      deleteDashboard.mutate(activeDash.id);
                      setEditing(false);
                    }
                  }}
                >
                  <Trash2 className="h-3.5 w-3.5" /> Excluir
                </Button>
              </>
            )}
          </>
        )}
      </div>

      {/* KPI Row */}
      {kpiWidgets.length > 0 && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {kpiWidgets.map((w) => (
            <WidgetCard
              key={w.type}
              widget={w}
              tarefas={tarefas}
              editing={editing}
              onRemove={() => handleRemoveWidget(w.type)}
            />
          ))}
        </div>
      )}

      {/* Charts & Lists Grid */}
      {otherWidgets.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {otherWidgets.map((w) => (
            <WidgetCard
              key={w.type}
              widget={w}
              tarefas={tarefas}
              editing={editing}
              onRemove={() => handleRemoveWidget(w.type)}
            />
          ))}
        </div>
      )}

      {/* New Dashboard Dialog */}
      <Dialog open={showNew} onOpenChange={setShowNew}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Novo Dashboard</DialogTitle>
          </DialogHeader>
          <Input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="Nome do dashboard" />
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowNew(false)}>Cancelar</Button>
            <Button onClick={handleCreateDashboard} disabled={!newName.trim()}>Criar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add Widget Dialog */}
      <Dialog open={showAddWidget} onOpenChange={setShowAddWidget}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Adicionar Widget</DialogTitle>
          </DialogHeader>
          <div className="space-y-2 max-h-[400px] overflow-auto">
            {availableToAdd.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4 text-center">Todos os widgets já foram adicionados.</p>
            ) : (
              availableToAdd.map((w) => (
                <button
                  key={w.type}
                  className="flex items-center gap-3 w-full px-3 py-2.5 rounded-lg border border-border hover:bg-muted/50 transition-colors text-left"
                  onClick={() => {
                    handleAddWidget(w.type);
                    setShowAddWidget(false);
                  }}
                >
                  <w.icon className="h-4 w-4 text-muted-foreground shrink-0" />
                  <div>
                    <p className="text-sm font-medium">{w.label}</p>
                    <p className="text-xs text-muted-foreground">
                      {w.category === "kpi" ? "Indicador" : w.category === "chart" ? "Gráfico" : "Lista"}
                    </p>
                  </div>
                  <Plus className="h-4 w-4 ml-auto text-primary" />
                </button>
              ))
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
