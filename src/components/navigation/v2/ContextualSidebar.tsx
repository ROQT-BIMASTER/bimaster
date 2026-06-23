/**
 * Painel contextual da navegação v2 — popover lateral com as páginas do
 * módulo. NÃO expande o rail (que permanece 68px).
 *
 * Refinos do mockup:
 * - Header com badge de status opcional ("ERP desconectado").
 * - Campo de busca local filtra páginas por label.
 * - Páginas agrupadas por seção (parent_group quando existir).
 * - Item ativo destacado com bloco accent forte.
 * - Rodapé com link "Voltar ao painel geral".
 */
import { useMemo, useState } from "react";
import { NavLink, useNavigate } from "react-router-dom";
import { ArrowLeft, Search } from "lucide-react";
import { cn } from "@/lib/utils";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { resolveIcon } from "./icon";
import { getModuleAccent, accentStyle } from "./launcher/moduleColors";
import type { NavV2Module, NavV2Page } from "./useNavV2Data";

interface StatusBadge {
  label: string;
  tone?: "warning" | "success" | "danger" | "neutral";
}

interface ContextualSidebarProps {
  module: NavV2Module | null;
  currentPath: string;
  onNavigate?: () => void;
  /** Badge opcional ao lado do título (ex.: "ERP desconectado"). */
  statusBadge?: StatusBadge;
}

const TONE_VAR: Record<NonNullable<StatusBadge["tone"]>, string> = {
  warning: "--launcher-accent-1",
  danger: "--launcher-accent-2",
  success: "--launcher-accent-7",
  neutral: "--launcher-muted",
};

