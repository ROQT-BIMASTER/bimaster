import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import { Plus, LayoutDashboard, RotateCcw, Link2, Check, Settings, ChevronDown, Filter, Save, Loader2 } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Link } from "react-router-dom";
import { ProjetoBgColorPicker } from "@/components/projetos/ProjetoBgColorPicker";
import { NovaTarefaMinhasDialog } from "@/components/projetos/NovaTarefaMinhasDialog";
import {
  DEFAULTS,
  normalizeTab,
  normalizeView,
  normalizePriority,
  normalizeProject,
  normalizeFilter,
} from "@/lib/centralUrlParams";
import type { CentralPreferences } from "@/hooks/useCentralPreferences";

const TAB_LABELS: Record<string, string> = {
  hoje: "Hoje",
  tarefas: "Tarefas",
  inbox: "Notificações",
};
const VIEW_LABELS: Record<string, string> = {
  list: "Lista",
  board: "Quadro",
  calendar: "Calendário",
  dashboard: "Dashboard",
};
const PRIORITY_LABELS: Record<string, string> = {
  all: "Todas",
  urgente: "Urgente",
  alta: "Alta",
  media: "Média",
  baixa: "Baixa",
};
const FILTER_LABELS: Record<string, string> = {
  all: "Todas",
  atrasadas: "Atrasadas",
  hoje: "Hoje",
};
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

function getGreeting() {
  const h = new Date().getHours();
  if (h < 12) return "Bom dia";
  if (h < 18) return "Boa tarde";
  return "Boa noite";
}

interface Props {
  bgColor: string | null;
  onBgColorChange: (color: string | null) => void;
  onResetPreferences?: () => void | Promise<void>;
  onResetFiltersOnly?: () => void | Promise<void>;
  isResetting?: boolean;
  preferences?: CentralPreferences;
}

