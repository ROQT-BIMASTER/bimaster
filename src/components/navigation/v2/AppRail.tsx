/**
 * AppRail — rail vertical de 68px da navegação v2.
 *
 * Estrutura (mockup aprovado):
 *  ┌──────┐
 *  │  H   │  logo
 *  │ ─── │
 *  │  🔍  │  busca (abre launcher)
 *  │      │
 *  │  📦• │  módulo (com indicador de pendências quando houver)
 *  │  📊  │
 *  │ ─── │  divisor de categoria
 *  │  💰 │
 *  │      │
 *  ├──────┤
 *  │  ▦  │  launcher
 *  │ (R) │  avatar do usuário
 *  └──────┘
 *
 * Default 'v1' — só é montado quando `nav_version='v2'` está ativo via
 * <SidebarSwitch/>.
 */
import { useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { LayoutGrid, Loader2, Search } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import logoHuugs from "@/assets/logo-huugs.jpg";
import { useAuth } from "@/contexts/AuthContext";
import { resolveIcon } from "./icon";
import { ContextualSidebar } from "./ContextualSidebar";
import { Launcher } from "./Launcher";
import { RecordRecents } from "./launcher/RecordRecents";
import { RailTooltipCard } from "./RailTooltipCard";
import { getModuleAccent } from "./launcher/moduleColors";
import { findActiveModule, useNavV2Data, type NavV2Module } from "./useNavV2Data";

const RAIL_WIDTH = 68;

interface AppRailProps {
  side?: "left" | "right";
}

function userInitial(email?: string | null): string {
  if (!email) return "?";
  return email.trim().charAt(0).toUpperCase();
}

export function AppRail({ side = "left" }: AppRailProps) {
  const { categories, isLoading } = useNavV2Data();
  const { user } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [openModuleCode, setOpenModuleCode] = useState<string | null>(null);
  const [launcherOpen, setLauncherOpen] = useState(false);

  const active = findActiveModule(categories, location.pathname);
  const tooltipSide = side === "left" ? "right" : "left";

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
    <TooltipProvider delayDuration={400}>
      <aside
        data-launcher-theme="dark"
        aria-label="Navegação principal"
        className={cn(
          "sticky top-0 h-screen flex flex-col",
          side === "left" ? "border-r" : "border-l",
        )}
        style={{
          width: RAIL_WIDTH,
          minWidth: RAIL_WIDTH,
          background: "hsl(var(--launcher-surface))",
          color: "hsl(var(--launcher-foreground))",
          borderColor: "hsl(var(--launcher-border))",
        }}
      >
        {/* Topo: logo */}
        <div
          className="flex items-center justify-center h-[56px] shrink-0"
          style={{ borderBottom: "1px solid hsl(var(--launcher-border))" }}
        >
          <img src={logoHuugs} alt="Logo" className="h-8 w-8 rounded-md object-cover" />
        </div>

        {/* Busca (abre launcher) */}
        <div className="flex items-center justify-center py-2 shrink-0">
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                type="button"
                aria-label="Buscar (⌘K)"
                onClick={() => setLauncherOpen(true)}
                className="h-10 w-10 rounded-lg flex items-center justify-center transition-colors"
                style={{ color: "hsl(var(--launcher-muted))" }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = "hsl(var(--launcher-surface-hover))";
                  e.currentTarget.style.color = "hsl(var(--launcher-foreground))";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = "transparent";
                  e.currentTarget.style.color = "hsl(var(--launcher-muted))";
                }}
              >
                <Search className="h-4 w-4" />
              </button>
            </TooltipTrigger>
            <TooltipContent side={tooltipSide} className="text-xs">
              Buscar (⌘K)
            </TooltipContent>
          </Tooltip>
        </div>

        {/* Lista de módulos */}
        <div className="flex-1 overflow-y-auto overflow-x-hidden py-1 flex flex-col gap-1">
          {isLoading && (
            <div className="flex items-center justify-center py-4">
              <Loader2
                className="h-4 w-4 animate-spin"
                style={{ color: "hsl(var(--launcher-muted))" }}
              />
            </div>
          )}

          {categories.map((cat, idx) => (
            <div key={cat.key} className="flex flex-col items-center gap-1">
              {idx > 0 && (
                <div
                  className="h-px w-6 my-2"
                  style={{ background: "hsl(var(--launcher-border))" }}
                />
              )}
              {cat.modules.map((mod) => {
                const Icon = resolveIcon(mod.icon);
                const isActive = active?.module.code === mod.code;
                const isOpen = openModuleCode === mod.code;
                const accentToken = getModuleAccent(mod.code);
                const pendentes = (mod as any).pendentesCount as number | undefined;

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
                            )}
                            style={{
                              background: isActive
                                ? `hsl(var(${accentToken}) / 0.18)`
                                : isOpen
                                  ? "hsl(var(--launcher-surface-hover))"
                                  : "transparent",
                              color: isActive
                                ? `hsl(var(${accentToken}))`
                                : "hsl(var(--launcher-muted))",
                              boxShadow: isActive
                                ? `inset 0 0 0 1px hsl(var(${accentToken}) / 0.35)`
                                : "none",
                            }}
                            onMouseEnter={(e) => {
                              if (isActive || isOpen) return;
                              e.currentTarget.style.background =
                                "hsl(var(--launcher-surface-hover))";
                              e.currentTarget.style.color =
                                "hsl(var(--launcher-foreground))";
                            }}
                            onMouseLeave={(e) => {
                              if (isActive || isOpen) return;
                              e.currentTarget.style.background = "transparent";
                              e.currentTarget.style.color = "hsl(var(--launcher-muted))";
                            }}
                          >
                            <Icon className="h-5 w-5" />
                            {isActive && (
                              <span
                                className="absolute left-0 top-1/2 -translate-y-1/2 h-6 w-[3px] rounded-r"
                                style={{ background: `hsl(var(${accentToken}))` }}
                              />
                            )}
                            {typeof pendentes === "number" && pendentes > 0 && (
                              <span
                                className="absolute top-1 right-1 h-2 w-2 rounded-full"
                                style={{
                                  background: "hsl(var(--launcher-accent-2))",
                                  boxShadow:
                                    "0 0 0 2px hsl(var(--launcher-surface))",
                                }}
                              />
                            )}
                          </button>
                        </PopoverTrigger>
                      </TooltipTrigger>
                      <TooltipContent
                        side={tooltipSide}
                        className="p-0 border-0 bg-transparent shadow-none"
                      >
                        <RailTooltipCard
                          module={mod}
                          isActive={isActive}
                          pendentes={pendentes}
                        />
                      </TooltipContent>
                    </Tooltip>
                    <PopoverContent
                      side={tooltipSide}
                      align="start"
                      sideOffset={8}
                      className="p-0 w-auto border-0"
                      style={{
                        background: "transparent",
                        boxShadow: "none",
                      }}
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

        {/* Rodapé: launcher + avatar */}
        <div
          className="p-2 flex flex-col items-center gap-2 shrink-0"
          style={{ borderTop: "1px solid hsl(var(--launcher-border))" }}
        >
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                type="button"
                aria-label="Abrir launcher (⌘K)"
                onClick={() => setLauncherOpen(true)}
                className="flex items-center justify-center h-10 w-10 rounded-lg transition-colors"
                style={{ color: "hsl(var(--launcher-muted))" }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = "hsl(var(--launcher-surface-hover))";
                  e.currentTarget.style.color = "hsl(var(--launcher-foreground))";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = "transparent";
                  e.currentTarget.style.color = "hsl(var(--launcher-muted))";
                }}
              >
                <LayoutGrid className="h-5 w-5" />
              </button>
            </TooltipTrigger>
            <TooltipContent side={tooltipSide}>
              <div className="text-xs">Launcher</div>
              <div className="text-[10px] text-muted-foreground">⌘K</div>
            </TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <button
                type="button"
                aria-label="Meu perfil"
                onClick={() => navigate("/dashboard/meu-perfil")}
                className="h-9 w-9 rounded-full flex items-center justify-center text-[13px] font-semibold transition-transform hover:scale-105"
                style={{
                  background: "hsl(var(--primary))",
                  color: "hsl(var(--primary-foreground))",
                }}
              >
                {userInitial(user?.email)}
              </button>
            </TooltipTrigger>
            <TooltipContent side={tooltipSide}>
              <div className="text-xs">{user?.email ?? "Perfil"}</div>
            </TooltipContent>
          </Tooltip>
        </div>
      </aside>

      <Launcher open={launcherOpen} onOpenChange={setLauncherOpen} />
      <RecordRecents categories={categories} />
    </TooltipProvider>
  );
}
