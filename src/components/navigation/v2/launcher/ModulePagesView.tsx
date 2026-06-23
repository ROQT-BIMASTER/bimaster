/**
 * ModulePagesView — drill-in do Launcher.
 * Mostra todas as páginas de um módulo (filtradas pela busca) como lista
 * compacta, permitindo escolher a tela em vez de ir direto para a primeira.
 */
import { useMemo } from "react";
import { ArrowLeft, ChevronRight, ShieldCheck } from "lucide-react";
import { resolveIcon } from "../icon";
import { getModuleAccent, accentStyle } from "./moduleColors";
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

export function ModulePagesView({
  module,
  query,
  currentPath,
  onBack,
  onSelectPage,
}: Props) {
  const Icon = resolveIcon(module.icon);
  const token = getModuleAccent(module.code);
  const pages = useMemo(() => filterPages(module.pages, query), [module.pages, query]);

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
          <Icon className="h-4.5 w-4.5" />
        </div>
        <div className="flex-1 min-w-0">
          <div
            className="text-[14px] font-semibold leading-tight"
            style={{ color: "hsl(var(--launcher-foreground))" }}
          >
            {module.label}
          </div>
          <div
            className="text-[11px]"
            style={{ color: "hsl(var(--launcher-muted))" }}
          >
            {module.pages.length}{" "}
            {module.pages.length === 1 ? "página" : "páginas"}
            {query.trim() && (
              <> · {pages.length} no filtro</>
            )}
          </div>
        </div>
      </header>

      {pages.length === 0 ? (
        <div
          className="py-12 text-center text-sm"
          style={{ color: "hsl(var(--launcher-muted))" }}
        >
          Nenhuma página corresponde a <strong>"{query}"</strong>.
        </div>
      ) : (
        <ul className="flex flex-col gap-1">
          {pages.map((p) => {
            const PageIcon = resolveIcon(p.icon ?? "Square");
            const isCurrent = currentPath === p.route || currentPath.startsWith(p.route + "/");
            const isAdminRoute = p.route.startsWith("/admin");
            return (
              <li key={p.id}>
                <button
                  type="button"
                  onClick={() => onSelectPage(p.route)}
                  className="group w-full flex items-center gap-3 rounded-lg px-3 py-2.5 text-left transition-colors hover:bg-[hsl(var(--launcher-surface-elevated))] focus:outline-none focus-visible:ring-2"
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
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