export function CentralHeader({
  bgColor,
  onBgColorChange,
  onResetPreferences,
  onResetFiltersOnly,
  isResetting,
  preferences,
}: Props) {
  const { user } = useAuth();
  const [showNewTask, setShowNewTask] = useState(false);
  const [copied, setCopied] = useState(false);
  const [resetDialogOpen, setResetDialogOpen] = useState(false);

  // Build a "Atualizadas em…" caption that exposes BOTH UTC and the user's
  // local time, with the resolved IANA timezone so it's unambiguous.
  const updatedAtCaption = (() => {
    const iso = preferences?.updated_at;
    if (!iso) return null;
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return null;

    const tz =
      Intl.DateTimeFormat().resolvedOptions().timeZone || "horário local";
    const localFmt = new Intl.DateTimeFormat("pt-BR", {
      dateStyle: "short",
      timeStyle: "medium",
    });
    const utcFmt = new Intl.DateTimeFormat("pt-BR", {
      dateStyle: "short",
      timeStyle: "medium",
      timeZone: "UTC",
    });

    return {
      local: `${localFmt.format(d)} (${tz})`,
      utc: `${utcFmt.format(d)} UTC`,
      iso: d.toISOString(),
    };
  })();

  const handleCopyPreferenceLink = async () => {
    const params = new URLSearchParams();
    const tab = normalizeTab(preferences?.default_tab, "hoje");
    params.set("tab", tab);

    if (tab === "tarefas") {
      const view = normalizeView(preferences?.default_view, "list");
      const priority = normalizePriority(preferences?.default_priority, "all");
      const project = normalizeProject(preferences?.default_project, "all");
      const filter = normalizeFilter(preferences?.default_filter, "all");
      if (view !== "list") params.set("view", view);
      if (priority !== "all") params.set("priority", priority);
      if (project !== "all") params.set("project", project);
      if (filter !== "all") params.set("filter", filter);
    } else {
      const filter = normalizeFilter(preferences?.default_filter, "all");
      if (filter !== "all") params.set("filter", filter);
    }

    const url = `${window.location.origin}/dashboard/projetos/central?${params.toString()}`;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      toast.success("Link copiado para a área de transferência");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Não foi possível copiar o link");
    }
  };

  const { data: profileData } = useQuery({
    queryKey: ["my-profile-name", user?.id],
    queryFn: async () => {
      if (!user?.id) return null;
      const { data } = await supabase.from("profiles").select("nome").eq("id", user.id).single();
      return data;
    },
    enabled: !!user?.id,
  });

  const firstName = profileData?.nome?.split(" ")[0] || user?.email?.split("@")[0] || "";
  const today = format(new Date(), "EEEE, d 'de' MMMM", { locale: ptBR });

  return (
    <>
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <SidebarTrigger />
          <ProjetoBgColorPicker value={bgColor} onChange={onBgColorChange} />
          <div>
            <p className="text-xs text-muted-foreground capitalize">{today}</p>
            <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
              <LayoutDashboard className="h-6 w-6 text-primary" />
              {getGreeting()}{firstName ? `, ${firstName}` : ""}
            </h1>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {preferences && (
            <TooltipProvider delayDuration={200}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    size="sm"
                    variant="outline"
                    className="gap-1.5"
                    onClick={handleCopyPreferenceLink}
                  >
                    {copied ? (
                      <Check className="h-4 w-4 text-success" />
                    ) : (
                      <Link2 className="h-4 w-4" />
                    )}
                    <span className="hidden sm:inline">
                      {copied ? "Link copiado" : "Compartilhar contexto"}
                    </span>
                  </Button>
                </TooltipTrigger>
                <TooltipContent className="max-w-xs">
                  <div>Copiar link com a aba, visualização e filtros das suas preferências</div>
                  {updatedAtCaption && (
                    <div className="mt-1.5 pt-1.5 border-t border-border/40 text-[11px] text-muted-foreground space-y-0.5">
                      <div className="font-medium text-foreground/80">Preferências atualizadas em</div>
                      <div>
                        <span className="text-foreground/70">Local:</span>{" "}
                        <time dateTime={updatedAtCaption.iso}>{updatedAtCaption.local}</time>
                      </div>
                      <div>
                        <span className="text-foreground/70">UTC:</span>{" "}
                        <time dateTime={updatedAtCaption.iso}>{updatedAtCaption.utc}</time>
                      </div>
                    </div>
                  )}
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}
          {onResetPreferences && (
            <>
              {/* Split button: ação primária (Restaurar tudo) + caret com opções. */}
              <div className="inline-flex items-stretch rounded-md shadow-sm">
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        size="sm"
                        variant="outline"
                        className="gap-1.5 rounded-r-none border-r-0"
                        disabled={isResetting}
                        onClick={() => setResetDialogOpen(true)}
                      >
                        <RotateCcw className={`h-4 w-4 ${isResetting ? "animate-spin" : ""}`} />
                        <span className="hidden sm:inline">Restaurar padrão</span>
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent className="max-w-xs">
                      <div>Voltar ao contexto inicial do sistema</div>
                      {updatedAtCaption && (
                        <div className="mt-1.5 pt-1.5 border-t border-border/40 text-[11px] text-muted-foreground space-y-0.5">
                          <div className="font-medium text-foreground/80">Última alteração das preferências</div>
                          <div>
                            <span className="text-foreground/70">Local:</span>{" "}
                            <time dateTime={updatedAtCaption.iso}>{updatedAtCaption.local}</time>
                          </div>
                          <div>
                            <span className="text-foreground/70">UTC:</span>{" "}
                            <time dateTime={updatedAtCaption.iso}>{updatedAtCaption.utc}</time>
                          </div>
                        </div>
                      )}
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      size="sm"
                      variant="outline"
                      className="px-2 rounded-l-none"
                      disabled={isResetting}
                      aria-label="Mais opções de restauração"
                    >
                      <ChevronDown className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-64">
                    <DropdownMenuLabel>Opções de restauração</DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      onSelect={(e) => {
                        e.preventDefault();
                        setResetDialogOpen(true);
                      }}
                      className="gap-2"
                    >
                      <RotateCcw className="h-4 w-4" />
                      <div className="flex flex-col">
                        <span>Restaurar tudo</span>
                        <span className="text-xs text-muted-foreground">
                          Aba, visualização e filtros
                        </span>
                      </div>
                    </DropdownMenuItem>
                    {onResetFiltersOnly && (
                      <DropdownMenuItem
                        onSelect={(e) => {
                          e.preventDefault();
                          onResetFiltersOnly();
                        }}
                        className="gap-2"
                      >
                        <Filter className="h-4 w-4" />
                        <div className="flex flex-col">
                          <span>Apenas filtros e busca</span>
                          <span className="text-xs text-muted-foreground">
                            Mantém a aba e a visualização atuais
                          </span>
                        </div>
                      </DropdownMenuItem>
                    )}
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>

              <AlertDialog open={resetDialogOpen} onOpenChange={setResetDialogOpen}>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Restaurar preferências padrão?</AlertDialogTitle>
                    <AlertDialogDescription>
                      Suas preferências da Central de Trabalho serão apagadas e a tela
                      voltará ao contexto definido pelo sistema. Esta ação não afeta suas tarefas.
                    </AlertDialogDescription>
                  </AlertDialogHeader>

                  {/* Resumo Atual → Padrão para o usuário conferir antes de confirmar. */}
                  {(() => {
                    const currentTab = normalizeTab(preferences?.default_tab ?? null, DEFAULTS.tab);
                    const currentView = normalizeView(preferences?.default_view ?? null, DEFAULTS.view);
                    const currentPriority = normalizePriority(
                      preferences?.default_priority ?? null,
                      DEFAULTS.priority,
                    );
                    const currentFilter = normalizeFilter(
                      preferences?.default_filter ?? null,
                      DEFAULTS.filter,
                    );
                    const currentProject = normalizeProject(
                      preferences?.default_project ?? null,
                      DEFAULTS.project,
                    );

                    const rows: Array<{
                      label: string;
                      current: string;
                      next: string;
                      changed: boolean;
                    }> = [
                      {
                        label: "Aba inicial",
                        current: TAB_LABELS[currentTab] ?? currentTab,
                        next: TAB_LABELS[DEFAULTS.tab] ?? DEFAULTS.tab,
                        changed: currentTab !== DEFAULTS.tab,
                      },
                      {
                        label: "Visualização",
                        current: VIEW_LABELS[currentView] ?? currentView,
                        next: VIEW_LABELS[DEFAULTS.view] ?? DEFAULTS.view,
                        changed: currentView !== DEFAULTS.view,
                      },
                      {
                        label: "Prioridade",
                        current: PRIORITY_LABELS[currentPriority] ?? currentPriority,
                        next: PRIORITY_LABELS[DEFAULTS.priority] ?? DEFAULTS.priority,
                        changed: currentPriority !== DEFAULTS.priority,
                      },
                      {
                        label: "Filtro de tempo",
                        current: FILTER_LABELS[currentFilter] ?? currentFilter,
                        next: FILTER_LABELS[DEFAULTS.filter] ?? DEFAULTS.filter,
                        changed: currentFilter !== DEFAULTS.filter,
                      },
                      {
                        label: "Projeto",
                        current: currentProject === "all" ? "Todos" : "Projeto fixado",
                        next: "Todos",
                        changed: currentProject !== DEFAULTS.project,
                      },
                    ];

                    const anyChange = rows.some((r) => r.changed);

                    return (
                      <div className="rounded-md border bg-muted/40 px-3 py-2 text-xs space-y-1.5">
                        <div className="font-medium text-foreground/80 mb-1">
                          O que será restaurado
                        </div>
                        {rows.map((r) => (
                          <div
                            key={r.label}
                            className="flex items-center justify-between gap-2"
                          >
                            <span className="text-muted-foreground">{r.label}</span>
                            <span className="flex items-center gap-1.5">
                              <span
                                className={
                                  r.changed
                                    ? "line-through text-muted-foreground"
                                    : "text-muted-foreground"
                                }
                              >
                                {r.current}
                              </span>
                              <span className="text-muted-foreground">→</span>
                              <span
                                className={
                                  r.changed
                                    ? "font-medium text-foreground"
                                    : "text-muted-foreground"
                                }
                              >
                                {r.next}
                              </span>
                            </span>
                          </div>
                        ))}
                        {!anyChange && (
                          <div className="pt-1 text-muted-foreground italic">
                            Suas preferências já estão iguais ao padrão do sistema.
                          </div>
                        )}
                        {onResetFiltersOnly && (
                          <div className="pt-2 mt-1 border-t border-border/60 text-[11px] text-muted-foreground">
                            Quer apagar apenas filtros e busca, mantendo aba e visualização?{" "}
                            <button
                              type="button"
                              className="underline underline-offset-2 hover:text-foreground"
                              onClick={() => {
                                setResetDialogOpen(false);
                                onResetFiltersOnly();
                              }}
                            >
                              Restaurar só filtros
                            </button>
                          </div>
                        )}
                      </div>
                    );
                  })()}

                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancelar</AlertDialogCancel>
                    <AlertDialogAction onClick={() => onResetPreferences()}>
                      Restaurar tudo
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </>
          )}
          <TooltipProvider delayDuration={200}>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button asChild size="sm" variant="outline" className="gap-1.5">
                  <Link to="/dashboard/projetos/central/preferencias">
                    <Settings className="h-4 w-4" />
                    <span className="hidden sm:inline">Preferências</span>
                  </Link>
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                Gerenciar manualmente suas preferências da Central
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
          <Button size="sm" className="gap-1.5" onClick={() => setShowNewTask(true)}>
            <Plus className="h-4 w-4" /> Nova Tarefa
          </Button>
        </div>
      </div>

      <NovaTarefaMinhasDialog open={showNewTask} onOpenChange={setShowNewTask} />
    </>
  );
}
