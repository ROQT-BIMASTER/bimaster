import { useState } from "react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  ArrowRight, CheckCircle2, Clock, FileText, Loader2, Package,
  Scale, Send, ShieldCheck, XCircle, ChevronRight, ChevronDown,
  AlertTriangle, UserCircle, Plus, FilePen, History,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useProductProcess, ETAPAS_CICLO_VIDA, type EtapaKey } from "@/hooks/useProductProcess";
import { toast } from "sonner";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";

interface Props {
  submissaoId: string;
  submissaoNome?: string;
  submissaoCodigo?: string;
}

const DESPACHO_MODULOS = [
  { key: "regulatorio", label: "Regulatório", icon: ShieldCheck, description: "Enviar para validação fiscal e regulatória" },
  { key: "cadastro", label: "Cadastro", icon: FileText, description: "Enviar para cadastro no sistema Brasil" },
  { key: "qualidade", label: "Qualidade", icon: CheckCircle2, description: "Enviar para análise de qualidade" },
  { key: "logistica", label: "Logística", icon: Package, description: "Enviar para planejamento logístico" },
  { key: "composicao", label: "Composição INCI", icon: Scale, description: "Enviar para análise de composição" },
  { key: "artes", label: "Motor de Artes", icon: FilePen, description: "Enviar para fluxo de aprovação de artes" },
];

const PHASE_ICONS: Record<string, any> = {
  ideia: Plus,
  projeto: FileText,
  pre_cadastro: FilePen,
  desenvolvimento: Package,
  testes: AlertTriangle,
  embalagem: Package,
  regulatorio: ShieldCheck,
  cadastro_final: FileText,
  aprovacao: CheckCircle2,
  producao: Package,
  lancamento: ArrowRight,
  recebimento: CheckCircle2,
};

const EVENT_ICON_MAP: Record<string, { icon: any; color: string }> = {
  etapa_change: { icon: ArrowRight, color: "text-purple-500" },
  criacao: { icon: Plus, color: "text-emerald-500" },
  INSERT: { icon: Plus, color: "text-emerald-500" },
  UPDATE: { icon: FilePen, color: "text-blue-500" },
  aprovacao: { icon: ShieldCheck, color: "text-emerald-500" },
  despacho: { icon: Send, color: "text-primary" },
  documento: { icon: FileText, color: "text-amber-500" },
};

