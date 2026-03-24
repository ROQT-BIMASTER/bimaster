import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import {
  Scale, ChevronRight, ChevronDown, Clock, CheckCircle2, AlertCircle,
  FileText, Loader2, FolderOpen, Activity, Gavel
} from "lucide-react";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { ETAPAS_CICLO_VIDA, type ProductProcess, type ProcessEvent, type ProcessStepHistory } from "@/hooks/useProductProcess";
import { PastaDigitalPanel } from "./PastaDigitalPanel";

interface PastaOficialProcessosProps {
  produtoBrasilId: string;
  produtoTipo?: "china" | "brasil" | "fabrica";
}

const STATUS_STYLE: Record<string, { bg: string; text: string; label: string }> = {
  em_andamento: { bg: "bg-primary/10", text: "text-primary", label: "Em Andamento" },
  aprovado: { bg: "bg-emerald-500/10", text: "text-emerald-600", label: "Aprovado" },
  reprovado: { bg: "bg-destructive/10", text: "text-destructive", label: "Reprovado" },
  cancelado: { bg: "bg-muted", text: "text-muted-foreground", label: "Cancelado" },
};

export function PastaOficialProcessos({ produtoBrasilId, produtoTipo = "brasil" }: PastaOficialProcessosProps) {
  const [expandedProcessId, setExpandedProcessId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<Record<string, string>>({});

  // Fetch ALL processes for this product
  const { data: processos = [], isLoading } = useQuery({
    queryKey: ["pasta-oficial-processos", produtoBrasilId, produtoTipo],
    queryFn: async () => {
      const { data, error } = await (supabase
        .from("product_process" as any)
        .select("*")
        .eq("produto_ref_id", produtoBrasilId)
        .order("created_at", { ascending: false }) as any);
      if (error) throw error;
      return (data || []) as ProductProcess[];
    },
    enabled: !!produtoBrasilId,
  });

  // Fetch events for expanded process
  const { data: events = [] } = useQuery({
    queryKey: ["pasta-oficial-events", expandedProcessId],
    queryFn: async () => {
      const { data, error } = await (supabase
        .from("process_events" as any)
        .select("*")
        .eq("process_id", expandedProcessId!)
        .order("created_at", { ascending: false })
        .limit(50) as any);
      if (error) throw error;
      return (data || []) as ProcessEvent[];
    },
    enabled: !!expandedProcessId,
  });

  // Fetch step history for expanded process
  const { data: stepHistory = [] } = useQuery({
    queryKey: ["pasta-oficial-steps", expandedProcessId],
    queryFn: async () => {
      const { data, error } = await (supabase
        .from("process_step_history" as any)
        .select("*")
        .eq("process_id", expandedProcessId!)
        .order("created_at", { ascending: true }) as any);
      if (error) throw error;
      return (data || []) as ProcessStepHistory[];
    },
    enabled: !!expandedProcessId,
  });

  // Fetch decisions for expanded process
  const { data: decisions = [] } = useQuery({
    queryKey: ["pasta-oficial-decisions", expandedProcessId],
    queryFn: async () => {
      const { data, error } = await (supabase
        .from("process_decisions" as any)
        .select("*")
        .eq("process_id", expandedProcessId!)
        .order("decided_at", { ascending: false }) as any);
      if (error) throw error;
      return (data || []) as any[];
    },
    enabled: !!expandedProcessId,
  });

  const toggleProcess = (id: string) => {
    setExpandedProcessId(prev => prev === id ? null : id);
  };

  const getTab = (processId: string) => activeTab[processId] || "resumo";
  const setTab = (processId: string, tab: string) =>
    setActiveTab(prev => ({ ...prev, [processId]: tab }));

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center gap-2 p-3 rounded-lg bg-primary/5 border border-primary/20">
        <FolderOpen className="h-5 w-5 text-primary" />
        <div>
          <p className="text-sm font-semibold">Pasta Oficial de Processos</p>
          <p className="text-[11px] text-muted-foreground">
            {processos.length} processo{processos.length !== 1 ? "s" : ""} registrado{processos.length !== 1 ? "s" : ""}
          </p>
        </div>
      </div>

      {processos.length === 0 ? (
        <Card className="p-8 text-center">
          <Scale className="h-10 w-10 mx-auto mb-3 text-muted-foreground/30" />
          <p className="text-sm text-muted-foreground">Nenhum processo registrado para este produto.</p>
          <p className="text-xs text-muted-foreground/70 mt-1">
            Processos são criados automaticamente ao vincular submissões.
          </p>
        </Card>
      ) : (
        <ScrollArea className="max-h-[600px]">
          <div className="space-y-3">
            {processos.map((proc) => {
              const isExpanded = expandedProcessId === proc.id;
              const statusStyle = STATUS_STYLE[proc.status] || STATUS_STYLE.em_andamento;
              const etapaAtualIndex = ETAPAS_CICLO_VIDA.findIndex(e => e.key === proc.etapa_atual);
              const progressPercent = etapaAtualIndex >= 0
                ? Math.round(((etapaAtualIndex + 1) / ETAPAS_CICLO_VIDA.length) * 100)
                : 0;
              const etapaLabel = ETAPAS_CICLO_VIDA.find(e => e.key === proc.etapa_atual)?.label || proc.etapa_atual;
              const tab = getTab(proc.id);

              return (
                <Collapsible key={proc.id} open={isExpanded} onOpenChange={() => toggleProcess(proc.id)}>
                  <CollapsibleTrigger asChild>
                    <Card className={cn(
                      "p-4 cursor-pointer transition-all",
                      isExpanded && "ring-2 ring-primary/30 shadow-md"
                    )}>
                      <div className="flex items-center gap-3">
                        {isExpanded
                          ? <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />
                          : <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
                        }
                        <Scale className="h-4 w-4 text-primary shrink-0" />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-semibold">{proc.numero_processo}</span>
                            <Badge className={cn("text-[10px]", statusStyle.bg, statusStyle.text)}>
                              {statusStyle.label}
                            </Badge>
                          </div>
                          <div className="flex items-center gap-3 mt-1">
                            <span className="text-[11px] text-muted-foreground">
                              Etapa: <span className="font-medium text-foreground">{etapaLabel}</span>
                            </span>
                            <span className="text-[11px] text-muted-foreground flex items-center gap-1">
                              <Clock className="h-3 w-3" />
                              {format(new Date(proc.created_at), "dd/MM/yyyy", { locale: ptBR })}
                            </span>
                          </div>
                        </div>
                        <div className="w-20">
                          <Progress value={progressPercent} className="h-1.5" />
                          <p className="text-[10px] text-muted-foreground text-right mt-0.5">{progressPercent}%</p>
                        </div>
                      </div>
                    </Card>
                  </CollapsibleTrigger>

                  <CollapsibleContent>
                    <div className="ml-4 mt-2 border-l-2 border-primary/20 pl-4 space-y-3">
                      {/* Tab navigation */}
                      <div className="flex gap-1 flex-wrap">
                        {[
                          { key: "resumo", label: "Resumo", icon: Scale },
                          { key: "timeline", label: "Timeline", icon: Activity },
                          { key: "decisoes", label: "Decisões", icon: Gavel },
                          { key: "documentos", label: "Documentos", icon: FileText },
                        ].map(t => (
                          <button
                            key={t.key}
                            onClick={(e) => { e.stopPropagation(); setTab(proc.id, t.key); }}
                            className={cn(
                              "flex items-center gap-1 px-3 py-1.5 rounded-md text-xs font-medium transition-colors",
                              tab === t.key
                                ? "bg-primary text-primary-foreground"
                                : "bg-muted/50 text-muted-foreground hover:bg-muted"
                            )}
                          >
                            <t.icon className="h-3 w-3" />
                            {t.label}
                          </button>
                        ))}
                      </div>

                      {/* Tab content */}
                      {tab === "resumo" && (
                        <ProcessoResumoInline
                          process={proc}
                          etapaAtualIndex={etapaAtualIndex}
                          progressPercent={progressPercent}
                          eventsCount={isExpanded ? events.length : 0}
                          stepHistory={stepHistory}
                        />
                      )}

                      {tab === "timeline" && (
                        <TimelineInline events={events} />
                      )}

                      {tab === "decisoes" && (
                        <DecisoesInline decisions={decisions} />
                      )}

                      {tab === "documentos" && (
                        <PastaDigitalPanel produtoBrasilId={produtoBrasilId} />
                      )}
                    </div>
                  </CollapsibleContent>
                </Collapsible>
              );
            })}
          </div>
        </ScrollArea>
      )}
    </div>
  );
}

