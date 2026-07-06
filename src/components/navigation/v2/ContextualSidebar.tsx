/**
 * Painel contextual da navegação v2.
 *
 * Dois modos:
 * - `category`: lista os módulos da categoria como seções colapsáveis
 *   com suas páginas — modo padrão usado pelo rail compacto por categoria.
 * - `module`: mantém o modo "1 módulo" (fallback usado por chamadas legadas).
 *
 * NÃO expande o rail (que permanece 68px). Renderizado como popover.
 */
import { useEffect, useMemo, useState } from "react";
import { NavLink, useNavigate } from "react-router-dom";
import { ArrowLeft, ChevronDown, ChevronRight, Search } from "lucide-react";
import { cn } from "@/lib/utils";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { resolveIcon } from "./icon";
import { getModuleAccent, accentStyle } from "./launcher/moduleColors";
import type { NavV2Category, NavV2Module, NavV2Page } from "./useNavV2Data";

interface StatusBadge {
  label: string;
  tone?: "warning" | "success" | "danger" | "neutral";
}

interface BaseProps {
  currentPath: string;
  onNavigate?: () => void;
  statusBadge?: StatusBadge;
}

interface CategoryModeProps extends BaseProps {
  category: NavV2Category;
  module?: never;
}

interface ModuleModeProps extends BaseProps {
  module: NavV2Module | null;
  category?: never;
}

type ContextualSidebarProps = CategoryModeProps | ModuleModeProps;

const TONE_VAR: Record<NonNullable<StatusBadge["tone"]>, string> = {
  warning: "--launcher-accent-1",
  danger: "--launcher-accent-2",
  success: "--launcher-accent-7",
  neutral: "--launcher-muted",
};

export function ContextualSidebar(props: ContextualSidebarProps) {
  if ("category" in props && props.category) {
    return <CategoryPanel {...(props as CategoryModeProps)} />;
  }
  return <ModulePanel {...(props as ModuleModeProps)} />;
}

