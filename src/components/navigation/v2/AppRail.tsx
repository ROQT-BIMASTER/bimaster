/**
 * AppRail — rail vertical de 68px da navegação v2.
 *
 * - Lista módulos agrupados por categoria (dividers entre grupos).
 * - Hover → tooltip rica (nome + nº de páginas + "você está aqui").
 * - Click → popover lateral com as páginas do módulo (NÃO expande o rail).
 * - Sticky no topo: sino global (delegado ao header existente).
 * - Sticky no rodapé: botão do Launcher (⌘K).
 *
 * Default 'v1' — só é montado quando `nav_version='v2'` está ativo via
 * <SidebarSwitch/>.
 */
import { useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { LayoutGrid, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import logoHuugs from "@/assets/logo-huugs.jpg";
import { resolveIcon } from "./icon";
import { ContextualSidebar } from "./ContextualSidebar";
import { Launcher } from "./Launcher";
import { RecordRecents } from "./launcher/RecordRecents";
import { findActiveModule, useNavV2Data, type NavV2Module } from "./useNavV2Data";

const RAIL_WIDTH = 68;

interface AppRailProps {
  side?: "left" | "right";
}

export function AppRail({ side = "left" }: AppRailProps) {
  const { categories, isLoading } = useNavV2Data();
  const location = useLocation();
  const navigate = useNavigate();
  const [openModuleCode, setOpenModuleCode] = useState<string | null>(null);
  const [launcherOpen, setLauncherOpen] = useState(false);

  const active = findActiveModule(categories, location.pathname);

  const handleModuleClick = (module: NavV2Module) => {
    // Click: abre popover. Se módulo tem apenas 1 página, navega direto.
    if (module.pages.length === 1) {
      navigate(module.pages[0].route);
      setOpenModuleCode(null);
      return;
    }
    setOpenModuleCode((cur) => (cur === module.code ? null : module.code));
  };

  return (
    <TooltipProvider delayDuration={500}>
      <aside
        aria-label="Navegação principal"
        className={cn(
          "sticky top-0 h-screen flex flex-col bg-sidebar text-sidebar-foreground border-border",
          side === "left" ? "border-r" : "border-l",
        )}
        style={{ width: RAIL_WIDTH, minWidth: RAIL_WIDTH }}
      >
        {/* Logo / topo sticky */}
        <div className="flex items-center justify-center h-[52px] border-b border-border shrink-0">
          <img src={logoHuugs} alt="Logo" className="h-8 w-8 rounded object-cover" />
        </div>

        {/* Lista de módulos */}
        <div className="flex-1 overflow-y-auto overflow-x-hidden py-2 flex flex-col gap-1">
          {isLoading && (
            <div className="flex items-center justify-center py-4">
              <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
            </div>
          )}

          {categories.map((cat, idx) => (
            <div key={cat.key} className="flex flex-col items-center gap-1">
              {idx > 0 && <div className="h-px w-8 bg-border my-1" />}
              {cat.modules.map((mod) => {
                const Icon = resolveIcon(mod.icon);
                const isActive = active?.module.code === mod.code;
                const isOpen = openModuleCode === mod.code;

                return (
                  <Popover
                    key={mod.code}
                    open={isOpen}
                    onOpenChange={(o) => setOpenModuleCode(o ? mod.code : null)}
                  >
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <PopoverTrigger asChild>
                          <button
                            type="button"
                            aria-label={mod.label}
                            aria-current={isActive ? "page" : undefined}
                            onClick={() => handleModuleClick(mod)}
                            className={cn(
                              "relative flex items-center justify-center rounded-lg transition-all duration-150",
                              "h-11 w-11 shrink-0",
                              isActive
                                ? "bg-[hsl(var(--primary)/0.12)] text-primary"
                                : "text-muted-foreground hover:text-foreground hover:bg-muted/60",
                              isOpen && !isActive && "bg-muted/60 text-foreground",
                            )}
                          >
                            <Icon className="h-5 w-5" />
                            {isActive && (
                              <span className="absolute left-0 top-2 bottom-2 w-0.5 rounded-r bg-primary" />
                            )}
                          </button>
                        </PopoverTrigger>
                      </TooltipTrigger>
                      <TooltipContent side={side === "left" ? "right" : "left"} className="max-w-[220px]">
                        <div className="text-xs font-semibold">{mod.label}</div>
                        <div className="text-[10px] text-muted-foreground">
                          {mod.pages.length} {mod.pages.length === 1 ? "página" : "páginas"}
                          {isActive ? " · você está aqui" : ""}
                        </div>
                      </TooltipContent>
                    </Tooltip>
                    <PopoverContent
                      side={side === "left" ? "right" : "left"}
                      align="start"
                      sideOffset={8}
                      className="p-0 w-auto"
                    >
                      <ContextualSidebar
                        module={mod}
                        currentPath={location.pathname}
                        onNavigate={() => setOpenModuleCode(null)}
                      />
                    </PopoverContent>
                  </Popover>
                );
              })}
            </div>
          ))}
        </div>

        {/* Rodapé sticky: launcher */}
        <div className="border-t border-border p-2 flex items-center justify-center shrink-0">
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                type="button"
                aria-label="Abrir launcher (⌘K)"
                onClick={() => setLauncherOpen(true)}
                className={cn(
                  "flex items-center justify-center h-10 w-10 rounded-lg",
                  "text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors",
                )}
              >
                <LayoutGrid className="h-5 w-5" />
              </button>
            </TooltipTrigger>
            <TooltipContent side={side === "left" ? "right" : "left"}>
              <div className="text-xs">Launcher</div>
              <div className="text-[10px] text-muted-foreground">⌘K</div>
            </TooltipContent>
          </Tooltip>
        </div>
      </aside>

      <Launcher open={launcherOpen} onOpenChange={setLauncherOpen} />
      <RecordRecents categories={categories} />

    </TooltipProvider>
  );
}
