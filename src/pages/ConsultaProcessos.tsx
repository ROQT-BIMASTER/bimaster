import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { format, differenceInDays, differenceInHours } from "date-fns";
import { ptBR } from "date-fns/locale";
import { ArrowLeft, Search, Scale, Filter, Clock, UserCircle, CheckCircle2, ChevronDown, ChevronRight, FileText, Loader2 } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import { type ProductProcess, type ProcessEvent, type ProcessStepHistory } from "@/hooks/useProductProcess";
import { useEtapasConfig } from "@/hooks/useEtapasConfig";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";

const STATUS_STYLE: Record<string, { bg: string; text: string; label: string }> = {
  em_andamento: { bg: "bg-blue-500/10", text: "text-blue-600", label: "Em Andamento" },
  aprovado: { bg: "bg-emerald-500/10", text: "text-emerald-600", label: "Aprovado" },
  reprovado: { bg: "bg-destructive/10", text: "text-destructive", label: "Reprovado" },
  cancelado: { bg: "bg-muted", text: "text-muted-foreground", label: "Cancelado" },
};

const TIPO_LABELS: Record<string, string> = {
  china: "China",
  brasil: "Brasil",
  fabrica: "Fábrica",
};

const EVENT_ICON_COLORS: Record<string, string> = {
  criacao: "text-emerald-500",
  edicao: "text-blue-500",
  aprovacao: "text-emerald-500",
  aprovado: "text-emerald-500",
  reprovacao: "text-destructive",
  reprovar: "text-destructive",
  etapa_change: "text-purple-500",
  status_change: "text-purple-400",
  documento: "text-amber-500",
  upload: "text-blue-400",
  INSERT: "text-emerald-500",
  UPDATE: "text-blue-500",
};

const MODULE_BADGE_STYLES: Record<string, string> = {
  fabrica: "bg-orange-500/10 text-orange-600 border-orange-200",
  brasil: "bg-green-500/10 text-green-600 border-green-200",
  china: "bg-red-500/10 text-red-600 border-red-200",
  documentos: "bg-blue-500/10 text-blue-600 border-blue-200",
  aprovacao: "bg-purple-500/10 text-purple-600 border-purple-200",
  processo: "bg-primary/10 text-primary border-primary/20",
  manual: "bg-muted text-muted-foreground border-border",
};