// ────────────────────────────────────────────────────────────
// Modo CATEGORIA — rail compacto por categoria (padrão)
// ────────────────────────────────────────────────────────────
function CategoryPanel({
  category,
  currentPath,
  onNavigate,
  statusBadge,
}: CategoryModeProps) {
  const navigate = useNavigate();
  const [query, setQuery] = useState("");
  const activeModuleCode = useMemo(
    () =>
      category.modules.find((m) =>
        m.pages.some(
          (p) => currentPath === p.route || currentPath.startsWith(p.route + "/"),
        ),
      )?.code ?? null,
    [category.modules, currentPath],
  );
  const [openSet, setOpenSet] = useState<Set<string>>(
    () => new Set(activeModuleCode ? [activeModuleCode] : []),
  );

  useEffect(() => {
    if (activeModuleCode) {
      setOpenSet((prev) => {
        if (prev.has(activeModuleCode)) return prev;
        const next = new Set(prev);
        next.add(activeModuleCode);
        return next;
      });
    }
  }, [activeModuleCode]);

  const filteredModules = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return category.modules;
    return category.modules
      .map((m) => ({
        ...m,
        pages: m.pages.filter(
          (p) =>
            p.label.toLowerCase().includes(needle) ||
            m.label.toLowerCase().includes(needle),
        ),
      }))
      .filter((m) => m.pages.length > 0);
  }, [category.modules, query]);

  const totalPages = category.modules.reduce((a, m) => a + m.pages.length, 0);
  const CatIcon = resolveIcon(category.icon ?? null);
  const token = getModuleAccent(category.key);

  const toggle = (code: string) =>
    setOpenSet((prev) => {
      const next = new Set(prev);
      next.has(code) ? next.delete(code) : next.add(code);
      return next;
    });

  return (
    <Shell>
      {/* Header */}
      <div
        className="flex items-start gap-2.5 px-4 py-3.5"
        style={{ borderBottom: "1px solid hsl(var(--launcher-border))" }}
      >
        <div
          className="h-8 w-8 rounded-md flex items-center justify-center shrink-0"
          style={accentStyle(token)}
        >
          <CatIcon className="h-4 w-4" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-sm font-semibold leading-tight truncate">
            {category.label}
          </div>
          <div
            className="text-[11px] mt-0.5"
            style={{ color: "hsl(var(--launcher-muted))" }}
          >
            {category.modules.length} módulos · {totalPages} páginas
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

      <SearchBox value={query} onChange={setQuery} placeholder={`Buscar em ${category.label}`} />

      <div
        className="max-h-[64vh] overflow-y-auto overflow-x-hidden [&::-webkit-scrollbar]:w-2 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-[hsl(var(--launcher-border))] hover:[&::-webkit-scrollbar-thumb]:bg-[hsl(var(--launcher-muted))]"
        style={{ scrollbarWidth: "thin", scrollbarColor: "hsl(var(--launcher-border)) transparent" }}
      >
        <nav className="p-2 flex flex-col gap-1">
          {filteredModules.length === 0 ? (
            <Empty query={query} />
          ) : (
            filteredModules.map((mod, idx) => {
              const isOpen = openSet.has(mod.code) || !!query.trim();
              const ModIcon = resolveIcon(mod.icon);
              const modToken = getModuleAccent(mod.code);
              const isActiveMod = activeModuleCode === mod.code;
              // Subheader de agrupamento aparece só quando o módulo tem
              // `sectionLabel` e é o primeiro do seu grupo. Categorias que não
              // foram fundidas continuam renderizando sem subheader nenhum.
              const prevSection = idx > 0 ? filteredModules[idx - 1].sectionLabel : undefined;
              const showSectionHeader =
                !!mod.sectionLabel && mod.sectionLabel !== prevSection;

              return (
                <div key={mod.code} className="flex flex-col">
                  {showSectionHeader && (
                    <div
                      className={cn(
                        "px-2 pb-1 text-[10px] font-semibold uppercase tracking-wider",
                        idx > 0 && "pt-2 mt-1",
                      )}
                      style={{
                        color: "hsl(var(--launcher-muted))",
                        borderTop:
                          idx > 0
                            ? "1px solid hsl(var(--launcher-border))"
                            : "none",
                      }}
                    >
                      {mod.sectionLabel}
                    </div>
                  )}
                  <button
                    type="button"
                    onClick={() => toggle(mod.code)}
                    className="flex items-center gap-2 px-2 py-1.5 rounded-md text-left transition-colors"
                    style={{
                      color: "hsl(var(--launcher-foreground))",
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.background =
                        "hsl(var(--launcher-surface-hover))";
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = "transparent";
                    }}
                  >
                    {isOpen ? (
                      <ChevronDown
                        className="h-3 w-3 shrink-0"
                        style={{ color: "hsl(var(--launcher-muted))" }}
                      />
                    ) : (
                      <ChevronRight
                        className="h-3 w-3 shrink-0"
                        style={{ color: "hsl(var(--launcher-muted))" }}
                      />
                    )}
                    <div
                      className="h-5 w-5 rounded flex items-center justify-center shrink-0"
                      style={accentStyle(modToken)}
                    >
                      <ModIcon className="h-3 w-3" />
                    </div>
                    <span
                      className="flex-1 text-[12px] truncate"
                      style={{ fontWeight: isActiveMod ? 600 : 500 }}
                    >
                      {mod.label}
                    </span>
                    <span
                      className="text-[10px]"
                      style={{ color: "hsl(var(--launcher-muted))" }}
                    >
                      {mod.pages.length}
                    </span>
                  </button>

                  {isOpen && (
                    <div className="pl-7 flex flex-col">
                      {mod.pages.map((page, pIdx) => {
                        const prevGroup =
                          pIdx > 0 ? mod.pages[pIdx - 1].groupLabel : undefined;
                        const showGroupHeader =
                          !!page.groupLabel && page.groupLabel !== prevGroup;
                        return (
                          <div key={page.id} className="flex flex-col">
                            {showGroupHeader && (
                              <div
                                className={cn(
                                  "px-2 pb-0.5 text-[9px] font-semibold uppercase tracking-wider",
                                  pIdx > 0 && "pt-2 mt-1",
                                )}
                                style={{
                                  color: "hsl(var(--launcher-muted))",
                                }}
                              >
                                {page.groupLabel}
                              </div>
                            )}
                            <PageLink
                              page={page}
                              currentPath={currentPath}
                              token={modToken}
                              onNavigate={onNavigate}
                            />
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </nav>
      </div>

      <FooterBack
        onClick={() => {
          onNavigate?.();
          navigate("/dashboard");
        }}
      />
    </Shell>
  );
}

// ────────────────────────────────────────────────────────────
// Modo MÓDULO — fallback legado (1 módulo só)
// ────────────────────────────────────────────────────────────
function ModulePanel({
  module,
  currentPath,
  onNavigate,
  statusBadge,
}: ModuleModeProps) {
  const navigate = useNavigate();
  const [query, setQuery] = useState("");

  const pages = useMemo(() => {
    if (!module) return [];
    const needle = query.trim().toLowerCase();
    return needle
      ? module.pages.filter((p) => p.label.toLowerCase().includes(needle))
      : module.pages;
  }, [module, query]);

  if (!module) {
    return (
      <Shell>
        <div
          className="p-4 text-sm"
          style={{ color: "hsl(var(--launcher-muted))" }}
        >
          Selecione um item no rail.
        </div>
      </Shell>
    );
  }

  const ModIcon = resolveIcon(module.icon);
  const token = getModuleAccent(module.code);


  return (
    <Shell>
      <div
        className="flex items-start gap-2.5 px-4 py-3.5"
        style={{ borderBottom: "1px solid hsl(var(--launcher-border))" }}
      >
        <div
          className="h-8 w-8 rounded-md flex items-center justify-center shrink-0"
          style={accentStyle(token)}
        >
          <ModIcon className="h-4 w-4" />
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

      <SearchBox value={query} onChange={setQuery} placeholder={`Buscar em ${module.label}`} />

      <div
        className="max-h-[60vh] overflow-y-auto overflow-x-hidden [&::-webkit-scrollbar]:w-2 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-[hsl(var(--launcher-border))] hover:[&::-webkit-scrollbar-thumb]:bg-[hsl(var(--launcher-muted))]"
        style={{ scrollbarWidth: "thin", scrollbarColor: "hsl(var(--launcher-border)) transparent" }}
      >
        <nav className="p-2 flex flex-col gap-0.5">
          {pages.length === 0 ? (
            <Empty query={query} />
          ) : (
            pages.map((page, pIdx) => {
              const prevGroup = pIdx > 0 ? pages[pIdx - 1].groupLabel : undefined;
              const showGroupHeader =
                !!page.groupLabel && page.groupLabel !== prevGroup;
              return (
                <div key={page.id} className="flex flex-col">
                  {showGroupHeader && (
                    <div
                      className={cn(
                        "px-2 pb-0.5 text-[9px] font-semibold uppercase tracking-wider",
                        pIdx > 0 && "pt-2 mt-1",
                      )}
                      style={{ color: "hsl(var(--launcher-muted))" }}
                    >
                      {page.groupLabel}
                    </div>
                  )}
                  <PageLink
                    page={page}
                    currentPath={currentPath}
                    token={token}
                    onNavigate={onNavigate}
                  />
                </div>
              );
            })
          )}
        </nav>
        <ScrollBar orientation="vertical" className="opacity-100" />
      </ScrollArea>

      <FooterBack
        onClick={() => {
          onNavigate?.();
          navigate("/dashboard");
        }}
      />
    </Shell>
  );
}

// ────────────────────────────────────────────────────────────
// Subcomponentes
// ────────────────────────────────────────────────────────────
function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div
      data-launcher-theme="dark"
      className="flex flex-col w-[320px] max-w-[88vw] rounded-lg overflow-hidden"
      style={{
        background: "hsl(var(--launcher-surface))",
        color: "hsl(var(--launcher-foreground))",
        boxShadow:
          "0 20px 60px -15px hsl(0 0% 0% / 0.55), inset 0 0 0 1px hsl(var(--launcher-border))",
      }}
    >
      {children}
    </div>
  );
}

function SearchBox({
  value,
  onChange,
  placeholder,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
}) {
  return (
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
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className="flex-1 bg-transparent outline-none text-[12px] placeholder:text-[hsl(var(--launcher-muted))]"
          style={{ color: "hsl(var(--launcher-foreground))" }}
        />
      </div>
    </div>
  );
}

function PageLink({
  page,
  currentPath,
  token,
  onNavigate,
}: {
  page: NavV2Page;
  currentPath: string;
  token: string;
  onNavigate?: () => void;
}) {
  const PageIcon = resolveIcon(page.icon);
  const isActive =
    currentPath === page.route || currentPath.startsWith(page.route + "/");
  return (
    <NavLink
      to={page.route}
      onClick={onNavigate}
      className={cn(
        "relative flex items-center gap-2.5 px-2.5 py-1.5 rounded-md text-[12px] transition-colors",
      )}
      style={{
        background: isActive ? `hsl(var(${token}) / 0.22)` : "transparent",
        color: isActive ? `hsl(var(${token}))` : "hsl(var(--launcher-foreground))",
        fontWeight: isActive ? 600 : 400,
        boxShadow: isActive ? `inset 0 0 0 1px hsl(var(${token}) / 0.35)` : "none",
      }}
      onMouseEnter={(e) => {
        if (isActive) return;
        e.currentTarget.style.background = "hsl(var(--launcher-surface-hover))";
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
}

function Empty({ query }: { query: string }) {
  return (
    <div
      className="px-3 py-4 text-xs text-center"
      style={{ color: "hsl(var(--launcher-muted))" }}
    >
      {query ? "Nada encontrado." : "Nenhuma página disponível."}
    </div>
  );
}

function FooterBack({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex items-center gap-2 px-4 py-2.5 text-[11px] transition-colors hover:opacity-80"
      style={{
        borderTop: "1px solid hsl(var(--launcher-border))",
        color: "hsl(var(--launcher-muted))",
      }}
    >
      <ArrowLeft className="h-3 w-3" />
      Voltar ao painel geral
    </button>
  );
}
