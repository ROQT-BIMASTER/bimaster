import { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  Plus, Pencil, Trash2, X, Check, LayoutDashboard, BarChart3, ListChecks, Gauge,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useCustomDashboards } from "@/hooks/useCustomDashboards";
import {
  WIDGET_REGISTRY, getWidgetMeta,
  type WidgetConfig,
} from "./widgets/WidgetRegistry";
import { KpiCard } from "@/components/ui/kpi-card";
import { Clock, AlertTriangle, CheckCircle2, TrendingUp, Target } from "lucide-react";
import { isToday, startOfDay, startOfWeek, endOfWeek, isWithinInterval } from "date-fns";
import { parseLocalDate, getToday } from "@/lib/utils/parseLocalDate";
import type { MinaTarefa } from "@/hooks/useMinhasTarefas";

// Widget renderers
import { WidgetTarefasPorProjeto } from "./widgets/WidgetTarefasPorProjeto";
import { WidgetTarefasPorPrioridade } from "./widgets/WidgetTarefasPorPrioridade";
import { WidgetTarefasPorStatus } from "./widgets/WidgetTarefasPorStatus";
import { WidgetTimelineConclusoes } from "./widgets/WidgetTimelineConclusoes";
import { WidgetListaAtrasadas } from "./widgets/WidgetListaAtrasadas";
import { WidgetListaProximas } from "./widgets/WidgetListaProximas";
import { WidgetHeatmapProdutividade } from "./widgets/WidgetHeatmapProdutividade";
import { WidgetLeaderboardProjetos } from "./widgets/WidgetLeaderboardProjetos";
import { WidgetTaxaCumprimentoPrazo, calcTaxaPrazo } from "./widgets/WidgetTaxaCumprimentoPrazo";
import { WidgetCargaCapacidade } from "./widgets/WidgetCargaCapacidade";
import { WidgetAgingTarefas } from "./widgets/WidgetAgingTarefas";
import { DashboardTemplateGallery } from "./DashboardTemplateGallery";
import { useConfirm } from "@/hooks/useConfirm";


interface Props {
  tarefas: MinaTarefa[];
}

function KpiWidget({ type, tarefas }: { type: string; tarefas: MinaTarefa[] }) {
  const now = getToday();
  const weekStart = startOfWeek(now, { weekStartsOn: 1 });
  const weekEnd = endOfWeek(now, { weekStartsOn: 1 });

  const pendentes = tarefas.filter((t) => t.status !== "concluida");
  const atrasadas = pendentes.filter((t) => {
    const p = parseLocalDate(t.data_prazo);
    return p && startOfDay(p) < now;
  });
  const concluidasHoje = tarefas.filter((t) => {
    if (t.status !== "concluida") return false;
    const c = parseLocalDate(t.data_conclusao);
    return c && isToday(c);
  });
  const tarefasSemana = tarefas.filter((t) => {
    const p = parseLocalDate(t.data_prazo);
    if (!p) return false;
    return isWithinInterval(startOfDay(p), { start: weekStart, end: weekEnd });
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
      return <KpiCard title="Concluídas hoje" value={concluidasHoje.length} icon={CheckCircle2} variant="success" subtitle="bom trabalho" />;
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
    ? "md:col-span-12 lg:col-span-8"
    : "md:col-span-6 lg:col-span-4";

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
      <div className={cn("relative", editing && "ring-2 ring-dashed ring-primary/40 rounded-[10px]")}>
        {editing && (
          <button
            onClick={onRemove}
            className="absolute -top-2 -right-2 z-10 h-6 w-6 rounded-full bg-background border border-border shadow-sm flex items-center justify-center text-muted-foreground hover:text-destructive hover:border-destructive/40 transition-colors"
            aria-label="Remover widget"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        )}
        {content}
      </div>
    );
  }

  return (
    <Card
      className={cn(
        sizeClass,
        "relative border-border/60",
        editing && "ring-2 ring-dashed ring-primary/40",
      )}
    >
      {editing && (
        <button
          onClick={onRemove}
          className="absolute -top-2 -right-2 z-10 h-6 w-6 rounded-full bg-background border border-border shadow-sm flex items-center justify-center text-muted-foreground hover:text-destructive hover:border-destructive/40 transition-colors"
          aria-label="Remover widget"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      )}
      <CardHeader className="pb-3 pt-4 px-5 border-b border-border/40">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <CardTitle className="text-[13px] font-semibold flex items-center gap-2 leading-tight">
              <meta.icon className="h-3.5 w-3.5 text-muted-foreground" />
              {meta.label}
            </CardTitle>
          </div>
        </div>
      </CardHeader>
      <CardContent className="px-5 py-4">{content}</CardContent>
    </Card>
  );
}

