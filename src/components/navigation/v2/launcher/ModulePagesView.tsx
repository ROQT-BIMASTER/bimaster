/**
 * ModulePagesView — drill-in do Launcher.
 * Mostra todas as páginas de um módulo (filtradas pela busca) como lista
 * compacta, ordenadas por favorito → recência → ordem padrão.
 */
import { useMemo } from "react";
import {
  ArrowLeft,
  ChevronRight,
  Clock,
  ShieldCheck,
  Star,
} from "lucide-react";
import { resolveIcon } from "../icon";
import { getModuleAccent, accentStyle } from "./moduleColors";
import { useFavorites } from "./useFavorites";
import { useRecents } from "./useRecents";
import type { NavV2Module, NavV2Page } from "../useNavV2Data";

interface Props {
  module: NavV2Module;
  query: string;
  currentPath: string;
  onBack: () => void;
  onSelectPage: (route: string) => void;
}

function filterPages(pages: NavV2Page[], q: string): NavV2Page[] {
  const needle = q.trim().toLowerCase();
  if (!needle) return pages;
  return pages.filter(
    (p) =>
      p.label.toLowerCase().includes(needle) ||
      p.route.toLowerCase().includes(needle),
  );
}

function formatAgo(ts: number): string {
  const diff = Date.now() - ts;
  const min = Math.round(diff / 60_000);
  if (min < 1) return "agora";
  if (min < 60) return `${min}min`;
  const h = Math.round(min / 60);
  if (h < 24) return `${h}h`;
  return `${Math.round(h / 24)}d`;
}

