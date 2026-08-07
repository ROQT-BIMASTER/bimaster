import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { SidebarProvider } from "@/components/ui/sidebar";
import { SidebarSwitch } from "@/components/navigation/v2/SidebarSwitch";
import { AppHeaderBar } from "@/components/dashboard/AppHeaderBar";
import {
  Breadcrumb, BreadcrumbItem, BreadcrumbLink, BreadcrumbList,
  BreadcrumbPage, BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle,
} from "@/components/ui/sheet";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { Home, Plus, MapPin, Clock, Repeat, Pencil, Trash2, ExternalLink, Share2, History, Bell, Tag, Search, X } from "lucide-react";
import { toast } from "sonner";
import { usePageBgColor } from "@/hooks/usePageBgColor";
import { getBgPaletteVars } from "@/lib/colorUtils";
import { TYPOGRAPHY_BODY_CLASS, typographyRootStyle } from "@/styles/typography";
import { UnifiedCalendar } from "@/components/calendario/UnifiedCalendar";
import { EventoCalendarioDialog } from "@/components/calendario/EventoCalendarioDialog";
import { CalendarioBoasVindasDialog } from "@/components/calendario/CalendarioBoasVindasDialog";
import { CalendarioExportDialog } from "@/components/calendario/CalendarioExportDialog";
import { QuickAddEventDialog } from "@/components/calendario/QuickAddEventDialog";
import { CalendarioHistoricoDialog } from "@/components/calendario/CalendarioHistoricoDialog";
import { CalendarioNotificacoesDialog } from "@/components/calendario/CalendarioNotificacoesDialog";
import {
  CalendarVisibilityScope, applyVisibilityScope,
  CALENDAR_SCOPE_STORAGE_KEY, type CalendarScope,
} from "@/components/calendario/CalendarVisibilityScope";
import { minaTarefaToEvent, eventoToCalendarEvent, type CalendarEvent } from "@/components/calendario/types";
import {
  CalendarFiltersBar, EMPTY_CALENDAR_FILTERS, applyCalendarFilters, applyCalendarBusca,
  normalizeCalendarFilters, countCalendarFilters,
  type CalendarFiltersState,
} from "@/components/calendario/CalendarFiltersBar";
import { useAuth } from "@/contexts/AuthContext";
import { useEquipesProjetos } from "@/hooks/useEquipesProjetos";
import { useMinhasTarefas } from "@/hooks/useMinhasTarefas";
import {
  useCalendarioEventos, useCalendarioEventosMutations, type CalendarioEvento,
} from "@/hooks/useCalendarioEventos";
import {
  useCalendarioPreferencias, useCalendarioPreferenciasMutations,
} from "@/hooks/useCalendarioPreferencias";
import { parseLocalDate } from "@/lib/utils/parseLocalDate";
import { format, differenceInCalendarDays } from "date-fns";
import { ptBR } from "date-fns/locale";

type Camada = "tarefas" | "eventos";

interface Reagendamento {
  evento: CalendarioEvento;
  novaData: string;
  deltaDias: number;
}


/**
 * Calendário Geral: consolida as tarefas de todos os projetos do usuário
 * com eventos avulsos (pessoais ou compartilhados) em uma única visão.
 */