export function ContextualSidebar({
  module,
  currentPath,
  onNavigate,
  statusBadge,
}: ContextualSidebarProps) {
  const navigate = useNavigate();
  const [query, setQuery] = useState("");

  const grouped = useMemo(() => {
    if (!module) return [] as Array<{ section: string; pages: NavV2Page[] }>;
    const filterFn = (p: NavV2Page) =>
      !query.trim() || p.label.toLowerCase().includes(query.trim().toLowerCase());

    const buckets = new Map<string, NavV2Page[]>();
    module.pages.filter(filterFn).forEach((p) => {
      const sec = (p as any).section || (p as any).parent_group || module.label;
      const key = String(sec).toUpperCase();
      const arr = buckets.get(key) ?? [];
      arr.push(p);
      buckets.set(key, arr);
    });
    return Array.from(buckets.entries()).map(([section, pages]) => ({ section, pages }));
  }, [module, query]);

  if (!module) {
    return (
      <div
        data-launcher-theme="dark"
        className="p-4 text-sm rounded-lg w-[280px]"
        style={{
          background: "hsl(var(--launcher-surface))",
          color: "hsl(var(--launcher-muted))",
          boxShadow: "inset 0 0 0 1px hsl(var(--launcher-border))",
        }}
      >
        Selecione um módulo no rail à esquerda.
      </div>
    );
  }

  const ModuleIcon = resolveIcon(module.icon);
  const token = getModuleAccent(module.code);

  return (
    <div
      data-launcher-theme="dark"
      className="flex flex-col w-[280px] max-w-[85vw] rounded-lg overflow-hidden"
      style={{
        background: "hsl(var(--launcher-surface))",
        color: "hsl(var(--launcher-foreground))",
        boxShadow:
          "0 20px 60px -15px hsl(0 0% 0% / 0.55), inset 0 0 0 1px hsl(var(--launcher-border))",
      }}
    >
      {/* Header */}
      <div
        className="flex items-start gap-2.5 px-4 py-3.5"
        style={{ borderBottom: "1px solid hsl(var(--launcher-border))" }}
      >
        <div
          className="h-8 w-8 rounded-md flex items-center justify-center shrink-0"
          style={accentStyle(token)}
        >
          <ModuleIcon className="h-4 w-4" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-sm font-semibold leading-tight truncate">
            {module.label}
          </div>
          <div
            className="text-[11px] mt-0.5"
            style={{ color: "hsl(var(--launcher-muted))" }}
          >
            {module.pages.length} {module.pages.length === 1 ? "página" : "páginas"}
          </div>
          {statusBadge && (
            <Badge
              variant="secondary"
              className="mt-2 text-[9px] h-4 px-1.5 border-0"
              style={{
                background: `hsl(var(${TONE_VAR[statusBadge.tone ?? "neutral"]}) / 0.18)`,
                color: `hsl(var(${TONE_VAR[statusBadge.tone ?? "neutral"]}))`,
              }}
            >
              {statusBadge.label}
            </Badge>
          )}
        </div>
      </div>

      {/* Busca */}
      <div
        className="px-3 py-2.5"
        style={{ borderBottom: "1px solid hsl(var(--launcher-border))" }}
      >
        <div
          className="flex items-center gap-2 px-2.5 h-8 rounded-md"
          style={{
            background: "hsl(var(--launcher-surface-elevated))",
            boxShadow: "inset 0 0 0 1px hsl(var(--launcher-border))",
          }}
        >
          <Search
            className="h-3.5 w-3.5 shrink-0"
            style={{ color: "hsl(var(--launcher-muted))" }}
          />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={`Buscar em ${module.label}`}
            className="flex-1 bg-transparent outline-none text-[12px] placeholder:text-[hsl(var(--launcher-muted))]"
            style={{ color: "hsl(var(--launcher-foreground))" }}
          />
        </div>
      </div>

      {/* Lista */}
      <ScrollArea className="max-h-[60vh]">
        <nav className="p-2 flex flex-col gap-2">
          {grouped.length === 0 ? (
            <div
              className="px-3 py-4 text-xs text-center"
              style={{ color: "hsl(var(--launcher-muted))" }}
            >
              {query ? "Nada encontrado." : "Nenhuma página disponível."}
            </div>
          ) : (
            grouped.map(({ section, pages }) => (
              <div key={section} className="flex flex-col">
                <div
                  className="px-2 pt-1.5 pb-1 text-[9px] font-semibold uppercase tracking-[0.14em]"
                  style={{ color: "hsl(var(--launcher-muted))" }}
                >
                  {section}
                </div>
                {pages.map((page) => {
                  const PageIcon = resolveIcon(page.icon);
                  const isActive =
                    currentPath === page.route ||
                    currentPath.startsWith(page.route + "/");
                  return (
                    <NavLink
                      key={page.id}
                      to={page.route}
                      onClick={onNavigate}
                      className={cn(
                        "relative flex items-center gap-2.5 px-2.5 py-1.5 rounded-md text-[12px] transition-colors",
                      )}
                      style={{
                        background: isActive
                          ? `hsl(var(${token}) / 0.22)`
                          : "transparent",
                        color: isActive
                          ? `hsl(var(${token}))`
                          : "hsl(var(--launcher-foreground))",
                        fontWeight: isActive ? 600 : 400,
                        boxShadow: isActive
                          ? `inset 0 0 0 1px hsl(var(${token}) / 0.35)`
                          : "none",
                      }}
                      onMouseEnter={(e) => {
                        if (isActive) return;
                        e.currentTarget.style.background =
                          "hsl(var(--launcher-surface-hover))";
                      }}
                      onMouseLeave={(e) => {
                        if (isActive) return;
                        e.currentTarget.style.background = "transparent";
                      }}
                    >
                      <PageIcon className="h-3.5 w-3.5 shrink-0 opacity-80" />
                      <span className="flex-1 truncate">{page.label}</span>
                    </NavLink>
                  );
                })}
              </div>
            ))
          )}
        </nav>
      </ScrollArea>

      {/* Rodapé */}
      <button
        type="button"
        onClick={() => {
          onNavigate?.();
          navigate("/dashboard");
        }}
        className="flex items-center gap-2 px-4 py-2.5 text-[11px] transition-colors hover:opacity-80"
        style={{
          borderTop: "1px solid hsl(var(--launcher-border))",
          color: "hsl(var(--launcher-muted))",
        }}
      >
        <ArrowLeft className="h-3 w-3" />
        Voltar ao painel geral
      </button>
    </div>
  );
}
