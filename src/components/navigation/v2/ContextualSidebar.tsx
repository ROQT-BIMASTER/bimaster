/**
 * ContextualSidebar — painel lateral que mostra o submenu do módulo ativo
 * (ou de um módulo "em foco" pelo hover do AppRail).
 *
 * - Não expande o rail; aparece como painel fixo ao lado dele.
 * - Agrupa páginas por `parent_group` quando presente.
 * - Item ativo destacado com barra accent + fundo.
 * - Páginas admin marcadas com pílula âmbar + cadeado.
 */
import { useMemo } from "react";
import { NavLink, useLocation } from "react-router-dom";
import { Lock, Pin } from "lucide-react";
import { cn } from "@/lib/utils";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useNavTreeV2, findActive, type NavModuleV2, type NavPageV2 } from "./useNavTreeV2";
import { resolveIcon } from "./resolveIcon";

export interface ContextualSidebarProps {
  /** Módulo em foco (hover do rail). Se ausente, usa o módulo da rota atual. */
  focusModuleCode?: string;
  width?: number;
  onPinToggle?: () => void;
  pinned?: boolean;
}

const SIDEBAR_WIDTH = 264;

export function ContextualSidebar({
  focusModuleCode,
  width = SIDEBAR_WIDTH,
  onPinToggle,
  pinned = true,
}: ContextualSidebarProps) {
  const { pathname } = useLocation();
  const tree = useNavTreeV2();
  const active = findActive(tree, pathname);

  const module: NavModuleV2 | undefined = useMemo(() => {
    if (focusModuleCode) {
      for (const c of tree.categories) {
        const m = c.modules.find((x) => x.code === focusModuleCode);
        if (m) return m;
      }
    }
    return active?.module;
  }, [tree, focusModuleCode, active]);

  if (!module) {
    return (
      <aside
        aria-label="Navegação contextual"
        className="hidden md:flex h-screen sticky top-0 flex-col border-r border-border bg-background"
        style={{ width }}
      >
        <div className="p-4 text-sm text-muted-foreground">
          Selecione um módulo no menu lateral.
        </div>
      </aside>
    );
  }

  const ModuleIcon = resolveIcon(module.icon);
  const groups = groupPages(module.pages);

  return (
    <aside
      aria-label={`Navegação · ${module.label}`}
      className="hidden md:flex h-screen sticky top-0 flex-col border-r border-border bg-background"
      style={{ width }}
    >
      <header className="flex items-start justify-between gap-2 border-b border-border px-4 py-3">
        <div className="flex items-start gap-2 min-w-0">
          <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
            <ModuleIcon className="h-4 w-4" />
          </span>
          <div className="min-w-0">
            <div className="truncate text-sm font-semibold text-foreground">{module.label}</div>
            <div className="text-[11px] text-muted-foreground">
              {module.pages.length} {module.pages.length === 1 ? "página" : "páginas"}
            </div>
          </div>
        </div>
        {onPinToggle && (
          <button
            type="button"
            onClick={onPinToggle}
            className={cn(
              "rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-foreground",
              pinned && "text-primary",
            )}
            aria-label={pinned ? "Desafixar painel" : "Afixar painel"}
            title={pinned ? "Desafixar" : "Afixar"}
          >
            <Pin className="h-3.5 w-3.5" />
          </button>
        )}
      </header>

      <ScrollArea className="flex-1">
        <nav className="px-2 py-3" aria-label={`Submenu do módulo ${module.label}`}>
          {groups.map((g, idx) => (
            <div key={g.key} className={cn(idx > 0 && "mt-4")}>
              {g.label && (
                <div className="px-2 pb-1 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                  {g.label}
                </div>
              )}
              <ul className="flex flex-col gap-0.5">
                {g.pages.map((p) => (
                  <PageItem key={p.path} page={p} />
                ))}
              </ul>
            </div>
          ))}
        </nav>
      </ScrollArea>
    </aside>
  );
}

function PageItem({ page }: { page: NavPageV2 }) {
  const Icon = resolveIcon(page.icon);
  return (
    <li>
      <NavLink
        to={page.path}
        end
        className={({ isActive }) =>
          cn(
            "group relative flex items-center gap-2 rounded-md px-2 py-1.5 text-sm transition-colors",
            isActive
              ? "bg-primary/10 text-primary"
              : "text-foreground/80 hover:bg-muted hover:text-foreground",
          )
        }
      >
        {({ isActive }) => (
          <>
            {isActive && (
              <span className="absolute left-0 top-1 bottom-1 w-0.5 rounded bg-primary" aria-hidden />
            )}
            <Icon className="h-4 w-4 shrink-0" />
            <span className="truncate">{page.label}</span>
            {page.requireAdmin && (
              <span className="ml-auto inline-flex items-center gap-0.5 rounded bg-amber-500/15 px-1 py-0.5 text-[9px] font-medium text-amber-700 dark:text-amber-300">
                <Lock className="h-2.5 w-2.5" />
                ADMIN
              </span>
            )}
          </>
        )}
      </NavLink>
    </li>
  );
}

interface PageGroup {
  key: string;
  label: string | null;
  pages: NavPageV2[];
}

function groupPages(pages: NavPageV2[]): PageGroup[] {
  const map = new Map<string, PageGroup>();
  for (const p of pages) {
    const key = p.parentGroup ?? "__root";
    if (!map.has(key)) {
      map.set(key, {
        key,
        label: p.parentGroup,
        pages: [],
      });
    }
    map.get(key)!.pages.push(p);
  }
  // Root primeiro, demais na ordem de inserção.
  const root = map.get("__root");
  const others = [...map.values()].filter((g) => g.key !== "__root");
  return root ? [root, ...others] : others;
}

export const CONTEXTUAL_SIDEBAR_WIDTH = SIDEBAR_WIDTH;
