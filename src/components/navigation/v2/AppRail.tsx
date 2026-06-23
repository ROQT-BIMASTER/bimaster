/**
 * AppRail — barra de ícones compacta (68px) da navegação v2.
 *
 * - Mostra logo no topo, ícones de módulos agrupados por categoria
 *   com dividers, e atalho do launcher (⌘K) sticky no rodapé.
 * - Hover/focus abre a ContextualSidebar com o submenu do módulo.
 * - Item ativo destacado com barra accent à esquerda + fundo deep-blue.
 *
 * Acessível: cada botão é <button> com aria-label; navegação por Tab.
 */
import { useNavigate, useLocation } from "react-router-dom";
import { Grid3X3, Search } from "lucide-react";
import { cn } from "@/lib/utils";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { useNavTreeV2, findActive, type NavCategoryV2, type NavModuleV2 } from "./useNavTreeV2";
import { resolveIcon } from "./resolveIcon";

export interface AppRailProps {
  onOpenLauncher: () => void;
  onHoverModule?: (module: NavModuleV2 | null) => void;
  width?: number;
}

const RAIL_WIDTH = 68;

export function AppRail({ onOpenLauncher, onHoverModule, width = RAIL_WIDTH }: AppRailProps) {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const tree = useNavTreeV2();
  const active = findActive(tree, pathname);

  return (
    <TooltipProvider delayDuration={400}>
      <aside
        aria-label="Navegação principal"
        className="sticky top-0 h-screen flex flex-col items-center border-r border-border bg-sidebar text-sidebar-foreground"
        style={{ width }}
      >
        {/* Logo / home */}
        <button
          type="button"
          onClick={() => navigate("/dashboard")}
          className="mt-3 mb-2 flex h-10 w-10 items-center justify-center rounded-lg bg-primary text-primary-foreground text-sm font-semibold hover:opacity-90"
          aria-label="Início"
        >
          H
        </button>

        {/* Módulos por categoria */}
        <nav className="flex-1 w-full overflow-y-auto py-2" aria-label="Módulos">
          <ul className="flex flex-col items-center gap-1">
            {tree.categories.map((cat, ci) => (
              <RailCategory
                key={cat.id}
                category={cat}
                isLast={ci === tree.categories.length - 1}
                activeModuleCode={active?.module.code}
                onPick={(m) => navigate(firstPagePath(m) ?? "/dashboard")}
                onHover={onHoverModule}
              />
            ))}
          </ul>
        </nav>

        {/* Launcher ⌘K sticky no rodapé */}
        <div className="w-full flex flex-col items-center gap-2 border-t border-border/60 py-2">
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                type="button"
                onClick={onOpenLauncher}
                className="relative flex h-11 w-11 items-center justify-center rounded-lg bg-muted/30 text-sidebar-foreground hover:bg-muted/60"
                aria-label="Abrir launcher (Cmd K)"
              >
                <Grid3X3 className="h-5 w-5" />
                <span className="absolute -top-0.5 -right-0.5 rounded bg-primary px-1 text-[9px] font-semibold leading-tight text-primary-foreground">
                  ⌘K
                </span>
              </button>
            </TooltipTrigger>
            <TooltipContent side="right" className="text-xs">
              Launcher · <kbd className="ml-1">⌘K</kbd>
            </TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                type="button"
                onClick={onOpenLauncher}
                className="flex h-9 w-9 items-center justify-center rounded-md text-sidebar-foreground/70 hover:bg-muted/30 hover:text-sidebar-foreground"
                aria-label="Busca rápida"
              >
                <Search className="h-4 w-4" />
              </button>
            </TooltipTrigger>
            <TooltipContent side="right" className="text-xs">Busca rápida</TooltipContent>
          </Tooltip>
        </div>
      </aside>
    </TooltipProvider>
  );
}

interface RailCategoryProps {
  category: NavCategoryV2;
  isLast: boolean;
  activeModuleCode?: string;
  onPick: (m: NavModuleV2) => void;
  onHover?: (m: NavModuleV2 | null) => void;
}

function RailCategory({ category, isLast, activeModuleCode, onPick, onHover }: RailCategoryProps) {
  return (
    <>
      {category.modules.map((m) => (
        <li key={m.code}>
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                type="button"
                onClick={() => onPick(m)}
                onMouseEnter={() => onHover?.(m)}
                onFocus={() => onHover?.(m)}
                onMouseLeave={() => onHover?.(null)}
                onBlur={() => onHover?.(null)}
                className={cn(
                  "relative flex h-11 w-11 items-center justify-center rounded-lg transition-colors",
                  activeModuleCode === m.code
                    ? "bg-primary text-primary-foreground"
                    : "text-sidebar-foreground/80 hover:bg-muted/30 hover:text-sidebar-foreground",
                )}
                aria-label={m.label}
                aria-current={activeModuleCode === m.code ? "page" : undefined}
              >
                {activeModuleCode === m.code && (
                  <span className="absolute -left-1 top-1.5 bottom-1.5 w-1 rounded-r bg-primary-foreground" aria-hidden />
                )}
                <RailIcon name={m.icon} />
                {m.pendentes ? (
                  <span className="absolute -top-0.5 -right-0.5 h-2 w-2 rounded-full bg-amber-400" aria-hidden />
                ) : null}
              </button>
            </TooltipTrigger>
            <TooltipContent side="right" className="max-w-xs">
              <div className="font-medium">{m.label}</div>
              <div className="text-xs text-muted-foreground">
                {m.pages.length} {m.pages.length === 1 ? "página" : "páginas"}
              </div>
              {activeModuleCode === m.code && (
                <div className="mt-1 text-xs text-primary">você está aqui</div>
              )}
            </TooltipContent>
          </Tooltip>
        </li>
      ))}
      {!isLast && <li aria-hidden className="my-1 h-px w-8 bg-border/60" />}
    </>
  );
}

function RailIcon({ name }: { name: string }) {
  const Icon = resolveIcon(name);
  return <Icon className="h-5 w-5" />;
}

function firstPagePath(m: NavModuleV2): string | null {
  return m.pages[0]?.path ?? null;
}

export const APP_RAIL_WIDTH = RAIL_WIDTH;
