import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import {
  Plus,
  LayoutDashboard,
  ChevronDown,
  ClipboardList,
  FolderPlus,
  Sparkles,
  Trash2,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { NovaTarefaMinhasDialog } from "@/components/projetos/NovaTarefaMinhasDialog";
import { NovoProjetoDialog } from "@/components/projetos/NovoProjetoDialog";
import { ImpersonationSelector } from "@/components/admin/ImpersonationSelector";
import { ProfileAvatarUpload } from "@/components/shared/ProfileAvatarUpload";
import { CentralCopilotPanel } from "@/components/projetos/central/CentralCopilotPanel";
import { CentralSettingsMenu } from "@/components/projetos/central/CentralSettingsMenu";
import { ProjetoDensityToggle } from "@/components/projetos/ProjetoDensityToggle";
import { Badge } from "@/components/ui/badge";
import { MinhasTarefasLixeiraDialog, useMinhasTarefasLixeiraCount } from "@/components/minhas-tarefas/MinhasTarefasLixeiraDialog";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import type { CentralPreferences } from "@/hooks/useCentralPreferences";

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
  onSaveNow?: () => void | Promise<void>;
  isResetting?: boolean;
  isSavingNow?: boolean;
  preferences?: CentralPreferences;
}

/**
 * Minimal header for the Central de Trabalho. Aggregates personalization,
 * preferences, share and help under a single gear (CentralSettingsMenu),
 * leaving only Copiloto and Criar as visible action buttons. Inspired by
 * Linear / Asana / Height where page-level actions collapse into overflow.
 */
export function CentralHeader({
  bgColor,
  onBgColorChange,
  onResetPreferences,
  onResetFiltersOnly,
  onSaveNow,
  isResetting,
  isSavingNow,
  preferences,
}: Props) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [showNewTask, setShowNewTask] = useState(false);
  const [showNewProject, setShowNewProject] = useState(false);
  const [copilotOpen, setCopilotOpen] = useState(false);
  const [lixeiraOpen, setLixeiraOpen] = useState(false);
  const { data: lixeiraCount = 0 } = useMinhasTarefasLixeiraCount();

  // Ctrl/Cmd + J → toggle Copiloto
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && (e.key === "j" || e.key === "J")) {
        e.preventDefault();
        setCopilotOpen((o) => !o);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const { data: profileData } = useQuery({
    queryKey: ["my-profile-name", user?.id],
    queryFn: async () => {
      if (!user?.id) return null;
      const { data } = await supabase
        .from("profiles")
        .select("nome, avatar_url")
        .eq("id", user.id)
        .single();
      return data;
    },
    enabled: !!user?.id,
  });

  const firstName =
    profileData?.nome?.split(" ")[0] || user?.email?.split("@")[0] || "";
  const today = format(new Date(), "EEEE, d 'de' MMMM", { locale: ptBR });

  return (
    <>
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3 min-w-0">
          <SidebarTrigger />
          {user?.id && (
            <TooltipProvider delayDuration={200}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <span>
                    <ProfileAvatarUpload
                      userId={user.id}
                      currentAvatarUrl={profileData?.avatar_url}
                      userName={profileData?.nome || user.email || ""}
                      size="md"
                      editable
                      onUploadComplete={() => {
                        queryClient.invalidateQueries({
                          queryKey: ["my-profile-name", user.id],
                        });
                      }}
                    />
                  </span>
                </TooltipTrigger>
                <TooltipContent>Clique para atualizar sua foto</TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}
          <div className="min-w-0 hidden sm:block">
            <h1 className="text-base sm:text-xl font-semibold text-foreground flex items-center gap-2 truncate">
              <LayoutDashboard className="h-5 w-5 text-primary shrink-0" />
              <span className="truncate">
                <span className="hidden sm:inline">{getGreeting()}</span>
                {firstName ? <span className="sm:before:content-[',_']">{firstName}</span> : null}
              </span>
              <span className="hidden md:inline text-xs font-normal text-muted-foreground capitalize ml-2">
                · {today}
              </span>
            </h1>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <span className="hidden lg:inline-flex">
            <ImpersonationSelector />
          </span>

          <TooltipProvider delayDuration={200}>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  size="sm"
                  variant="outline"
                  className="gap-1.5 border-primary/40 text-primary hover:bg-primary/10"
                  onClick={() => setCopilotOpen(true)}
                >
                  <Sparkles className="h-4 w-4" />
                  <span className="hidden md:inline">Copiloto</span>
                </Button>
              </TooltipTrigger>
              <TooltipContent className="max-w-xs">
                Assistente pessoal multi-projeto. Atalho: Ctrl/Cmd + J
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>

          <ProjetoDensityToggle />

          <TooltipProvider delayDuration={200}>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  size="sm"
                  variant="ghost"
                  className="relative gap-1.5"
                  onClick={() => setLixeiraOpen(true)}
                  aria-label="Lixeira pessoal"
                >
                  <Trash2 className="h-4 w-4" />
                  <span className="hidden md:inline">Lixeira</span>
                  {lixeiraCount > 0 && (
                    <Badge variant="secondary" className="text-[10px] h-4 px-1 ml-0.5">
                      {lixeiraCount}
                    </Badge>
                  )}
                </Button>
              </TooltipTrigger>
              <TooltipContent className="max-w-xs">
                Tarefas excluídas por você nos últimos 30 dias. Restaure dentro do prazo.
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>


          <CentralSettingsMenu
            bgColor={bgColor}
            onBgColorChange={onBgColorChange}
            preferences={preferences}
            onResetPreferences={onResetPreferences}
            onResetFiltersOnly={onResetFiltersOnly}
            onSaveNow={onSaveNow}
            isResetting={isResetting}
            isSavingNow={isSavingNow}
          />

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button size="sm" className="gap-1.5">
                <Plus className="h-4 w-4" />
                Criar
                <ChevronDown className="h-3 w-3 ml-0.5" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => setShowNewTask(true)} className="gap-2">
                <ClipboardList className="h-4 w-4" />
                Nova Tarefa
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => setShowNewProject(true)} className="gap-2">
                <FolderPlus className="h-4 w-4" />
                Novo Projeto
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      <NovaTarefaMinhasDialog open={showNewTask} onOpenChange={setShowNewTask} />
      <NovoProjetoDialog open={showNewProject} onOpenChange={setShowNewProject} />
      <CentralCopilotPanel open={copilotOpen} onOpenChange={setCopilotOpen} />
    </>
  );
}
