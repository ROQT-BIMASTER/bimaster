import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { ArrowLeft, Home, RotateCcw, Save, Settings } from "lucide-react";

import { SidebarProvider } from "@/components/ui/sidebar";
import { SidebarSwitch } from "@/components/navigation/v2/SidebarSwitch";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
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

import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useCentralPreferences } from "@/hooks/useCentralPreferences";
import {
  normalizeFilter,
  normalizePriority,
  normalizeProject,
  normalizeTab,
  normalizeView,
  type CentralFilter,
  type CentralPriority,
  type CentralTab,
  type CentralView,
} from "@/lib/centralUrlParams";

interface DraftPrefs {
  default_tab: CentralTab;
  default_view: CentralView;
  default_filter: CentralFilter;
  default_priority: CentralPriority;
  default_project: string;
}

const TAB_OPTIONS: { value: CentralTab; label: string; description: string }[] = [
  { value: "hoje", label: "Hoje", description: "Visão geral do dia ao abrir a Central" },
  { value: "tarefas", label: "Tarefas", description: "Lista completa das suas tarefas" },
  { value: "inbox", label: "Notificações", description: "Atividades recentes e menções" },
];

const VIEW_OPTIONS: { value: CentralView; label: string }[] = [
  { value: "list", label: "Lista" },
  { value: "board", label: "Quadro Kanban" },
  { value: "calendar", label: "Calendário" },
  { value: "dashboard", label: "Dashboard personalizado" },
];

const PRIORITY_OPTIONS: { value: CentralPriority; label: string }[] = [
  { value: "all", label: "Todas as prioridades" },
  { value: "urgente", label: "Urgente" },
  { value: "alta", label: "Alta" },
  { value: "media", label: "Média" },
  { value: "baixa", label: "Baixa" },
];

const FILTER_OPTIONS: { value: CentralFilter; label: string }[] = [
  { value: "all", label: "Todas" },
  { value: "atrasadas", label: "Apenas atrasadas" },
  { value: "hoje", label: "Apenas para hoje" },
];

