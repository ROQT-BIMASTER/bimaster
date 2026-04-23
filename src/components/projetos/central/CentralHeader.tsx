import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import { Plus, LayoutDashboard, RotateCcw, Link2, Check, Settings } from "lucide-react";
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
  AlertDialogTrigger,
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
  isResetting?: boolean;
  preferences?: CentralPreferences;
}

export function CentralHeader({
  bgColor,
  onBgColorChange,
  onResetPreferences,
  isResetting,
  preferences,
}: Props) {
  const { user } = useAuth();
  const [showNewTask, setShowNewTask] = useState(false);
  const [copied, setCopied] = useState(false);

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
                <TooltipContent>
                  Copiar link com a aba, visualização e filtros das suas preferências
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}
          {onResetPreferences && (
            <AlertDialog>
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <AlertDialogTrigger asChild>
                      <Button
                        size="sm"
                        variant="outline"
                        className="gap-1.5"
                        disabled={isResetting}
                      >
                        <RotateCcw className={`h-4 w-4 ${isResetting ? "animate-spin" : ""}`} />
                        <span className="hidden sm:inline">Restaurar padrão</span>
                      </Button>
                    </AlertDialogTrigger>
                  </TooltipTrigger>
                  <TooltipContent>
                    Voltar ao contexto inicial do sistema
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
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
                    </div>
                  );
                })()}

                <AlertDialogFooter>
                  <AlertDialogCancel>Cancelar</AlertDialogCancel>
                  <AlertDialogAction onClick={() => onResetPreferences()}>
                    Restaurar
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
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