export default function CalendarioGeral() {
  const { bgColor } = usePageBgColor("calendario-geral");
  const navigate = useNavigate();
  const { user } = useAuth();

  const { data: tarefas = [], isLoading: loadingTarefas } = useMinhasTarefas();
  const { data: eventos = [], isLoading: loadingEventos } = useCalendarioEventos();
  const { data: equipes = [] } = useEquipesProjetos();
  const { excluir, reagendar } = useCalendarioEventosMutations();

  const { data: prefs } = useCalendarioPreferencias();
  const { salvar: salvarPrefs } = useCalendarioPreferenciasMutations();

  const [filters, setFilters] = useState<CalendarFiltersState>(EMPTY_CALENDAR_FILTERS);
  const [busca, setBusca] = useState("");
  const [filtrosRestaurados, setFiltrosRestaurados] = useState(false);
  const [camadas, setCamadas] = useState<Camada[]>(["tarefas", "eventos"]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [quickOpen, setQuickOpen] = useState(false);
  const [quickData, setQuickData] = useState<string | null>(null);
  const [historicoOpen, setHistoricoOpen] = useState(false);
  const [notificacoesOpen, setNotificacoesOpen] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);
  const [dataInicial, setDataInicial] = useState<string | null>(null);
  const [editando, setEditando] = useState<CalendarioEvento | null>(null);
  const [selecionado, setSelecionado] = useState<CalendarEvent | null>(null);
  const [confirmandoExclusao, setConfirmandoExclusao] = useState<"unico" | "serie" | null>(null);
  const [reagendamento, setReagendamento] = useState<Reagendamento | null>(null);
  const [escopo, setEscopo] = useState<CalendarScope>(() => {
    try {
      const salvo = localStorage.getItem(CALENDAR_SCOPE_STORAGE_KEY) as CalendarScope | null;
      return salvo === "meus" || salvo === "equipe" || salvo === "todos" ? salvo : "todos";
    } catch {
      return "todos";
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem(CALENDAR_SCOPE_STORAGE_KEY, escopo);
    } catch {
      /* ignore */
    }
  }, [escopo]);

  // Restaura os filtros salvos do usuário na primeira carga.
  useEffect(() => {
    if (filtrosRestaurados || !prefs) return;
    setFilters(normalizeCalendarFilters(prefs.filtros));
    setFiltrosRestaurados(true);
  }, [prefs, filtrosRestaurados]);

  const eventosPorId = useMemo(() => new Map(eventos.map((e) => [e.id, e])), [eventos]);
  const tarefasPorId = useMemo(() => new Map(tarefas.map((t) => [t.id, t])), [tarefas]);

  const events = useMemo(() => {
    const deTarefas = camadas.includes("tarefas")
      ? applyCalendarFilters(tarefas.map(minaTarefaToEvent), filters, equipes)
      : [];
    // Eventos avulsos não têm projeto/responsável: só os filtros aplicáveis a eles.
    const deEventos = camadas.includes("eventos")
      ? applyCalendarFilters(
          eventos.map(eventoToCalendarEvent),
          {
            ...EMPTY_CALENDAR_FILTERS,
            status: filters.status,
            categorias: filters.categorias,
            tags: filters.tags,
          },
          equipes,
        )
      : [];
    const visiveis = applyVisibilityScope([...deTarefas, ...deEventos], {
      scope: escopo,
      userId: user?.id,
      equipes,
    });
    // Busca aplicada depois da visibilidade: nunca revela itens fora do escopo.
    return applyCalendarBusca(visiveis, busca);
  }, [tarefas, eventos, camadas, filters, equipes, escopo, user?.id, busca]);

  const responsaveis = useMemo(() => {
    const map = new Map<string, string>();
    tarefas.forEach((t) => {
      if (t.responsavel_id && t.responsavel_nome) map.set(t.responsavel_id, t.responsavel_nome);
    });
    return Array.from(map, ([id, nome]) => ({ id, nome })).sort((a, b) => a.nome.localeCompare(b.nome));
  }, [tarefas]);

  const projetos = useMemo(() => {
    const map = new Map<string, string>();
    tarefas.forEach((t) => { if (t.projeto_id) map.set(t.projeto_id, t.projeto_nome); });
    return Array.from(map, ([id, nome]) => ({ id, nome })).sort((a, b) => a.nome.localeCompare(b.nome));
  }, [tarefas]);

  const statusDisponiveis = useMemo(() => {
    const s = new Set<string>();
    tarefas.forEach((t) => t.status && s.add(t.status));
    if (eventos.length) s.add("evento");
    return Array.from(s).sort();
  }, [tarefas, eventos]);

  const categoriasDisponiveis = useMemo(
    () => Array.from(new Set(eventos.map((e) => e.categoria).filter(Boolean))).sort(),
    [eventos],
  );

  const tagsDisponiveis = useMemo(
    () => Array.from(new Set(eventos.flatMap((e) => e.tags ?? []))).sort(),
    [eventos],
  );

  const salvarFiltros = async () => {
    try {
      await salvarPrefs.mutateAsync({ filtros: filters as unknown as Record<string, unknown> });
      toast.success("Filtros salvos para as próximas visitas.");
    } catch (e: any) {
      toast.error(e?.message || "Não foi possível salvar os filtros.");
    }
  };

  const toggleCamada = (c: Camada) =>
    setCamadas((prev) => (prev.includes(c) ? prev.filter((x) => x !== c) : [...prev, c]));

  const eventoSelecionado = selecionado?.tipo === "evento" ? eventosPorId.get(selecionado.id) ?? null : null;

  /** Só o autor pode arrastar o próprio evento avulso. */
  const podeArrastar = (ev: CalendarEvent) => {
    if (ev.tipo !== "evento") return false;
    const original = eventosPorId.get(ev.id);
    return !!original && original.criado_por === user?.id;
  };

  const iniciarReagendamento = (ev: CalendarEvent, novaData: string) => {
    const original = eventosPorId.get(ev.id);
    if (!original) return;
    const de = parseLocalDate(original.data_inicio);
    const para = parseLocalDate(novaData);
    if (!de || !para) return;
    const deltaDias = differenceInCalendarDays(para, de);
    if (!deltaDias) return;
    setReagendamento({ evento: original, novaData, deltaDias });
  };

  const confirmarReagendamento = async (serie: boolean) => {
    if (!reagendamento) return;
    const { evento, deltaDias } = reagendamento;
    try {
      await reagendar.mutateAsync({
        id: evento.id,
        deltaDias,
        serie: serie ? evento.recorrencia_id : null,
      });
      toast.success(serie ? "Série reagendada." : "Evento reagendado.");
    } catch (e: any) {
      toast.error(e?.message || "Não foi possível reagendar o evento.");
    } finally {
      setReagendamento(null);
    }
  };

  const handleExcluir = async () => {
    if (!eventoSelecionado) return;
    try {
      await excluir.mutateAsync({
        id: eventoSelecionado.id,
        serie: confirmandoExclusao === "serie" ? eventoSelecionado.recorrencia_id : null,
      });
      toast.success(confirmandoExclusao === "serie" ? "Série excluída." : "Evento excluído.");
      setSelecionado(null);
    } catch (e: any) {
      toast.error(e?.message || "Não foi possível excluir o evento.");
    } finally {
      setConfirmandoExclusao(null);
    }
  };


  const formatarPeriodo = (ev: CalendarEvent) => {
    const ini = ev.data_inicio ? parseLocalDate(ev.data_inicio) : null;
    const fim = ev.data_prazo ? parseLocalDate(ev.data_prazo) : null;
    if (!ini) return "Sem data";
    const mesmoDia = !fim || ev.data_inicio === ev.data_prazo;
    const base = mesmoDia
      ? format(ini, "EEEE, dd 'de' MMMM 'de' yyyy", { locale: ptBR })
      : `${format(ini, "dd/MM/yyyy", { locale: ptBR })} — ${format(fim!, "dd/MM/yyyy", { locale: ptBR })}`;
    if (ev.hora_inicio) return `${base} · ${ev.hora_inicio}${ev.hora_fim ? ` às ${ev.hora_fim}` : ""}`;
    return base;
  };

  return (
    <SidebarProvider>
      <div className={`min-h-screen flex w-full bg-background ${TYPOGRAPHY_BODY_CLASS}`} style={typographyRootStyle}>
        <SidebarSwitch />
        <main
          className="flex-1 overflow-auto"
          style={
            bgColor
              ? ({ backgroundColor: bgColor, color: "hsl(var(--foreground))", ...getBgPaletteVars(bgColor) } as React.CSSProperties)
              : undefined
          }
        >
          <AppHeaderBar />
          <div className="p-4 sm:p-6 w-full space-y-4">
            <Breadcrumb className="hidden lg:flex min-h-[24px] items-center">
              <BreadcrumbList className="flex-nowrap">
                <BreadcrumbItem>
                  <BreadcrumbLink asChild>
                    <Link to="/dashboard" className="flex items-center gap-1">
                      <Home className="h-3.5 w-3.5" />
                      Dashboard
                    </Link>
                  </BreadcrumbLink>
                </BreadcrumbItem>
                <BreadcrumbSeparator />
                <BreadcrumbItem>
                  <BreadcrumbPage>Calendário</BreadcrumbPage>
                </BreadcrumbItem>
              </BreadcrumbList>
            </Breadcrumb>

            <header className="flex flex-wrap items-end justify-between gap-3">
              <div>
                <h1 className="text-xl font-semibold tracking-tight">Calendário</h1>
                <p className="text-sm text-muted-foreground">
                  Visão consolidada das tarefas de todos os projetos e dos seus compromissos.
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Button variant="outline" onClick={() => setNotificacoesOpen(true)}>
                  <Bell className="h-4 w-4 mr-1.5" />
                  Lembretes
                </Button>
                <Button variant="outline" onClick={() => setExportOpen(true)}>
                  <Share2 className="h-4 w-4 mr-1.5" />
                  Exportar / assinar
                </Button>
                <Button onClick={() => { setQuickData(null); setQuickOpen(true); }}>
                  <Plus className="h-4 w-4 mr-1.5" />
                  Novo evento
                </Button>
              </div>
            </header>

            <div className="rounded-lg border border-border bg-card/70 backdrop-blur-sm p-3 sm:p-4 space-y-3">
              <div className="flex flex-wrap items-center gap-4">
                <label className="flex items-center gap-2 text-sm">
                  <Checkbox checked={camadas.includes("tarefas")} onCheckedChange={() => toggleCamada("tarefas")} />
                  Tarefas de projetos
                  <Badge variant="secondary" className="ml-1">{tarefas.length}</Badge>
                </label>
                <label className="flex items-center gap-2 text-sm">
                  <Checkbox checked={camadas.includes("eventos")} onCheckedChange={() => toggleCamada("eventos")} />
                  Eventos
                  <Badge variant="secondary" className="ml-1">{eventos.length}</Badge>
                </label>
                <CalendarVisibilityScope scope={escopo} onChange={setEscopo} />
                <div className="relative flex-1 min-w-[200px] max-w-sm">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                  <Input
                    value={busca}
                    onChange={(e) => setBusca(e.target.value)}
                    placeholder="Buscar por título, descrição ou local"
                    aria-label="Buscar eventos"
                    className="h-8 pl-8 pr-8 text-xs"
                  />
                  {busca && (
                    <button
                      type="button"
                      aria-label="Limpar busca"
                      onClick={() => setBusca("")}
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
                {countCalendarFilters(filters) > 0 && (
                  <span className="flex items-center gap-1 text-xs text-muted-foreground">
                    <Tag className="h-3.5 w-3.5" />
                    {countCalendarFilters(filters)} filtro(s) ativo(s)
                  </span>
                )}
                {busca && (
                  <span className="text-xs text-muted-foreground">
                    {events.length} resultado(s)
                  </span>
                )}
              </div>

              <UnifiedCalendar
                events={events}
                onSelectEvent={setSelecionado}
                colorStrategy="projeto"
                onCreateAt={(dateKey) => { setQuickData(dateKey); setQuickOpen(true); }}
                onMoveEvent={iniciarReagendamento}
                canDragEvent={podeArrastar}
                rightToolbarExtra={
                  <CalendarFiltersBar
                    filters={filters}
                    onChange={setFilters}
                    equipes={equipes}
                    responsaveis={responsaveis}
                    projetos={projetos}
                    statusDisponiveis={statusDisponiveis}
                    categorias={categoriasDisponiveis}
                    tags={tagsDisponiveis}
                    footer={
                      <Button
                        variant="ghost"
                        size="sm"
                        className="w-full h-7 text-xs"
                        onClick={salvarFiltros}
                        disabled={salvarPrefs.isPending}
                      >
                        {salvarPrefs.isPending ? "Salvando..." : "Salvar filtros como padrão"}
                      </Button>
                    }
                  />
                }
              />

              {(loadingTarefas || loadingEventos) && (
                <p className="text-xs text-muted-foreground">Carregando compromissos...</p>
              )}
            </div>
          </div>
        </main>
      </div>

      <CalendarioBoasVindasDialog />

      <QuickAddEventDialog
        open={quickOpen}
        onOpenChange={setQuickOpen}
        data={quickData}
        onMaisOpcoes={(d) => { setEditando(null); setDataInicial(d); setDialogOpen(true); }}
      />

      <CalendarioNotificacoesDialog
        open={notificacoesOpen}
        onOpenChange={setNotificacoesOpen}
        eventos={events}
      />

      <CalendarioHistoricoDialog
        open={historicoOpen}
        onOpenChange={setHistoricoOpen}
        eventoId={eventoSelecionado?.id}
        recorrenciaId={eventoSelecionado?.recorrencia_id}
        titulo={eventoSelecionado?.titulo}
      />

      <CalendarioExportDialog
        open={exportOpen}
        onOpenChange={setExportOpen}
        events={events}
        equipes={equipes}
        responsaveis={responsaveis}
      />

      <AlertDialog open={!!reagendamento} onOpenChange={(v) => !v && setReagendamento(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Reagendar evento</AlertDialogTitle>
            <AlertDialogDescription>
              {reagendamento && (
                <>
                  Mover <strong>{reagendamento.evento.titulo}</strong> para{" "}
                  {format(parseLocalDate(reagendamento.novaData)!, "dd/MM/yyyy", { locale: ptBR })}
                  {reagendamento.evento.recorrencia_id
                    ? ". Este evento faz parte de uma série recorrente."
                    : "."}
                </>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            {reagendamento?.evento.recorrencia_id && (
              <Button variant="outline" onClick={() => confirmarReagendamento(true)}>
                Mover a série
              </Button>
            )}
            <AlertDialogAction onClick={() => confirmarReagendamento(false)}>
              Mover só esta ocorrência
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <EventoCalendarioDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        dataInicial={dataInicial}
        evento={editando}
      />

      <Sheet open={!!selecionado} onOpenChange={(v) => !v && setSelecionado(null)}>
        <SheetContent className="sm:max-w-md">
          {selecionado && (
            <>
              <SheetHeader>
                <SheetTitle className="flex items-start gap-2">
                  <span
                    aria-hidden
                    className="mt-1.5 h-3 w-3 rounded-full shrink-0"
                    style={{ backgroundColor: selecionado.cor || selecionado.projeto?.cor || "hsl(var(--primary))" }}
                  />
                  <span className="text-left">{selecionado.titulo}</span>
                </SheetTitle>
                <SheetDescription className="text-left">{formatarPeriodo(selecionado)}</SheetDescription>
              </SheetHeader>

              <div className="mt-4 space-y-3 text-sm">
                {selecionado.projeto && (
                  <div className="flex items-center gap-2">
                    <Badge variant="outline">{selecionado.projeto.nome}</Badge>
                    {selecionado.secao_nome && (
                      <span className="text-muted-foreground">{selecionado.secao_nome}</span>
                    )}
                  </div>
                )}

                {selecionado.local && (
                  <p className="flex items-center gap-2 text-muted-foreground">
                    <MapPin className="h-4 w-4 shrink-0" />
                    {selecionado.local}
                  </p>
                )}

                {selecionado.hora_inicio && (
                  <p className="flex items-center gap-2 text-muted-foreground">
                    <Clock className="h-4 w-4 shrink-0" />
                    {selecionado.hora_inicio}{selecionado.hora_fim ? ` às ${selecionado.hora_fim}` : ""}
                  </p>
                )}

                {selecionado.recorrencia_id && (
                  <p className="flex items-center gap-2 text-muted-foreground">
                    <Repeat className="h-4 w-4 shrink-0" />
                    Faz parte de uma série recorrente
                  </p>
                )}

                {selecionado.descricao && (
                  <p className="whitespace-pre-wrap text-muted-foreground">{selecionado.descricao}</p>
                )}

                {eventoSelecionado && eventoSelecionado.participantes.length > 0 && (
                  <p className="text-muted-foreground">
                    {eventoSelecionado.participantes.length} participante(s) convidado(s)
                  </p>
                )}
              </div>

              <div className="mt-6 flex flex-wrap gap-2">
                {eventoSelecionado ? (
                  <>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => { setEditando(eventoSelecionado); setDialogOpen(true); setSelecionado(null); }}
                    >
                      <Pencil className="h-4 w-4 mr-1.5" />
                      Editar
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => setConfirmandoExclusao("unico")}>
                      <Trash2 className="h-4 w-4 mr-1.5" />
                      Excluir
                    </Button>
                    {eventoSelecionado.recorrencia_id && (
                      <Button variant="ghost" size="sm" onClick={() => setConfirmandoExclusao("serie")}>
                        Excluir série
                      </Button>
                    )}
                    <Button variant="ghost" size="sm" onClick={() => setHistoricoOpen(true)}>
                      <History className="h-4 w-4 mr-1.5" />
                      Histórico
                    </Button>
                  </>
                ) : (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      const t = tarefasPorId.get(selecionado.id);
                      if (t) navigate(`/dashboard/projetos/${t.projeto_id}?tarefa=${t.id}`);
                    }}
                  >
                    <ExternalLink className="h-4 w-4 mr-1.5" />
                    Abrir tarefa
                  </Button>
                )}
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>

      <AlertDialog open={!!confirmandoExclusao} onOpenChange={(v) => !v && setConfirmandoExclusao(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {confirmandoExclusao === "serie" ? "Excluir toda a série?" : "Excluir evento?"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {confirmandoExclusao === "serie"
                ? "Todas as ocorrências desta série serão removidas do calendário."
                : "Esta ação não pode ser desfeita."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleExcluir}>Excluir</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </SidebarProvider>
  );
}
