/**
 * Painel contextual da navegação v2 — substitui o "click expande sidebar"
 * por um popover lateral com as páginas do módulo selecionado. NÃO expande
 * o rail (que permanece 68px).
 */
import { NavLink } from "react-router-dom";
import { cn } from "@/lib/utils";
import { ScrollArea } from "@/components/ui/scroll-area";
import { resolveIcon } from "./icon";
import type { NavV2Module } from "./useNavV2Data";

interface ContextualSidebarProps {
  module: NavV2Module | null;
  currentPath: string;
  onNavigate?: () => void;
}

export function ContextualSidebar({ module, currentPath, onNavigate }: ContextualSidebarProps) {
  if (!module) {
    return (
      <div className="p-4 text-sm text-muted-foreground">
        Selecione um módulo no rail à esquerda.
      </div>
    );
  }

  const ModuleIcon = resolveIcon(module.icon);

  return (
    <div className="flex flex-col w-72 max-w-[80vw]">
      <div className="flex items-center gap-2 px-4 py-3 border-b border-border">
        <ModuleIcon className="h-4 w-4 text-primary" />
        <div className="flex-1 min-w-0">
          <div className="text-sm font-semibold text-foreground truncate">{module.label}</div>
          <div className="text-[11px] text-muted-foreground">
            {module.pages.length} {module.pages.length === 1 ? "página" : "páginas"}
          </div>
        </div>
      </div>

      <ScrollArea className="max-h-[60vh]">
        <nav className="p-2 flex flex-col gap-0.5">
          {module.pages.length === 0 ? (
            <div className="px-3 py-2 text-xs text-muted-foreground">
              Nenhuma página disponível.
            </div>
          ) : (
            module.pages.map((page) => {
              const PageIcon = resolveIcon(page.icon);
              const isActive = currentPath === page.route || currentPath.startsWith(page.route + "/");
              return (
                <NavLink
                  key={page.id}
                  to={page.route}
                  onClick={onNavigate}
                  className={cn(
                    "relative flex items-center gap-2.5 px-3 py-1.5 rounded-md text-[12px] transition-colors",
                    isActive
                      ? "bg-[hsl(var(--primary)/0.08)] text-primary font-medium"
                      : "text-muted-foreground hover:text-foreground hover:bg-muted/50",
                  )}
                >
                  {isActive && (
                    <span className="absolute left-0 top-1.5 bottom-1.5 w-0.5 rounded-r bg-primary" />
                  )}
                  <PageIcon className="h-3.5 w-3.5 shrink-0" />
                  <span className="flex-1 truncate">{page.label}</span>
                </NavLink>
              );
            })
          )}
        </nav>
      </ScrollArea>
    </div>
  );
}