export default function CentralPreferenciasConfig() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const {
    preferences,
    isLoading,
    save,
    isSaving,
    reset,
    isResetting,
    systemDefaults,
  } = useCentralPreferences();

  const [draft, setDraft] = useState<DraftPrefs>({
    default_tab: "hoje",
    default_view: "list",
    default_filter: "all",
    default_priority: "all",
    default_project: "all",
  });

  // Sync the draft with the latest stored preferences whenever they change.
  useEffect(() => {
    setDraft({
      default_tab: normalizeTab(preferences.default_tab, "hoje"),
      default_view: normalizeView(preferences.default_view, "list"),
      default_filter: normalizeFilter(preferences.default_filter, "all"),
      default_priority: normalizePriority(preferences.default_priority, "all"),
      default_project: normalizeProject(preferences.default_project, "all"),
    });
  }, [
    preferences.default_tab,
    preferences.default_view,
    preferences.default_filter,
    preferences.default_priority,
    preferences.default_project,
  ]);

  // Load the user's projects so they can pick a default project.
  const { data: projects = [], isLoading: projectsLoading } = useQuery({
    queryKey: ["central-prefs-projects", user?.id],
    queryFn: async () => {
      if (!user?.id) return [];
      const { data } = await supabase
        .from("projetos")
        .select("id, nome")
        .order("nome", { ascending: true });
      return (data || []) as { id: string; nome: string }[];
    },
    enabled: !!user?.id,
    staleTime: 60_000,
  });

  const isDirty = useMemo(() => {
    return (
      draft.default_tab !== normalizeTab(preferences.default_tab, "hoje") ||
      draft.default_view !== normalizeView(preferences.default_view, "list") ||
      draft.default_filter !== normalizeFilter(preferences.default_filter, "all") ||
      draft.default_priority !== normalizePriority(preferences.default_priority, "all") ||
      draft.default_project !== normalizeProject(preferences.default_project, "all")
    );
  }, [draft, preferences]);

  const tarefasMode = draft.default_tab === "tarefas";

  const handleSave = () => {
    save(draft, {
      onSuccess: () => {
        toast.success("Preferências salvas com sucesso");
      },
      onError: () => {
        toast.error("Não foi possível salvar as preferências");
      },
    });
  };

  const handleReset = async () => {
    try {
      await reset();
      toast.success("Preferências restauradas para o padrão do sistema");
    } catch {
      toast.error("Não foi possível restaurar as preferências");
    }
  };

  const handleRestoreDefaults = () => {
    setDraft({
      default_tab: systemDefaults.default_tab as CentralTab,
      default_view: systemDefaults.default_view as CentralView,
      default_filter: systemDefaults.default_filter as CentralFilter,
      default_priority: systemDefaults.default_priority as CentralPriority,
      default_project: systemDefaults.default_project,
    });
  };

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full bg-background">
        <SidebarSwitch />
        <main className="flex-1 overflow-auto">
          <div className="p-6 max-w-4xl mx-auto space-y-5">
            <Breadcrumb>
              <BreadcrumbList>
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
                  <BreadcrumbLink asChild>
                    <Link to="/dashboard/projetos/central">Central de Trabalho</Link>
                  </BreadcrumbLink>
                </BreadcrumbItem>
                <BreadcrumbSeparator />
                <BreadcrumbItem>
                  <BreadcrumbPage>Preferências</BreadcrumbPage>
                </BreadcrumbItem>
              </BreadcrumbList>
            </Breadcrumb>

            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
                  <ArrowLeft className="h-4 w-4" />
                </Button>
                <div>
                  <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
                    <Settings className="h-6 w-6 text-primary" />
                    Preferências da Central de Trabalho
                  </h1>
                  <p className="text-sm text-muted-foreground">
                    Defina manualmente como a Central deve abrir para você. As mudanças
                    só serão aplicadas após clicar em Salvar.
                  </p>
                </div>
              </div>
            </div>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Aba inicial</CardTitle>
                <CardDescription>
                  Qual aba a Central deve abrir por padrão quando você acessar sem
                  parâmetros na URL.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-2">
                <Label htmlFor="pref-tab">Aba padrão</Label>
                <Select
                  value={draft.default_tab}
                  onValueChange={(v) =>
                    setDraft((d) => ({ ...d, default_tab: v as CentralTab }))
                  }
                >
                  <SelectTrigger id="pref-tab" className="w-full sm:w-[320px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {TAB_OPTIONS.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value}>
                        <div className="flex flex-col">
                          <span>{opt.label}</span>
                          <span className="text-xs text-muted-foreground">{opt.description}</span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </CardContent>
            </Card>

            <Card className={tarefasMode ? "" : "opacity-60"}>
              <CardHeader>
                <CardTitle className="text-base">Visualização e filtros padrão</CardTitle>
                <CardDescription>
                  Aplicado quando a aba inicial é <span className="font-medium">Tarefas</span>.
                  {!tarefasMode && (
                    <span className="block mt-1 text-xs">
                      Selecione a aba Tarefas acima para habilitar essas opções.
                    </span>
                  )}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="pref-view">Visualização</Label>
                    <Select
                      value={draft.default_view}
                      onValueChange={(v) =>
                        setDraft((d) => ({ ...d, default_view: v as CentralView }))
                      }
                      disabled={!tarefasMode}
                    >
                      <SelectTrigger id="pref-view">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {VIEW_OPTIONS.map((opt) => (
                          <SelectItem key={opt.value} value={opt.value}>
                            {opt.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="pref-priority">Prioridade padrão</Label>
                    <Select
                      value={draft.default_priority}
                      onValueChange={(v) =>
                        setDraft((d) => ({ ...d, default_priority: v as CentralPriority }))
                      }
                      disabled={!tarefasMode}
                    >
                      <SelectTrigger id="pref-priority">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {PRIORITY_OPTIONS.map((opt) => (
                          <SelectItem key={opt.value} value={opt.value}>
                            {opt.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="pref-project">Projeto padrão</Label>
                    <Select
                      value={draft.default_project}
                      onValueChange={(v) =>
                        setDraft((d) => ({ ...d, default_project: v }))
                      }
                      disabled={!tarefasMode || projectsLoading}
                    >
                      <SelectTrigger id="pref-project">
                        <SelectValue placeholder={projectsLoading ? "Carregando..." : "Selecione"} />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">Todos os projetos</SelectItem>
                        {projects.map((p) => (
                          <SelectItem key={p.id} value={p.id}>
                            {p.nome}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="pref-filter">Filtro de tempo padrão</Label>
                    <Select
                      value={draft.default_filter}
                      onValueChange={(v) =>
                        setDraft((d) => ({ ...d, default_filter: v as CentralFilter }))
                      }
                      disabled={!tarefasMode}
                    >
                      <SelectTrigger id="pref-filter">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {FILTER_OPTIONS.map((opt) => (
                          <SelectItem key={opt.value} value={opt.value}>
                            {opt.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Separator />

            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-wrap items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleRestoreDefaults}
                  disabled={isLoading}
                >
                  Carregar padrões do sistema
                </Button>
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button
                      variant="outline"
                      size="sm"
                      className="gap-1.5"
                      disabled={isResetting || isLoading}
                    >
                      <RotateCcw className={`h-4 w-4 ${isResetting ? "animate-spin" : ""}`} />
                      Apagar minhas preferências
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Apagar preferências salvas?</AlertDialogTitle>
                      <AlertDialogDescription>
                        Suas preferências serão removidas do servidor e a Central
                        voltará ao contexto padrão do sistema. Esta ação não afeta
                        suas tarefas.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancelar</AlertDialogCancel>
                      <AlertDialogAction onClick={handleReset}>Apagar</AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>

              <div className="flex items-center gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => navigate("/dashboard/projetos/central")}
                >
                  Cancelar
                </Button>
                <Button
                  size="sm"
                  className="gap-1.5"
                  onClick={handleSave}
                  disabled={!isDirty || isSaving || isLoading}
                >
                  <Save className="h-4 w-4" />
                  {isSaving ? "Salvando..." : "Salvar preferências"}
                </Button>
              </div>
            </div>
          </div>
        </main>
      </div>
    </SidebarProvider>
  );
}
