import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import { Plus, LayoutDashboard, RotateCcw, Link2, Check } from "lucide-react";
import { ProjetoBgColorPicker } from "@/components/projetos/ProjetoBgColorPicker";
import { NovaTarefaMinhasDialog } from "@/components/projetos/NovaTarefaMinhasDialog";
import {
  normalizeTab,
  normalizeView,
  normalizePriority,
  normalizeProject,
  normalizeFilter,
} from "@/lib/centralUrlParams";
import type { CentralPreferences } from "@/hooks/useCentralPreferences";
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
                    Suas preferências da Central de Trabalho (aba inicial, visualização e filtros)
                    serão apagadas e a tela voltará ao contexto definido pelo sistema.
                    Esta ação não afeta suas tarefas.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancelar</AlertDialogCancel>
                  <AlertDialogAction onClick={() => onResetPreferences()}>
                    Restaurar
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          )}
          <Button size="sm" className="gap-1.5" onClick={() => setShowNewTask(true)}>
            <Plus className="h-4 w-4" /> Nova Tarefa
          </Button>
        </div>
      </div>

      <NovaTarefaMinhasDialog open={showNewTask} onOpenChange={setShowNewTask} />
    </>
  );
}