// --- Inline sub-components ---

function ProcessoResumoInline({
  process, etapaAtualIndex, progressPercent, eventsCount, stepHistory
}: {
  process: ProductProcess;
  etapaAtualIndex: number;
  progressPercent: number;
  eventsCount: number;
  stepHistory: ProcessStepHistory[];
}) {
  return (
    <Card className="p-4 space-y-4">
      {/* Step pills */}
      <div className="flex flex-wrap gap-1">
        {ETAPAS_CICLO_VIDA.map((etapa, i) => {
          const isCurrent = etapa.key === process.etapa_atual;
          const isPast = i < etapaAtualIndex;
          return (
            <Badge
              key={etapa.key}
              variant="outline"
              className={cn(
                "text-[9px] px-1.5 py-0 h-5 transition-all",
                isCurrent && "bg-primary text-primary-foreground border-primary font-bold",
                isPast && "bg-emerald-500/10 text-emerald-600 border-emerald-200",
                !isCurrent && !isPast && "text-muted-foreground border-border/50"
              )}
            >
              {isPast && <CheckCircle2 className="h-2.5 w-2.5 mr-0.5" />}
              {etapa.label}
            </Badge>
          );
        })}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-2 text-center">
        <div className="bg-muted/50 rounded-md p-2">
          <div className="text-lg font-bold text-foreground">{eventsCount}</div>
          <div className="text-[10px] text-muted-foreground">Eventos</div>
        </div>
        <div className="bg-muted/50 rounded-md p-2">
          <div className="text-lg font-bold text-foreground">
            {etapaAtualIndex + 1}/{ETAPAS_CICLO_VIDA.length}
          </div>
          <div className="text-[10px] text-muted-foreground">Etapa</div>
        </div>
        <div className="bg-muted/50 rounded-md p-2">
          <div className="text-[11px] font-medium text-foreground">
            {format(new Date(process.created_at), "dd/MM/yy", { locale: ptBR })}
          </div>
          <div className="text-[10px] text-muted-foreground flex items-center justify-center gap-0.5">
            <Clock className="h-2.5 w-2.5" /> Início
          </div>
        </div>
      </div>

      {/* SLA by step */}
      {stepHistory.length > 0 && (
        <div className="space-y-1.5">
          <p className="text-[11px] font-medium text-muted-foreground">SLA por Etapa</p>
          {stepHistory.map((step) => {
            const label = ETAPAS_CICLO_VIDA.find(e => e.key === step.etapa)?.label || step.etapa;
            const hours = step.tempo_permanencia_minutos
              ? Math.round(step.tempo_permanencia_minutos / 60)
              : null;
            return (
              <div key={step.id} className="flex items-center justify-between text-[11px]">
                <span className="flex items-center gap-1">
                  {step.status === "em_andamento"
                    ? <AlertCircle className="h-3 w-3 text-warning" />
                    : <CheckCircle2 className="h-3 w-3 text-emerald-500" />
                  }
                  {label}
                </span>
                <span className="text-muted-foreground">
                  {hours !== null ? `${hours}h` : "em curso"}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </Card>
  );
}

function TimelineInline({ events }: { events: ProcessEvent[] }) {
  if (events.length === 0) {
    return (
      <Card className="p-6 text-center">
        <Activity className="h-8 w-8 mx-auto mb-2 text-muted-foreground/30" />
        <p className="text-xs text-muted-foreground">Nenhum evento registrado.</p>
      </Card>
    );
  }

  return (
    <Card className="p-4">
      <ScrollArea className="max-h-[300px]">
        <div className="space-y-3">
          {events.map((ev) => (
            <div key={ev.id} className="flex gap-3 text-xs">
              <div className="flex flex-col items-center">
                <div className={cn(
                  "w-2 h-2 rounded-full mt-1.5 shrink-0",
                  ev.tipo_evento === "etapa_change" ? "bg-primary" :
                  ev.tipo_evento === "aprovacao" ? "bg-emerald-500" :
                  ev.tipo_evento === "rejeicao" ? "bg-destructive" :
                  "bg-muted-foreground"
                )} />
                <div className="w-px flex-1 bg-border" />
              </div>
              <div className="pb-3 flex-1 min-w-0">
                <p className="font-medium text-foreground">{ev.descricao || ev.tipo_evento}</p>
                <div className="flex items-center gap-2 mt-0.5">
                  {ev.usuario_nome && (
                    <span className="text-muted-foreground">{ev.usuario_nome}</span>
                  )}
                  <span className="text-muted-foreground/70">
                    {format(new Date(ev.created_at), "dd/MM/yy HH:mm", { locale: ptBR })}
                  </span>
                  <Badge variant="outline" className="text-[9px] px-1 py-0">{ev.modulo_origem}</Badge>
                </div>
              </div>
            </div>
          ))}
        </div>
      </ScrollArea>
    </Card>
  );
}

function DecisoesInline({ decisions }: { decisions: any[] }) {
  if (decisions.length === 0) {
    return (
      <Card className="p-6 text-center">
        <Gavel className="h-8 w-8 mx-auto mb-2 text-muted-foreground/30" />
        <p className="text-xs text-muted-foreground">Nenhuma decisão formal registrada.</p>
      </Card>
    );
  }

  const DECISION_STYLE: Record<string, { icon: typeof CheckCircle2; color: string; label: string }> = {
    approved: { icon: CheckCircle2, color: "text-emerald-600", label: "Aprovado" },
    rejected: { icon: AlertCircle, color: "text-destructive", label: "Rejeitado" },
    needs_revision: { icon: Clock, color: "text-warning", label: "Ajuste Necessário" },
  };

  return (
    <Card className="p-4">
      <ScrollArea className="max-h-[300px]">
        <div className="space-y-3">
          {decisions.map((dec) => {
            const style = DECISION_STYLE[dec.decision_type] || DECISION_STYLE.needs_revision;
            const Icon = style.icon;
            return (
              <div key={dec.id} className="p-3 rounded-lg border bg-muted/20 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Icon className={cn("h-4 w-4", style.color)} />
                    <span className={cn("text-xs font-semibold", style.color)}>{style.label}</span>
                    <Badge variant="outline" className="text-[9px] px-1 py-0">
                      V{dec.version}
                    </Badge>
                  </div>
                  <span className="text-[10px] text-muted-foreground">
                    {dec.decided_at && format(new Date(dec.decided_at), "dd/MM/yy HH:mm", { locale: ptBR })}
                  </span>
                </div>
                {dec.message && (
                  <p className="text-[11px] text-foreground">{dec.message}</p>
                )}
                {dec.items_affected && Array.isArray(dec.items_affected) && dec.items_affected.length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {dec.items_affected.map((item: string, i: number) => (
                      <Badge key={i} variant="secondary" className="text-[9px]">{item}</Badge>
                    ))}
                  </div>
                )}
                <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
                  <span>{dec.origin} → {dec.destination}</span>
                  {dec.prazo_retorno && (
                    <span className="flex items-center gap-0.5">
                      <Clock className="h-2.5 w-2.5" />
                      Prazo: {format(new Date(dec.prazo_retorno), "dd/MM/yy", { locale: ptBR })}
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </ScrollArea>
    </Card>
  );
}
