/**
 * AppRail v2 — rail vertical de 68px por CATEGORIA.
 *
 * Estrutura:
 *  ┌──────┐
 *  │  H   │  logo
 *  │ ─── │
 *  │  🔍  │  busca (abre launcher)
 *  │      │
 *  │  ⚙️  │  categoria Operação
 *  │  💼 │  categoria Comercial
 *  │  📣 │  categoria Marketing
 *  │  💰 │  categoria Financeiro
 *  │  📁 │  categoria Projetos
 *  │ ─── │
 *  │  ▦  │  launcher
 *  │ (R) │  avatar
 *  └──────┘
 *
 * Click numa categoria → ContextualSidebar em modo `category` (lista módulos
 * como seções colapsáveis com suas páginas).
 *
 * Atalhos:
 *  - Categoria com 1 módulo + 1 página → navega direto.
 *  - Categoria sem módulos visíveis → não renderiza.
 *
 * Só é montado quando `nav_version='v2'` está ativo (default 'v1').
 */
import { useState, type ComponentType } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import {
  Briefcase,
  Factory,
  FolderKanban,
  LayoutGrid,
  Loader2,
  Megaphone,
  Search,
  Settings,
  Sparkles,
  Wallet,
  type LucideProps,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

import { useAuth } from "@/contexts/AuthContext";
import { resolveIcon } from "./icon";
import { ContextualSidebar } from "./ContextualSidebar";
import { Launcher } from "./Launcher";
import { RecordRecents } from "./launcher/RecordRecents";
import { RailTooltipCard } from "./RailTooltipCard";
import { RailUtilityButton } from "./RailUtilityButton";
import { useUtilityShortcuts } from "./launcher/UtilityShortcuts";

import { getModuleAccent } from "./launcher/moduleColors";
import {
  findActiveModule,
  useNavV2Data,
  type NavV2Category,
} from "./useNavV2Data";

const RAIL_WIDTH = 68;

// Fallback de ícone por chave de categoria quando o banco não define um.
const CATEGORY_FALLBACK_ICON: Record<string, ComponentType<LucideProps>> = {
  operacao: Factory,
  comercial: Briefcase,
  vendas: Briefcase,
  trade: Briefcase,
  marketing: Megaphone,
  financeiro: Wallet,
  financas: Wallet,
  projetos: FolderKanban,
  admin: Settings,
  outros: Sparkles,
};

function categoryIcon(cat: NavV2Category): ComponentType<LucideProps> {
  if (cat.icon) return resolveIcon(cat.icon);
  const key = cat.key.toLowerCase().replace(/[\s-]+/g, "_");
  return CATEGORY_FALLBACK_ICON[key] ?? Factory;
}

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
  const [openCategoryKey, setOpenCategoryKey] = useState<string | null>(null);
  const [launcherOpen, setLauncherOpen] = useState(false);
  const utilityShortcuts = useUtilityShortcuts();

  const active = findActiveModule(categories, location.pathname);
  const activeCategoryKey = active?.category.key ?? null;
  const tooltipSide = side === "left" ? "right" : "left";

  const handleCategoryClick = (cat: NavV2Category) => {
    // Atalho: categoria com 1 módulo de 1 página → navega direto.
    if (cat.modules.length === 1 && cat.modules[0].pages.length === 1) {
      navigate(cat.modules[0].pages[0].route);
      setOpenCategoryKey(null);
      return;
    }
    setOpenCategoryKey((cur) => (cur === cat.key ? null : cat.key));
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

        {/* Lista de CATEGORIAS (rail compacto) */}
        <div
          role="toolbar"
          aria-orientation="vertical"
          aria-label="Categorias"
          onKeyDown={(e) => {
            if (e.key !== "ArrowDown" && e.key !== "ArrowUp" && e.key !== "Home" && e.key !== "End") return;
            const buttons = Array.from(
              e.currentTarget.querySelectorAll<HTMLButtonElement>('button[data-rail-category="true"]'),
            );
            if (buttons.length === 0) return;
            const idx = buttons.indexOf(document.activeElement as HTMLButtonElement);
            let next = idx;
            if (e.key === "ArrowDown") next = idx < 0 ? 0 : (idx + 1) % buttons.length;
            else if (e.key === "ArrowUp") next = idx < 0 ? buttons.length - 1 : (idx - 1 + buttons.length) % buttons.length;
            else if (e.key === "Home") next = 0;
            else if (e.key === "End") next = buttons.length - 1;
            e.preventDefault();
            buttons[next]?.focus();
          }}
          className="flex-1 overflow-y-auto overflow-x-hidden py-1 flex flex-col items-center gap-1.5"
        >
          {isLoading && (
            <div className="flex items-center justify-center py-4">
              <Loader2
                className="h-4 w-4 animate-spin"
                style={{ color: "hsl(var(--launcher-muted))" }}
              />
            </div>
          )}

          {categories.map((cat) => {
            if (cat.modules.length === 0) return null;
            const CatIcon = categoryIcon(cat);
            const isActive = activeCategoryKey === cat.key;
            const isOpen = openCategoryKey === cat.key;
            const accentToken = getModuleAccent(cat.key);
            const pendentes = cat.modules.reduce(
              (acc, m) => acc + ((m as any).pendentesCount ?? 0),
              0,
            );

            return (
              <Popover
                key={cat.key}
                open={isOpen}
                onOpenChange={(o) => setOpenCategoryKey(o ? cat.key : null)}
              >
                <PopoverTrigger asChild>
                  <button
                    type="button"
                    aria-label={cat.label}
                    aria-current={isActive ? "page" : undefined}
                    aria-haspopup="dialog"
                    data-rail-category="true"
                    onClick={() => handleCategoryClick(cat)}
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
                    <CatIcon className="h-5 w-5" />
                    {isActive && (
                      <span
                        className="absolute left-0 top-1/2 -translate-y-1/2 h-6 w-[3px] rounded-r"
                        style={{ background: `hsl(var(${accentToken}))` }}
                      />
                    )}
                    {pendentes > 0 && (
                      <span
                        className="absolute top-1 right-1 h-2 w-2 rounded-full"
                        style={{
                          background: "hsl(var(--launcher-accent-2))",
                          boxShadow: "0 0 0 2px hsl(var(--launcher-surface))",
                        }}
                      />
                    )}
                  </button>
                </PopoverTrigger>
                <PopoverContent
                  side={tooltipSide}
                  align="start"
                  sideOffset={8}
                  className="p-0 w-auto border-0 z-[120]"
                  style={{ background: "transparent", boxShadow: "none" }}

                >
                  <ContextualSidebar
                    category={cat}
                    currentPath={location.pathname}
                    onNavigate={() => setOpenCategoryKey(null)}
                  />
                </PopoverContent>
              </Popover>
            );
          })}
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
            <TooltipContent side={tooltipSide} className="z-[120]">
              <div className="text-xs">Launcher</div>
              <div className="text-[10px] text-muted-foreground">⌘K</div>
            </TooltipContent>

          </Tooltip>

          {/* Cluster utilitário: Chat, Aprovações do Chat, Instalar/Atualizar App */}
          {utilityShortcuts.length > 0 && (
            <>
              <div
                className="w-7 h-px my-0.5"
                style={{ background: "hsl(var(--launcher-border))" }}
              />
              {utilityShortcuts.map((s) => (
                <RailUtilityButton
                  key={s.key}
                  to={s.route}
                  label={s.label}
                  icon={s.icon}
                  tooltipSide={tooltipSide}
                  attention={s.attention}
                  badgeCount={s.badgeCount}
                />
              ))}
              <div
                className="w-7 h-px my-0.5"
                style={{ background: "hsl(var(--launcher-border))" }}
              />
            </>
          )}

          

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
            <TooltipContent side={tooltipSide} className="z-[120]">
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