export default function ConsultaProcessos() {
  const navigate = useNavigate();
  const [searchTerm, setSearchTerm] = useState("");
  const [tipoFilter, setTipoFilter] = useState<string>("todos");
  const [selectedProcessId, setSelectedProcessId] = useState<string | null>(null);
  const [movimentacoesLimit, setMovimentacoesLimit] = useState(50);

  // Search processes
  const { data: processos = [], isLoading: searchLoading } = useQuery({
    queryKey: ["consulta-processos", searchTerm, tipoFilter],
    queryFn: async () => {
      let query = supabase
        .from("product_process" as any)
        .select("*")
        .order("created_at", { ascending: false })
        .limit(50) as any;

      if (tipoFilter !== "todos") {
        query = query.eq("produto_tipo", tipoFilter);
      }

      if (searchTerm.trim()) {
        query = query.or(`numero_processo.ilike.%${searchTerm}%,produto_ref_id.ilike.%${searchTerm}%`);
      }

      const { data, error } = await query;
      if (error) throw error;
      return (data || []) as ProductProcess[];
    },
    enabled: searchTerm.length >= 2 || tipoFilter !== "todos",
  });

  const selectedProcess = processos.find(p => p.id === selectedProcessId) || null;

  // Events for selected process
  const { data: events = [], isLoading: eventsLoading } = useQuery({
    queryKey: ["consulta-process-events", selectedProcessId, movimentacoesLimit],
    queryFn: async () => {
      const { data, error } = await (supabase
        .from("process_events" as any)
        .select("*")
        .eq("process_id", selectedProcessId!)
        .order("created_at", { ascending: false })
        .limit(movimentacoesLimit) as any);
      if (error) throw error;
      return (data || []) as ProcessEvent[];
    },
    enabled: !!selectedProcessId,
  });

  // Unified timeline
  const { data: timelineEvents = [] } = useQuery({
    queryKey: ["consulta-timeline", selectedProcess?.produto_ref_id],
    queryFn: async () => {
      const { data, error } = await (supabase
        .from("vw_process_timeline" as any)
        .select("*")
        .eq("entity_id", selectedProcess!.produto_ref_id)
        .order("created_at", { ascending: false })
        .limit(200) as any);
      if (error) throw error;
      return (data || []) as any[];
    },
    enabled: !!selectedProcess?.produto_ref_id,
  });

  // Step history
  const { data: stepHistory = [], isLoading: stepsLoading } = useQuery({
    queryKey: ["consulta-step-history", selectedProcessId],
    queryFn: async () => {
      const { data, error } = await (supabase
        .from("process_step_history" as any)
        .select("*")
        .eq("process_id", selectedProcessId!)
        .order("created_at", { ascending: true }) as any);
      if (error) throw error;
      return (data || []) as ProcessStepHistory[];
    },
    enabled: !!selectedProcessId,
  });

  // Combined timeline (deduplicated)
  const combinedTimeline = useMemo(() => {
    return [...events, ...timelineEvents]
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
      .filter((item, index, arr) => arr.findIndex(x => x.id === item.id) === index);
  }, [events, timelineEvents]);

  // Progress calc
  const etapaAtualIndex = selectedProcess
    ? ETAPAS_CICLO_VIDA.findIndex(e => e.key === selectedProcess.etapa_atual)
    : -1;
  const progressPercent = etapaAtualIndex >= 0
    ? Math.round(((etapaAtualIndex + 1) / ETAPAS_CICLO_VIDA.length) * 100)
    : 0;

  function formatDuration(minutes: number | null): string {
    if (!minutes) return "—";
    const days = Math.floor(minutes / 1440);
    const hours = Math.floor((minutes % 1440) / 60);
    if (days > 0) return `${days}d ${hours}h`;
    if (hours > 0) return `${hours}h`;
    return `${minutes}min`;
  }

  function calcLiveDuration(dataInicio: string | null): string {
    if (!dataInicio) return "—";
    const start = new Date(dataInicio);
    const now = new Date();
    const days = differenceInDays(now, start);
    const hours = differenceInHours(now, start) % 24;
    if (days > 0) return `${days}d ${hours}h`;
    return `${hours}h`;
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-6xl mx-auto p-4 md:p-6 space-y-6">
        {/* Header */}
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-xl font-bold text-foreground flex items-center gap-2">
              <Scale className="h-5 w-5 text-primary" />
              Consulta de Processos
            </h1>
            <p className="text-sm text-muted-foreground">
              Busque e acompanhe movimentações do ciclo de vida dos produtos
            </p>
          </div>
        </div>

        {/* Search bar */}
        <Card>
          <CardContent className="p-4">
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar por nº do processo ou referência..."
                  value={searchTerm}
                  onChange={e => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
              <Select value={tipoFilter} onValueChange={setTipoFilter}>
                <SelectTrigger className="w-full sm:w-40">
                  <SelectValue placeholder="Tipo" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos os tipos</SelectItem>
                  <SelectItem value="china">China</SelectItem>
                  <SelectItem value="brasil">Brasil</SelectItem>
                  <SelectItem value="fabrica">Fábrica</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Results list */}
            {searchLoading && (
              <div className="flex items-center gap-2 mt-4 text-muted-foreground text-sm">
                <Loader2 className="h-4 w-4 animate-spin" /> Buscando...
              </div>
            )}
            {processos.length > 0 && (
              <div className="mt-4 space-y-1 max-h-48 overflow-y-auto">
                {processos.map(p => {
                  const s = STATUS_STYLE[p.status] || STATUS_STYLE.em_andamento;
                  const isSelected = selectedProcessId === p.id;
                  return (
                    <button
                      key={p.id}
                      onClick={() => {
                        setSelectedProcessId(p.id);
                        setMovimentacoesLimit(50);
                      }}
                      className={cn(
                        "w-full text-left px-3 py-2 rounded-lg border transition-all text-sm flex items-center justify-between gap-2",
                        isSelected
                          ? "bg-primary/5 border-primary/30 ring-1 ring-primary/20"
                          : "bg-background border-border/50 hover:bg-muted/50"
                      )}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <span className="font-mono font-medium text-foreground truncate">
                          {p.numero_processo}
                        </span>
                        <Badge variant="outline" className="text-[10px] shrink-0">
                          {TIPO_LABELS[p.produto_tipo] || p.produto_tipo}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <Badge className={cn("text-[10px]", s.bg, s.text)}>{s.label}</Badge>
                        <span className="text-[10px] text-muted-foreground">
                          {format(new Date(p.created_at), "dd/MM/yy", { locale: ptBR })}
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
            {!searchLoading && processos.length === 0 && (searchTerm.length >= 2 || tipoFilter !== "todos") && (
              <p className="text-sm text-muted-foreground mt-4 text-center py-4">
                Nenhum processo encontrado.
              </p>
            )}
          </CardContent>
        </Card>

        {/* Selected process details */}
        {selectedProcess && (
          <div className="space-y-4">
            {/* Process header */}
            <Card>
              <CardContent className="p-4 space-y-4">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <div className="flex items-center gap-3">
                    <Scale className="h-5 w-5 text-primary" />
                    <div>
                      <h2 className="text-lg font-bold text-foreground">
                        Processo {selectedProcess.numero_processo}
                      </h2>
                      <p className="text-xs text-muted-foreground">
                        Ref: {selectedProcess.produto_ref_id?.slice(0, 8)}...
                      </p>
                    </div>
                  </div>
                  <Badge className={cn("text-xs", (STATUS_STYLE[selectedProcess.status] || STATUS_STYLE.em_andamento).bg, (STATUS_STYLE[selectedProcess.status] || STATUS_STYLE.em_andamento).text)}>
                    {(STATUS_STYLE[selectedProcess.status] || STATUS_STYLE.em_andamento).label}
                  </Badge>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
                  <div className="bg-muted/50 rounded-lg p-3">
                    <span className="text-[11px] text-muted-foreground block">Tipo</span>
                    <span className="font-medium text-foreground">{TIPO_LABELS[selectedProcess.produto_tipo]}</span>
                  </div>
                  <div className="bg-muted/50 rounded-lg p-3">
                    <span className="text-[11px] text-muted-foreground block">Etapa Atual</span>
                    <span className="font-medium text-foreground">
                      {ETAPAS_CICLO_VIDA.find(e => e.key === selectedProcess.etapa_atual)?.label || selectedProcess.etapa_atual}
                    </span>
                  </div>
                  <div className="bg-muted/50 rounded-lg p-3">
                    <span className="text-[11px] text-muted-foreground block">Criado em</span>
                    <span className="font-medium text-foreground">
                      {format(new Date(selectedProcess.created_at), "dd/MM/yyyy", { locale: ptBR })}
                    </span>
                  </div>
                  <div className="bg-muted/50 rounded-lg p-3">
                    <span className="text-[11px] text-muted-foreground block">Progresso</span>
                    <span className="font-medium text-foreground">{progressPercent}%</span>
                  </div>
                </div>

                {/* Lifecycle bar */}
                <div className="space-y-2">
                  <Progress value={progressPercent} className="h-2" />
                  <div className="flex flex-wrap gap-1">
                    {ETAPAS_CICLO_VIDA.map((etapa, i) => {
                      const isCurrent = etapa.key === selectedProcess.etapa_atual;
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
                </div>
              </CardContent>
            </Card>

            {/* Movimentações */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                  <FileText className="h-4 w-4 text-primary" />
                  Movimentações
                  <Badge variant="secondary" className="text-[10px] ml-auto">
                    {combinedTimeline.length} eventos
                  </Badge>
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-0">
                {eventsLoading ? (
                  <div className="flex items-center gap-2 py-8 justify-center text-muted-foreground text-sm">
                    <Loader2 className="h-4 w-4 animate-spin" /> Carregando movimentações...
                  </div>
                ) : combinedTimeline.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-8">
                    Nenhuma movimentação registrada.
                  </p>
                ) : (
                  <>
                    <ScrollArea className="max-h-[400px]">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead className="w-32 text-xs">Data</TableHead>
                            <TableHead className="text-xs">Movimentação</TableHead>
                            <TableHead className="w-24 text-xs">Módulo</TableHead>
                            <TableHead className="w-32 text-xs">Usuário</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {combinedTimeline.slice(0, movimentacoesLimit).map((event, idx) => {
                            const iconColor = EVENT_ICON_COLORS[event.tipo_evento] || "text-muted-foreground";
                            const moduleBadge = MODULE_BADGE_STYLES[event.modulo_origem] || MODULE_BADGE_STYLES.manual;
                            return (
                              <TableRow key={`${event.id}-${idx}`}>
                                <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                                  <div className="flex items-center gap-1">
                                    <Clock className="h-3 w-3" />
                                    {format(new Date(event.created_at), "dd/MM/yy HH:mm", { locale: ptBR })}
                                  </div>
                                </TableCell>
                                <TableCell className="text-xs">
                                  <span className={cn("font-medium", iconColor)}>
                                    {event.descricao || event.tipo_evento}
                                  </span>
                                </TableCell>
                                <TableCell>
                                  <Badge variant="outline" className={cn("text-[9px] px-1.5 py-0 h-4 border", moduleBadge)}>
                                    {event.modulo_origem}
                                  </Badge>
                                </TableCell>
                                <TableCell className="text-xs text-muted-foreground">
                                  {event.usuario_nome && (
                                    <span className="flex items-center gap-1">
                                      <UserCircle className="h-3 w-3" />
                                      {event.usuario_nome}
                                    </span>
                                  )}
                                </TableCell>
                              </TableRow>
                            );
                          })}
                        </TableBody>
                      </Table>
                    </ScrollArea>
                    {combinedTimeline.length > movimentacoesLimit && (
                      <div className="flex justify-center mt-3">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setMovimentacoesLimit(prev => prev + 50)}
                          className="text-xs"
                        >
                          <ChevronDown className="h-3 w-3 mr-1" />
                          Carregar mais ({movimentacoesLimit} de {combinedTimeline.length})
                        </Button>
                      </div>
                    )}
                  </>
                )}
              </CardContent>
            </Card>

            {/* Histórico de Etapas */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                  <Clock className="h-4 w-4 text-primary" />
                  Histórico de Etapas
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-0">
                {stepsLoading ? (
                  <div className="flex items-center gap-2 py-8 justify-center text-muted-foreground text-sm">
                    <Loader2 className="h-4 w-4 animate-spin" /> Carregando...
                  </div>
                ) : stepHistory.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-8">
                    Nenhum histórico de etapas registrado.
                  </p>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="text-xs">Etapa</TableHead>
                        <TableHead className="text-xs w-28">Status</TableHead>
                        <TableHead className="text-xs w-28">Início</TableHead>
                        <TableHead className="text-xs w-28">Fim</TableHead>
                        <TableHead className="text-xs w-24">Duração</TableHead>
                        <TableHead className="text-xs">Observação</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {stepHistory.map(step => {
                        const etapaInfo = ETAPAS_CICLO_VIDA.find(e => e.key === step.etapa);
                        const isActive = step.status === "em_andamento";
                        return (
                          <TableRow key={step.id} className={isActive ? "bg-primary/5" : ""}>
                            <TableCell className="text-xs font-medium">
                              {etapaInfo?.label || step.etapa}
                            </TableCell>
                            <TableCell>
                              <Badge
                                variant="outline"
                                className={cn(
                                  "text-[10px]",
                                  isActive
                                    ? "bg-blue-500/10 text-blue-600 border-blue-200"
                                    : "bg-emerald-500/10 text-emerald-600 border-emerald-200"
                                )}
                              >
                                {isActive ? "Em Andamento" : "Concluído"}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-xs text-muted-foreground">
                              {step.data_inicio
                                ? format(new Date(step.data_inicio), "dd/MM/yy", { locale: ptBR })
                                : "—"}
                            </TableCell>
                            <TableCell className="text-xs text-muted-foreground">
                              {step.data_fim
                                ? format(new Date(step.data_fim), "dd/MM/yy", { locale: ptBR })
                                : "—"}
                            </TableCell>
                            <TableCell className="text-xs font-medium">
                              {step.tempo_permanencia_minutos
                                ? formatDuration(step.tempo_permanencia_minutos)
                                : isActive
                                ? calcLiveDuration(step.data_inicio)
                                : "—"}
                            </TableCell>
                            <TableCell className="text-xs text-muted-foreground max-w-32 truncate">
                              {step.observacao || "—"}
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </div>
  );
}
