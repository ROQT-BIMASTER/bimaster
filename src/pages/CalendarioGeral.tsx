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
import { Home, Plus, MapPin, Clock, Repeat, Pencil, Trash2, ExternalLink, Share2 } from "lucide-react";
import { toast } from "sonner";
import { usePageBgColor } from "@/hooks/usePageBgColor";
import { getBgPaletteVars } from "@/lib/colorUtils";
import { TYPOGRAPHY_BODY_CLASS, typographyRootStyle } from "@/styles/typography";
import { UnifiedCalendar } from "@/components/calendario/UnifiedCalendar";
import { EventoCalendarioDialog } from "@/components/calendario/EventoCalendarioDialog";
import { CalendarioBoasVindasDialog } from "@/components/calendario/CalendarioBoasVindasDialog";
import { CalendarioExportDialog } from "@/components/calendario/CalendarioExportDialog";
import {
  CalendarVisibilityScope, applyVisibilityScope,
  CALENDAR_SCOPE_STORAGE_KEY, type CalendarScope,
} from "@/components/calendario/CalendarVisibilityScope";
import { minaTarefaToEvent, eventoToCalendarEvent, type CalendarEvent } from "@/components/calendario/types";
import {
  CalendarFiltersBar, EMPTY_CALENDAR_FILTERS, applyCalendarFilters,
  type CalendarFiltersState,
} from "@/components/calendario/CalendarFiltersBar";
import { useAuth } from "@/contexts/AuthContext";
import { useEquipesProjetos } from "@/hooks/useEquipesProjetos";
import { useMinhasTarefas } from "@/hooks/useMinhasTarefas";
import {
  useCalendarioEventos, useCalendarioEventosMutations, type CalendarioEvento,
} from "@/hooks/useCalendarioEventos";
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

  const { data: tarefas = [], isLoading: loadingTarefas } = useMinhasTarefas();
  const { data: eventos = [], isLoading: loadingEventos } = useCalendarioEventos();
  const { data: equipes = [] } = useEquipesProjetos();
  const { excluir } = useCalendarioEventosMutations();

  const [filters, setFilters] = useState<CalendarFiltersState>(EMPTY_CALENDAR_FILTERS);
  const [camadas, setCamadas] = useState<Camada[]>(["tarefas", "eventos"]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [dataInicial, setDataInicial] = useState<string | null>(null);
  const [editando, setEditando] = useState<CalendarioEvento | null>(null);
  const [selecionado, setSelecionado] = useState<CalendarEvent | null>(null);
  const [confirmandoExclusao, setConfirmandoExclusao] = useState<"unico" | "serie" | null>(null);

  const eventosPorId = useMemo(() => new Map(eventos.map((e) => [e.id, e])), [eventos]);
  const tarefasPorId = useMemo(() => new Map(tarefas.map((t) => [t.id, t])), [tarefas]);

  const events = useMemo(() => {
    const deTarefas = camadas.includes("tarefas")
      ? applyCalendarFilters(tarefas.map(minaTarefaToEvent), filters, equipes)
      : [];
    const deEventos = camadas.includes("eventos") ? eventos.map(eventoToCalendarEvent) : [];
    return [...deTarefas, ...deEventos];
  }, [tarefas, eventos, camadas, filters, equipes]);

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

  const toggleCamada = (c: Camada) =>
    setCamadas((prev) => (prev.includes(c) ? prev.filter((x) => x !== c) : [...prev, c]));

  const eventoSelecionado = selecionado?.tipo === "evento" ? eventosPorId.get(selecionado.id) ?? null : null;

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
              <Button onClick={() => { setEditando(null); setDataInicial(null); setDialogOpen(true); }}>
                <Plus className="h-4 w-4 mr-1.5" />
                Novo evento
              </Button>
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
              </div>

              <UnifiedCalendar
                events={events}
                onSelectEvent={setSelecionado}
                colorStrategy="projeto"
                onCreateAt={(dateKey) => { setEditando(null); setDataInicial(dateKey); setDialogOpen(true); }}
                rightToolbarExtra={
                  <CalendarFiltersBar
                    filters={filters}
                    onChange={setFilters}
                    equipes={equipes}
                    responsaveis={responsaveis}
                    projetos={projetos}
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