export function ModulePagesView({
  module,
  query,
  currentPath,
  onBack,
  onSelectPage,
}: Props) {
  const Icon = resolveIcon(module.icon);
  const token = getModuleAccent(module.code);
  const { isFavorite, toggle } = useFavorites();
  const { entries: recents } = useRecents();

  const recencyByRoute = useMemo(() => {
    const map = new Map<string, number>();
    for (const r of recents) map.set(r.route, r.visitedAt);
    return map;
  }, [recents]);

  const ordered = useMemo(() => {
    const filtered = filterPages(module.pages, query);
    const withMeta = filtered.map((p, idx) => ({
      page: p,
      idx,
      fav: isFavorite(p.route),
      visited: recencyByRoute.get(p.route) ?? 0,
    }));
    withMeta.sort((a, b) => {
      if (a.fav !== b.fav) return a.fav ? -1 : 1;
      if (a.visited !== b.visited) return b.visited - a.visited;
      return a.idx - b.idx;
    });
    return withMeta;
  }, [module.pages, query, isFavorite, recencyByRoute]);

  const favCount = module.pages.filter((p) => isFavorite(p.route)).length;
  const recentCount = module.pages.filter((p) => recencyByRoute.has(p.route)).length;

  return (
    <section className="space-y-4">
      <header className="flex items-center gap-3">
        <button
          type="button"
          onClick={onBack}
          className="h-8 w-8 rounded-lg flex items-center justify-center transition-colors hover:bg-[hsl(var(--launcher-surface-elevated))]"
          style={{ color: "hsl(var(--launcher-muted))" }}
          aria-label="Voltar"
        >
          <ArrowLeft className="h-4 w-4" />
        </button>
        <div
          className="h-9 w-9 rounded-xl flex items-center justify-center shrink-0"
          style={accentStyle(token)}
        >
          <Icon className="h-4 w-4" />
        </div>
        <div className="flex-1 min-w-0">
          <div
            className="text-[14px] font-semibold leading-tight"
            style={{ color: "hsl(var(--launcher-foreground))" }}
          >
            {module.label}
          </div>
          <div
            className="text-[11px] flex items-center gap-2 flex-wrap"
            style={{ color: "hsl(var(--launcher-muted))" }}
          >
            <span>
              {module.pages.length}{" "}
              {module.pages.length === 1 ? "página" : "páginas"}
            </span>
            {favCount > 0 && (
              <>
                <span className="h-1 w-1 rounded-full bg-current opacity-50" />
                <span className="flex items-center gap-1">
                  <Star className="h-3 w-3 fill-current" />
                  {favCount}
                </span>
              </>
            )}
            {recentCount > 0 && (
              <>
                <span className="h-1 w-1 rounded-full bg-current opacity-50" />
                <span className="flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  {recentCount} recentes
                </span>
              </>
            )}
            {query.trim() && <> · {ordered.length} no filtro</>}
          </div>
        </div>
      </header>

      {ordered.length === 0 ? (
        <div
          className="py-12 text-center text-sm"
          style={{ color: "hsl(var(--launcher-muted))" }}
        >
          Nenhuma página corresponde a <strong>"{query}"</strong>.
        </div>
      ) : (
        <ul className="flex flex-col gap-1">
          {ordered.map(({ page: p, fav, visited }) => {
            const PageIcon = resolveIcon(p.icon ?? "Square");
            const isCurrent =
              currentPath === p.route || currentPath.startsWith(p.route + "/");
            const isAdminRoute = p.route.startsWith("/admin");
            return (
              <li key={p.id}>
                <div
                  className="group w-full flex items-center gap-3 rounded-lg px-2 py-2.5 transition-colors hover:bg-[hsl(var(--launcher-surface-elevated))]"
                  style={
                    fav
                      ? {
                          background: `hsl(var(${token}) / 0.06)`,
                          boxShadow: `inset 2px 0 0 hsl(var(${token}))`,
                        }
                      : undefined
                  }
                >
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      toggle(p.route);
                    }}
                    className="h-7 w-7 rounded-md flex items-center justify-center transition-colors hover:bg-[hsl(var(--launcher-surface))]"
                    aria-label={
                      fav ? "Remover dos favoritos" : "Marcar como favorito"
                    }
                    title={
                      fav ? "Remover dos favoritos" : "Marcar como favorito"
                    }
                  >
                    <Star
                      className={`h-3.5 w-3.5 transition-colors ${
                        fav ? "fill-current" : ""
                      }`}
                      style={{
                        color: fav
                          ? `hsl(var(${token}))`
                          : "hsl(var(--launcher-muted))",
                      }}
                    />
                  </button>
                  <button
                    type="button"
                    onClick={() => onSelectPage(p.route)}
                    className="flex-1 min-w-0 flex items-center gap-3 text-left focus:outline-none"
                  >
                    <PageIcon
                      className="h-4 w-4 shrink-0"
                      style={{ color: `hsl(var(${token}))` }}
                    />
                    <div className="flex-1 min-w-0">
                      <div
                        className="text-[13px] font-medium leading-tight truncate"
                        style={{ color: "hsl(var(--launcher-foreground))" }}
                      >
                        {p.label}
                      </div>
                      <div
                        className="text-[10.5px] font-mono mt-0.5 truncate"
                        style={{ color: "hsl(var(--launcher-muted))" }}
                      >
                        {p.route}
                      </div>
                    </div>
                    {visited > 0 && (
                      <span
                        className="hidden sm:flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded"
                        style={{
                          background: "hsl(var(--launcher-surface-elevated))",
                          color: "hsl(var(--launcher-muted))",
                        }}
                      >
                        <Clock className="h-3 w-3" />
                        {formatAgo(visited)}
                      </span>
                    )}
                    {isAdminRoute && (
                      <span
                        className="flex items-center gap-1 text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded"
                        style={{
                          background: "hsl(var(--launcher-surface-elevated))",
                          color: "hsl(var(--launcher-muted))",
                        }}
                      >
                        <ShieldCheck className="h-3 w-3" />
                        admin
                      </span>
                    )}
                    {isCurrent && (
                      <span
                        className="text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded"
                        style={{
                          background: `hsl(var(${token}) / 0.16)`,
                          color: `hsl(var(${token}))`,
                        }}
                      >
                        aqui
                      </span>
                    )}
                    <ChevronRight
                      className="h-3.5 w-3.5 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity"
                      style={{ color: "hsl(var(--launcher-muted))" }}
                    />
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