export function ProcessOrchestrationPanel({ submissaoId, submissaoNome, submissaoCodigo }: Props) {
  const {
    process, processLoading, events, slaByStep, advanceStep, addEvent, combinedTimeline,
  } = useProductProcess("china", submissaoId);

  const [advanceDialogOpen, setAdvanceDialogOpen] = useState(false);
  const [advanceTarget, setAdvanceTarget] = useState<EtapaKey | "">("");
  const [advanceObs, setAdvanceObs] = useState("");
  const [despachoDialogOpen, setDespachoDialogOpen] = useState(false);
  const [despachoModulo, setDespachoModulo] = useState("");
  const [despachoObs, setDespachoObs] = useState("");
  const [timelineExpanded, setTimelineExpanded] = useState(false);

  if (processLoading) {
    return (
      <Card className="p-4 flex items-center justify-center gap-2 text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" />
        <span className="text-xs">Carregando processo...</span>
      </Card>
    );
  }

  if (!process) return null;

  const etapaAtualIndex = ETAPAS_CICLO_VIDA.findIndex(e => e.key === process.etapa_atual);
  const progressPercent = etapaAtualIndex >= 0
    ? Math.round(((etapaAtualIndex + 1) / ETAPAS_CICLO_VIDA.length) * 100)
    : 0;

  const nextSteps = ETAPAS_CICLO_VIDA.filter((_, i) => i > etapaAtualIndex);

  const handleAdvance = async () => {
    if (!advanceTarget) return;
    try {
      await advanceStep.mutateAsync({ novaEtapa: advanceTarget as EtapaKey, observacao: advanceObs || undefined });
      toast.success(`Etapa avançada para: ${ETAPAS_CICLO_VIDA.find(e => e.key === advanceTarget)?.label}`);
      setAdvanceDialogOpen(false);
      setAdvanceTarget("");
      setAdvanceObs("");
    } catch {
      toast.error("Erro ao avançar etapa");
    }
  };

  const handleDespacho = async () => {
    if (!despachoModulo) return;
    const modulo = DESPACHO_MODULOS.find(m => m.key === despachoModulo);
    try {
      await addEvent.mutateAsync({
        tipo_evento: "despacho",
        descricao: `Despachado para ${modulo?.label || despachoModulo}${despachoObs ? `: ${despachoObs}` : ""}`,
        modulo_origem: "processo",
        metadata: { modulo_destino: despachoModulo, observacao: despachoObs },
      });
      toast.success(`Processo despachado para ${modulo?.label}`);
      setDespachoDialogOpen(false);
      setDespachoModulo("");
      setDespachoObs("");
    } catch {
      toast.error("Erro ao despachar");
    }
  };

  const recentEvents = combinedTimeline.slice(0, 8);

  return (
    <div className="space-y-4">
      {/* Process Header */}
      <Card className="p-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Scale className="h-4 w-4 text-primary" />
            <span className="text-sm font-bold">Processo {process.numero_processo}</span>
            {submissaoCodigo && (
              <Badge variant="outline" className="text-[10px] font-mono">{submissaoCodigo}</Badge>
            )}
          </div>
          <Badge className={cn(
            "text-[10px]",
            process.status === "em_andamento" && "bg-blue-500/10 text-blue-600",
            process.status === "aprovado" && "bg-emerald-500/10 text-emerald-600",
            process.status === "reprovado" && "bg-destructive/10 text-destructive",
          )}>
            {process.status === "em_andamento" ? "Em Andamento" : process.status === "aprovado" ? "Aprovado" : "Reprovado"}
          </Badge>
        </div>

        {/* Progress */}
        <div className="space-y-1.5 mb-4">
          <div className="flex items-center justify-between text-[11px]">
            <span className="text-muted-foreground">Progresso do Processo</span>
            <span className="font-semibold">{progressPercent}%</span>
          </div>
          <Progress value={progressPercent} className="h-2.5" />
        </div>

        {/* Phase Stepper */}
        <div className="flex flex-wrap gap-1 mb-4">
          {ETAPAS_CICLO_VIDA.map((etapa, i) => {
            const isCurrent = etapa.key === process.etapa_atual;
            const isPast = i < etapaAtualIndex;
            const Icon = PHASE_ICONS[etapa.key] || FileText;
            return (
              <Badge
                key={etapa.key}
                variant="outline"
                className={cn(
                  "text-[9px] px-1.5 py-0.5 h-5 gap-0.5 transition-all cursor-default",
                  isCurrent && "bg-primary text-primary-foreground border-primary font-bold shadow-sm",
                  isPast && "bg-emerald-500/10 text-emerald-600 border-emerald-200",
                  !isCurrent && !isPast && "text-muted-foreground/60 border-border/40"
                )}
              >
                {isPast ? <CheckCircle2 className="h-2.5 w-2.5" /> : <Icon className="h-2.5 w-2.5" />}
                {etapa.label}
              </Badge>
            );
          })}
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            onClick={() => setAdvanceDialogOpen(true)}
            disabled={nextSteps.length === 0}
            className="h-8 text-xs gap-1.5"
          >
            <ArrowRight className="h-3.5 w-3.5" />
            Avançar Fase
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setDespachoDialogOpen(true)}
            className="h-8 text-xs gap-1.5"
          >
            <Send className="h-3.5 w-3.5" />
            Despachar para Módulo
          </Button>
        </div>
      </Card>

      {/* Stats Row */}
      <div className="grid grid-cols-4 gap-2">
        <Card className="p-3 text-center">
          <div className="text-lg font-bold text-foreground">{events.length}</div>
          <div className="text-[10px] text-muted-foreground">Eventos</div>
        </Card>
        <Card className="p-3 text-center">
          <div className="text-lg font-bold text-foreground">{etapaAtualIndex + 1}/{ETAPAS_CICLO_VIDA.length}</div>
          <div className="text-[10px] text-muted-foreground">Etapa</div>
        </Card>
        <Card className="p-3 text-center">
          <div className="text-[11px] font-semibold text-foreground">
            {format(new Date(process.created_at), "dd/MM/yy", { locale: ptBR })}
          </div>
          <div className="text-[10px] text-muted-foreground flex items-center justify-center gap-0.5">
            <Clock className="h-2.5 w-2.5" /> Início
          </div>
        </Card>
        <Card className="p-3 text-center">
          <div className="text-[11px] font-semibold text-foreground">
            {ETAPAS_CICLO_VIDA.find(e => e.key === process.etapa_atual)?.label || "-"}
          </div>
          <div className="text-[10px] text-muted-foreground">Fase Atual</div>
        </Card>
      </div>

      {/* Timeline (Collapsible) */}
      <Collapsible open={timelineExpanded} onOpenChange={setTimelineExpanded}>
        <Card className="overflow-hidden">
          <CollapsibleTrigger asChild>
            <button className="w-full flex items-center justify-between px-4 py-3 hover:bg-accent/30 transition-colors">
              <span className="text-sm font-semibold flex items-center gap-2">
                <History className="h-4 w-4 text-primary" />
                Histórico do Processo
                <Badge variant="secondary" className="text-[10px]">{combinedTimeline.length}</Badge>
              </span>
              {timelineExpanded
                ? <ChevronDown className="h-4 w-4 text-muted-foreground" />
                : <ChevronRight className="h-4 w-4 text-muted-foreground" />}
            </button>
          </CollapsibleTrigger>

          {/* Always show recent events preview */}
          {!timelineExpanded && recentEvents.length > 0 && (
            <div className="px-4 pb-3">
              <div className="space-y-1">
                {recentEvents.slice(0, 3).map((ev: any, i: number) => {
                  const evConfig = EVENT_ICON_MAP[ev.tipo_evento] || { icon: FileText, color: "text-muted-foreground" };
                  const EvIcon = evConfig.icon;
                  return (
                    <div key={`${ev.id}-${i}`} className="flex items-center gap-2 text-xs">
                      <EvIcon className={cn("h-3 w-3 shrink-0", evConfig.color)} />
                      <span className="text-muted-foreground truncate flex-1">{ev.descricao || ev.tipo_evento}</span>
                      <span className="text-[10px] text-muted-foreground/60 shrink-0">
                        {format(new Date(ev.created_at), "dd/MM HH:mm", { locale: ptBR })}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          <CollapsibleContent>
            <Separator />
            <ScrollArea className="max-h-[350px]">
              <div className="p-4 relative">
                <div className="absolute left-[25px] top-4 bottom-4 w-0.5 bg-border/40" />
                <div className="space-y-0">
                  {combinedTimeline.map((ev: any, i: number) => {
                    const evConfig = EVENT_ICON_MAP[ev.tipo_evento] || { icon: FileText, color: "text-muted-foreground" };
                    const EvIcon = evConfig.icon;
                    return (
                      <div key={`${ev.id}-${i}`} className="relative flex gap-3 py-2">
                        <div className="relative z-10 flex-shrink-0 mt-0.5">
                          <div className="h-5 w-5 rounded-full bg-background border border-border/50 flex items-center justify-center">
                            <EvIcon className={cn("h-3 w-3", evConfig.color)} />
                          </div>
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-xs text-foreground/80">{ev.descricao || ev.tipo_evento}</span>
                          </div>
                          <div className="flex items-center gap-2 mt-0.5">
                            {ev.usuario_nome && (
                              <span className="text-[10px] text-muted-foreground flex items-center gap-0.5">
                                <UserCircle className="h-2.5 w-2.5" />{ev.usuario_nome}
                              </span>
                            )}
                            <span className="text-[10px] text-muted-foreground/60">
                              {format(new Date(ev.created_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                            </span>
                            {ev.modulo_origem && (
                              <Badge variant="outline" className="text-[8px] px-1 py-0 h-3.5">{ev.modulo_origem}</Badge>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </ScrollArea>
          </CollapsibleContent>
        </Card>
      </Collapsible>

      {/* Advance Phase Dialog */}
      <Dialog open={advanceDialogOpen} onOpenChange={setAdvanceDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-sm">
              <ArrowRight className="h-4 w-4 text-primary" />
              Avançar Fase do Processo
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-xs font-medium text-muted-foreground block mb-1.5">Fase Atual</label>
              <Badge className="bg-primary text-primary-foreground">
                {ETAPAS_CICLO_VIDA.find(e => e.key === process.etapa_atual)?.label}
              </Badge>
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground block mb-1.5">Nova Fase</label>
              <Select value={advanceTarget} onValueChange={(v) => setAdvanceTarget(v as EtapaKey)}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione a próxima fase..." />
                </SelectTrigger>
                <SelectContent>
                  {nextSteps.map((etapa) => (
                    <SelectItem key={etapa.key} value={etapa.key}>
                      {etapa.label} (Etapa {etapa.ordem})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground block mb-1.5">Observação (opcional)</label>
              <Textarea
                value={advanceObs}
                onChange={(e) => setAdvanceObs(e.target.value)}
                placeholder="Motivo do avanço..."
                rows={2}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setAdvanceDialogOpen(false)}>Cancelar</Button>
            <Button size="sm" onClick={handleAdvance} disabled={!advanceTarget || advanceStep.isPending}>
              {advanceStep.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <ArrowRight className="h-4 w-4 mr-1" />}
              Avançar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Despacho Dialog */}
      <Dialog open={despachoDialogOpen} onOpenChange={setDespachoDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-sm">
              <Send className="h-4 w-4 text-primary" />
              Despachar para Módulo
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-2">
              {DESPACHO_MODULOS.map((mod) => {
                const ModIcon = mod.icon;
                const isSelected = despachoModulo === mod.key;
                return (
                  <button
                    key={mod.key}
                    onClick={() => setDespachoModulo(mod.key)}
                    className={cn(
                      "rounded-lg border p-3 text-left transition-all",
                      isSelected
                        ? "bg-primary/10 border-primary/40 shadow-sm"
                        : "bg-card hover:bg-accent/30 border-border"
                    )}
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <ModIcon className={cn("h-4 w-4", isSelected ? "text-primary" : "text-muted-foreground")} />
                      <span className="text-xs font-semibold">{mod.label}</span>
                    </div>
                    <p className="text-[10px] text-muted-foreground">{mod.description}</p>
                  </button>
                );
              })}
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground block mb-1.5">Observação</label>
              <Textarea
                value={despachoObs}
                onChange={(e) => setDespachoObs(e.target.value)}
                placeholder="Instruções para o módulo destino..."
                rows={2}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setDespachoDialogOpen(false)}>Cancelar</Button>
            <Button size="sm" onClick={handleDespacho} disabled={!despachoModulo || addEvent.isPending}>
              {addEvent.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Send className="h-4 w-4 mr-1" />}
              Despachar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
