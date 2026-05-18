import { useState } from "react";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import {
  Settings,
  RotateCcw,
  Filter,
  Save,
  Link2,
  Check,
  HelpCircle,
  ExternalLink,
  Loader2,
  Palette,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { ProjetoBgColorPicker } from "@/components/projetos/ProjetoBgColorPicker";
import {
  DEFAULTS,
  normalizeTab,
  normalizeView,
  normalizePriority,
  normalizeProject,
  normalizeFilter,
} from "@/lib/centralUrlParams";
import type { CentralPreferences } from "@/hooks/useCentralPreferences";

const TAB_LABELS: Record<string, string> = { hoje: "Hoje", tarefas: "Tarefas", inbox: "Notificações" };
const VIEW_LABELS: Record<string, string> = { list: "Lista", board: "Quadro", calendar: "Calendário", dashboard: "Dashboard" };
const PRIORITY_LABELS: Record<string, string> = { all: "Todas", urgente: "Urgente", alta: "Alta", media: "Média", baixa: "Baixa" };
const FILTER_LABELS: Record<string, string> = { all: "Todas", atrasadas: "Atrasadas", hoje: "Hoje" };

interface Props {
  bgColor: string | null;
  onBgColorChange: (color: string | null) => void;
  preferences?: CentralPreferences;
  onResetPreferences?: () => void | Promise<void>;
  onResetFiltersOnly?: () => void | Promise<void>;
  onSaveNow?: () => void | Promise<void>;
  isResetting?: boolean;
  isSavingNow?: boolean;
}

/**
 * Consolidated settings menu for the Central de Trabalho. Single gear button
 * collapses what used to be five separate toolbar buttons (Save, Share,
 * Reset, Preferences page, Help) plus the page background picker.
 */
export function CentralSettingsMenu({
  bgColor,
  onBgColorChange,
  preferences,
  onResetPreferences,
  onResetFiltersOnly,
  onSaveNow,
  isResetting,
  isSavingNow,
}: Props) {
  const [resetDialogOpen, setResetDialogOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  const handleCopyLink = async () => {
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

  return (
    <>
      <DropdownMenu>
        <TooltipProvider delayDuration={200}>
          <Tooltip>
            <TooltipTrigger asChild>
              <DropdownMenuTrigger asChild>
                <Button
                  size="sm"
                  variant="outline"
                  className="gap-1.5"
                  disabled={isResetting}
                  aria-label="Configurações da Central"
                >
                  {isResetting ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Settings className="h-4 w-4" />
                  )}
                  <span className="hidden md:inline">Configurar</span>
                </Button>
              </DropdownMenuTrigger>
            </TooltipTrigger>
            <TooltipContent>Aparência, preferências e ajuda da Central</TooltipContent>
          </Tooltip>
        </TooltipProvider>

        <DropdownMenuContent align="end" className="w-72">
          <DropdownMenuLabel className="flex items-center gap-2">
            <Palette className="h-3.5 w-3.5 text-muted-foreground" />
            Aparência
          </DropdownMenuLabel>
          <div className="px-2 pb-2 pt-1">
            <ProjetoBgColorPicker value={bgColor} onChange={onBgColorChange} />
          </div>

          <DropdownMenuSeparator />
          <DropdownMenuLabel>Preferências</DropdownMenuLabel>

          {onSaveNow && (
            <DropdownMenuItem
              onSelect={(e) => {
                e.preventDefault();
                onSaveNow();
              }}
              disabled={isSavingNow || isResetting}
              className="gap-2"
            >
              {isSavingNow ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Save className="h-4 w-4" />
              )}
              <div className="flex flex-col">
                <span>{isSavingNow ? "Salvando…" : "Salvar agora"}</span>
                <span className="text-xs text-muted-foreground">
                  Atualiza a data das suas preferências
                </span>
              </div>
            </DropdownMenuItem>
          )}

          <DropdownMenuItem onSelect={(e) => { e.preventDefault(); handleCopyLink(); }} className="gap-2">
            {copied ? (
              <Check className="h-4 w-4 text-success" />
            ) : (
              <Link2 className="h-4 w-4" />
            )}
            <div className="flex flex-col">
              <span>{copied ? "Link copiado" : "Compartilhar contexto"}</span>
              <span className="text-xs text-muted-foreground">
                Aba, visualização e filtros atuais
              </span>
            </div>
          </DropdownMenuItem>

          <DropdownMenuItem asChild className="gap-2">
            <Link to="/dashboard/projetos/central/preferencias">
              <ExternalLink className="h-4 w-4" />
              <div className="flex flex-col">
                <span>Abrir preferências completas</span>
                <span className="text-xs text-muted-foreground">
                  Página dedicada com todas as opções
                </span>
              </div>
            </Link>
          </DropdownMenuItem>

          {onResetPreferences && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuLabel>Restaurar</DropdownMenuLabel>

              <DropdownMenuItem
                onSelect={(e) => { e.preventDefault(); setResetDialogOpen(true); }}
                disabled={isResetting}
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
                  onSelect={(e) => { e.preventDefault(); onResetFiltersOnly(); }}
                  disabled={isResetting}
                  className="gap-2"
                >
                  <Filter className="h-4 w-4" />
                  <div className="flex flex-col">
                    <span>Apenas filtros e busca</span>
                    <span className="text-xs text-muted-foreground">
                      Mantém aba e visualização atuais
                    </span>
                  </div>
                </DropdownMenuItem>
              )}
            </>
          )}

          <DropdownMenuSeparator />
          <DropdownMenuItem asChild className="gap-2">
            <Link to="/dashboard/ajuda/projetos-visibilidade" target="_blank" rel="noopener noreferrer">
              <HelpCircle className="h-4 w-4" />
              <div className="flex flex-col">
                <span>Como funciona a visibilidade?</span>
                <span className="text-xs text-muted-foreground">
                  Quem vê o quê na Central e nos projetos
                </span>
              </div>
            </Link>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      {onResetPreferences && (
        <AlertDialog open={resetDialogOpen} onOpenChange={setResetDialogOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Restaurar preferências padrão?</AlertDialogTitle>
              <AlertDialogDescription>
                Suas preferências da Central de Trabalho serão apagadas e a tela
                voltará ao contexto definido pelo sistema. Esta ação não afeta suas tarefas.
              </AlertDialogDescription>
            </AlertDialogHeader>

            {(() => {
              const currentTab = normalizeTab(preferences?.default_tab ?? null, DEFAULTS.tab);
              const currentView = normalizeView(preferences?.default_view ?? null, DEFAULTS.view);
              const currentPriority = normalizePriority(preferences?.default_priority ?? null, DEFAULTS.priority);
              const currentFilter = normalizeFilter(preferences?.default_filter ?? null, DEFAULTS.filter);
              const currentProject = normalizeProject(preferences?.default_project ?? null, DEFAULTS.project);

              const rows = [
                { label: "Aba inicial", current: TAB_LABELS[currentTab] ?? currentTab, next: TAB_LABELS[DEFAULTS.tab] ?? DEFAULTS.tab, changed: currentTab !== DEFAULTS.tab },
                { label: "Visualização", current: VIEW_LABELS[currentView] ?? currentView, next: VIEW_LABELS[DEFAULTS.view] ?? DEFAULTS.view, changed: currentView !== DEFAULTS.view },
                { label: "Prioridade", current: PRIORITY_LABELS[currentPriority] ?? currentPriority, next: PRIORITY_LABELS[DEFAULTS.priority] ?? DEFAULTS.priority, changed: currentPriority !== DEFAULTS.priority },
                { label: "Filtro de tempo", current: FILTER_LABELS[currentFilter] ?? currentFilter, next: FILTER_LABELS[DEFAULTS.filter] ?? DEFAULTS.filter, changed: currentFilter !== DEFAULTS.filter },
                { label: "Projeto", current: currentProject === "all" ? "Todos" : "Projeto fixado", next: "Todos", changed: currentProject !== DEFAULTS.project },
              ];

              const anyChange = rows.some((r) => r.changed);
              return (
                <div className="rounded-md border bg-muted/40 px-3 py-2 text-xs space-y-1.5">
                  <div className="font-medium text-foreground/80 mb-1">O que será restaurado</div>
                  {rows.map((r) => (
                    <div key={r.label} className="flex items-center justify-between gap-2">
                      <span className="text-muted-foreground">{r.label}</span>
                      <span className="flex items-center gap-1.5">
                        <span className={r.changed ? "line-through text-muted-foreground" : "text-muted-foreground"}>{r.current}</span>
                        <span className="text-muted-foreground">→</span>
                        <span className={r.changed ? "font-medium text-foreground" : "text-muted-foreground"}>{r.next}</span>
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
                        onClick={() => { setResetDialogOpen(false); onResetFiltersOnly(); }}
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
              <AlertDialogAction onClick={() => onResetPreferences()}>Restaurar tudo</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}
    </>
  );
}