export function CustomDashboardBuilder({ tarefas }: Props) {
  const confirm = useConfirm();
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
  const chartWidgets = widgets.filter((w) => getWidgetMeta(w.type)?.category === "chart").sort((a, b) => a.order - b.order);
  const listWidgets = widgets.filter((w) => getWidgetMeta(w.type)?.category === "list").sort((a, b) => a.order - b.order);
  const otherWidgets = [...chartWidgets, ...listWidgets];

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
        <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center mb-4 ring-1 ring-primary/20">
          <LayoutDashboard className="h-8 w-8 text-primary" />
        </div>
        <h3 className="font-semibold text-lg mb-1 font-display">Crie seu Dashboard</h3>
        <p className="text-sm text-muted-foreground mb-4 text-center max-w-md">
          Monte dashboards personalizados com indicadores, gráficos e listas para acompanhar suas tarefas.
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
    <div className="space-y-5">
      {/* Executive Header */}
      <div className="flex items-end justify-between gap-3 flex-wrap pb-3 border-b border-border/40">
        <div className="flex items-center gap-3 min-w-0">
          <div className="h-10 w-10 rounded-lg bg-primary/10 ring-1 ring-primary/20 flex items-center justify-center shrink-0">
            <LayoutDashboard className="h-5 w-5 text-primary" />
          </div>
          <div className="min-w-0">
            <h2 className="text-lg font-semibold font-display tracking-tight leading-tight truncate">
              {activeDash?.nome || "Dashboard"}
            </h2>
            <p className="text-[11px] text-muted-foreground mt-0.5">
              {tarefas.length.toLocaleString("pt-BR")} tarefa{tarefas.length !== 1 ? "s" : ""} • {widgets.length} widget{widgets.length !== 1 ? "s" : ""}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1.5">
          {/* Dashboard pills */}
          {dashboards.length > 1 && (
            <div className="flex items-center gap-1 mr-1 p-0.5 rounded-md bg-muted/60 border border-border/60">
              {dashboards.map((d) => (
                <button
                  key={d.id}
                  onClick={() => setActiveDashId(d.id)}
                  className={cn(
                    "px-2.5 h-7 text-xs font-medium rounded-sm transition-colors max-w-[140px] truncate",
                    activeDash?.id === d.id
                      ? "bg-background text-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  {d.nome}
                </button>
              ))}
            </div>
          )}

          <Button variant="ghost" size="sm" className="h-8 gap-1 text-xs" onClick={() => setShowNew(true)}>
            <Plus className="h-3.5 w-3.5" /> Novo
          </Button>

          {activeDash && (
            <>
              {editing && (
                <>
                  <Button variant="ghost" size="sm" className="h-8 gap-1 text-xs" onClick={() => setShowAddWidget(true)}>
                    <Plus className="h-3.5 w-3.5" /> Widget
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 gap-1 text-xs text-destructive hover:text-destructive"
                    onClick={async () => {
                      if ((await confirm({ title: "Excluir este dashboard?", destructive: true }))) {
                        deleteDashboard.mutate(activeDash.id);
                        setEditing(false);
                      }
                    }}
                  >
                    <Trash2 className="h-3.5 w-3.5" /> Excluir
                  </Button>
                </>
              )}
              <Button
                variant={editing ? "default" : "outline"}
                size="sm"
                className="h-8 gap-1 text-xs"
                onClick={() => setEditing(!editing)}
              >
                {editing ? <><Check className="h-3.5 w-3.5" /> Concluir</> : <><Pencil className="h-3.5 w-3.5" /> Editar</>}
              </Button>
            </>
          )}
        </div>
      </div>

      {/* KPI Section */}
      {kpiWidgets.length > 0 && (
        <section className="space-y-2.5">
          <div className="flex items-center gap-2">
            <Gauge className="h-3.5 w-3.5 text-muted-foreground" />
            <h3 className="text-[10.5px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">
              Indicadores
            </h3>
            <div className="flex-1 h-px bg-border/40" />
          </div>
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
        </section>
      )}

      {/* Charts Section */}
      {chartWidgets.length > 0 && (
        <section className="space-y-2.5">
          <div className="flex items-center gap-2">
            <BarChart3 className="h-3.5 w-3.5 text-muted-foreground" />
            <h3 className="text-[10.5px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">
              Análises
            </h3>
            <div className="flex-1 h-px bg-border/40" />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
            {chartWidgets.map((w) => (
              <WidgetCard
                key={w.type}
                widget={w}
                tarefas={tarefas}
                editing={editing}
                onRemove={() => handleRemoveWidget(w.type)}
              />
            ))}
          </div>
        </section>
      )}

      {/* Lists Section */}
      {listWidgets.length > 0 && (
        <section className="space-y-2.5">
          <div className="flex items-center gap-2">
            <ListChecks className="h-3.5 w-3.5 text-muted-foreground" />
            <h3 className="text-[10.5px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">
              Listas
            </h3>
            <div className="flex-1 h-px bg-border/40" />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
            {listWidgets.map((w) => (
              <WidgetCard
                key={w.type}
                widget={w}
                tarefas={tarefas}
                editing={editing}
                onRemove={() => handleRemoveWidget(w.type)}
              />
            ))}
          </div>
        </section>
      )}

      {/* Empty state when editing with no widgets */}
      {widgets.length === 0 && (
        <div className="flex flex-col items-center justify-center py-16 rounded-lg border border-dashed border-border/60 bg-muted/20">
          <LayoutDashboard className="h-8 w-8 text-muted-foreground/40 mb-3" />
          <p className="text-sm font-medium text-foreground">Dashboard vazio</p>
          <p className="text-xs text-muted-foreground mt-1 mb-3">Adicione widgets para visualizar seus dados</p>
          <Button size="sm" variant="outline" className="gap-1.5" onClick={() => { setEditing(true); setShowAddWidget(true); }}>
            <Plus className="h-3.5 w-3.5" /> Adicionar widget
          </Button>
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
                  className="flex items-center gap-3 w-full px-3 py-2.5 rounded-lg border border-border hover:bg-muted/50 hover:border-primary/40 transition-colors text-left"
                  onClick={() => {
                    handleAddWidget(w.type);
                    setShowAddWidget(false);
                  }}
                >
                  <div className="h-8 w-8 rounded-md bg-muted flex items-center justify-center shrink-0">
                    <w.icon className="h-4 w-4 text-muted-foreground" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate">{w.label}</p>
                    <p className="text-xs text-muted-foreground">
                      {w.category === "kpi" ? "Indicador" : w.category === "chart" ? "Gráfico" : "Lista"}
                    </p>
                  </div>
                  <Plus className="h-4 w-4 ml-auto text-primary shrink-0" />
                </button>
              ))
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
